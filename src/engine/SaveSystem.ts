/**
 * Epic 3: Save System with Zod Validation
 * Handles save/load to localStorage with schema validation.
 */

import { z } from 'zod';
import type { IPlayerSave } from './gameTypes';
import { getActiveSaveKey } from './SaveSlots';
import { GetMingmingData } from './data/mingmingRegistry';
import { deckGrantKey } from './gameTypes';

/**
 * The four functions below keep their exact signatures and address the *active save slot*
 * (`./SaveSlots.ts`), which resolves to `mingming_save__<slotId>`. Nothing here takes a key:
 * one of the six call sites is the autosave subscription in `src/ui/store/store.ts`, and
 * threading a slot through it would mean editing production files on behalf of the debug
 * toolkit. Slot selection is therefore a single write in the index, not a parameter.
 *
 * The pre-slot `mingming_save` key is adopted (copied, not moved) into the first slot on the
 * first read after upgrading — see `./SaveSlots.ts`.
 */

// --- Zod Schemas ---

const MingmingInstanceSchema = z.object({
    id: z.string(),
    definitionId: z.string(),
    nickname: z.string().optional(),
    level: z.number().int().min(1),
    experience: z.number().int().min(0),
    activeOS: z.string().optional(),
    blueprintsCollected: z.number().int().min(0),
    attackIV: z.number().int().min(0).max(31),
    defenseIV: z.number().int().min(0).max(31),
    hpIV: z.number().int().min(0).max(31),
});

const OwnedProgramSchema = z.object({
    instanceId: z.string(),
    dataId: z.string(),
});

const ActiveDeckSchema = z.object({
    id: z.string(),
    name: z.string(),
    cards: z.array(z.string()),
});

const BlueprintSchema = z.object({
    architectureId: z.string(),
    name: z.string(),
    compileCost: z.number().int().min(0),
});

const GauntletStateSchema = z.object({
    type: z.enum(['Gym', 'Sector']),
    element: z.string(),
    currentBattleIndex: z.number(),
    totalBattles: z.number(),
    // Design decision: only HP persists between gauntlet battles (health is the
    // resource you manage across the run). Energy, statuses, and everything else
    // reset fresh each battle, so only `hp` is stored.
    persistedStats: z.record(z.string(), z.object({
        hp: z.number()
    }))
});

export const CURRENT_SAVE_VERSION = 3;

export const PlayerSaveSchema = z.object({
    version: z.number().int().min(1),
    roster: z.array(MingmingInstanceSchema),
    activeParty: z.array(z.string()).max(3),
    cardInventory: z.array(OwnedProgramSchema),
    activeDeck: ActiveDeckSchema.nullable(),
    scrapCount: z.number().int().min(0),
    blueprints: z.array(BlueprintSchema).catch([]),
    relics: z.array(z.string()).catch([]),
    gauntlet: GauntletStateSchema.nullable().catch(null),
    unlockedSectors: z.array(z.string()).catch([]),
    baseDecksGranted: z.array(z.string()).catch([])
});

/**
 * Version-keyed migration of raw (already JSON-parsed) save data.
 * Runs BEFORE schema validation so older save shapes load instead of
 * being rejected wholesale (which previously caused the save to be
 * treated as missing and then overwritten by the next autosave).
 */
export function migrateSave(raw: unknown): unknown {
    if (raw === null || typeof raw !== 'object') return raw;
    const save = { ...(raw as Record<string, unknown>) };

    if (typeof save.version !== 'number') save.version = 1;

    if ((save.version as number) < 2) {
        // v1 -> v2: fields added after the earliest saves get safe defaults.
        if (!Array.isArray(save.blueprints)) save.blueprints = [];
        if (!Array.isArray(save.relics)) save.relics = [];
        if (!Array.isArray(save.unlockedSectors)) save.unlockedSectors = [];
        if (save.gauntlet === undefined) save.gauntlet = null;
        save.version = 2;
    }

    if ((save.version as number) < 3) {
        // v2 -> v3 (ticket 15): baseDecksGranted moves from bare species ids to
        // deckGrantKey(species, os). A legacy species entry is reinterpreted as
        // "granted for the OS that species' roster member currently runs"
        // (availableOS[0] when no member/activeOS exists) - the rule the
        // data-model audit pre-approved.
        if (Array.isArray(save.baseDecksGranted)) {
            const roster = Array.isArray(save.roster) ? (save.roster as Array<Record<string, unknown>>) : [];
            save.baseDecksGranted = (save.baseDecksGranted as unknown[]).map(entry => {
                if (typeof entry !== 'string' || entry.includes(':')) return entry;
                const member = roster.find(m => m && m.definitionId === entry);
                const memberOS = member && typeof member.activeOS === 'string' ? member.activeOS : undefined;
                const fallback = GetMingmingData(entry).availableOS[0] ?? `${entry}_v1`;
                return deckGrantKey(entry, memberOS ?? fallback);
            });
        }
        save.version = 3;
    }

    return save;
}

// --- Save/Load Functions ---

/**
 * How a write failed. Ticket 04 (steam-release map) split this out of the bare `error` string
 * because the three cases need different words in front of the player:
 *
 *   `validation` — the state we were handed does not satisfy `PlayerSaveSchema`. A bug in the
 *                  game, not something the player can act on; nothing is written, so whatever is
 *                  in storage stays the last good save.
 *   `quota`      — localStorage is full. Recoverable by the player (delete a slot, free space).
 *   `storage`    — localStorage is unavailable outright: private-browsing modes, an embedded
 *                  webview with storage disabled, `localStorage` missing entirely (node).
 */
export type SaveFailureKind = 'validation' | 'quota' | 'storage';

export interface SaveResult {
    success: boolean;
    error?: string;
    /** Present only when `success` is false. */
    kind?: SaveFailureKind;
}

/**
 * Browsers disagree on how they signal a full quota. Chrome/Safari throw `QuotaExceededError`
 * (legacy code 22), Firefox throws `NS_ERROR_DOM_QUOTA_REACHED` (code 1014), and some older
 * WebKit builds throw a plain `Error` whose message is the only clue.
 */
function isQuotaError(err: unknown): boolean {
    if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
        if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
        if (err.code === 22 || err.code === 1014) return true;
    }
    const name = (err as { name?: unknown })?.name;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    return /quota|exceeded the quota|storage is full/i.test(String((err as { message?: unknown })?.message ?? ''));
}

/**
 * Write the active slot, or fail without touching what is already there.
 *
 * The ordering is the whole point: **validate, then serialize, then write**. A state that fails
 * `PlayerSaveSchema` never reaches `setItem`, and a `setItem` that throws leaves the previous
 * value intact per the Web Storage spec — so on every failure path the bytes in storage are still
 * the last save that was known good. Ticket 04's requirement ("autosave must never write a save
 * that fails `PlayerSaveSchema.parse()`" plus "a quota/write-failure path that does not lose the
 * run") is met by that ordering, not by keeping a backup copy.
 *
 * What ticket 04 changed is that failure is now *reportable*: the returned `kind` lets
 * `ui/store/saveHealth.ts` put it in front of the player, instead of only in a console that does
 * not exist in a shipped build.
 */
export function saveGame(state: IPlayerSave): SaveResult {
    // 1. Validate. Nothing below this line runs if the state is not a legal save.
    try {
        PlayerSaveSchema.parse(state);
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = (err as any).issues.map((e: any) =>
                `[${e.path.join('.')}] ${e.message}`
            ).join('\n');
            console.error('Save validation failed:\n' + messages);
            return { success: false, error: messages, kind: 'validation' };
        }
        return { success: false, error: String(err), kind: 'validation' };
    }

    // 2. Serialize. Separate from the write so a JSON failure is not misreported as a quota one.
    let json: string;
    try {
        json = JSON.stringify(state);
    } catch (err) {
        console.error('Save serialization failed:', err);
        return { success: false, error: String(err), kind: 'validation' };
    }

    // 3. Write. A throw here leaves the previous value in place — the run is not lost.
    try {
        localStorage.setItem(getActiveSaveKey(), json);
        return { success: true };
    } catch (err) {
        if (isQuotaError(err)) {
            console.error('Save failed — storage is full. The last good save is untouched.', err);
            return {
                success: false,
                error: 'Browser storage is full, so this save could not be written. Your previous save is untouched.',
                kind: 'quota',
            };
        }
        console.error('Save failed — storage is unavailable. The last good save is untouched.', err);
        return {
            success: false,
            error: `Storage is unavailable (${String(err)}). Your previous save is untouched.`,
            kind: 'storage',
        };
    }
}

export function loadGame(): { data: IPlayerSave | null; error?: string } {
    try {
        const raw = localStorage.getItem(getActiveSaveKey());
        if (!raw) return { data: null };

        const parsed = migrateSave(JSON.parse(raw));
        const validated = PlayerSaveSchema.parse(parsed);
        return { data: validated as IPlayerSave };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = (err as any).issues.map((e: any) =>
                `[${e.path.join('.')}] ${e.message}`
            ).join('\n');
            console.error('Load validation failed:\n' + messages);
            return { data: null, error: messages };
        }
        if (err instanceof SyntaxError) {
            console.error('Corrupted save data (invalid JSON)');
            return { data: null, error: 'Corrupted save data (invalid JSON)' };
        }
        return { data: null, error: String(err) };
    }
}

/**
 * Wipe the active slot's save (defeat, and the hub's "restart" confirm). The slot itself
 * survives as an empty slot — removing it from the index is `deleteSlot`'s job, and doing it
 * here would drop the player out of the slot they are sitting in.
 */
export function deleteSave(): void {
    try {
        localStorage.removeItem(getActiveSaveKey());
    } catch {
        // localStorage may be unavailable (node, privacy modes). Nothing to remove either way.
    }
}

export function hasSave(): boolean {
    try {
        return localStorage.getItem(getActiveSaveKey()) !== null;
    } catch {
        return false;
    }
}
