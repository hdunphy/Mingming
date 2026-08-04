/**
 * Epic 3: Save System with Zod Validation
 * Handles save/load to localStorage with schema validation.
 */

import { z } from 'zod';
import type { IPlayerSave } from './gameTypes';
import { getActiveSaveKey } from './SaveSlots';

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

export const CURRENT_SAVE_VERSION = 2;

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

    return save;
}

// --- Save/Load Functions ---

export function saveGame(state: IPlayerSave): { success: boolean; error?: string } {
    try {
        // Validate before saving
        PlayerSaveSchema.parse(state);
        const json = JSON.stringify(state);
        localStorage.setItem(getActiveSaveKey(), json);
        return { success: true };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = (err as any).issues.map((e: any) =>
                `[${e.path.join('.')}] ${e.message}`
            ).join('\n');
            console.error('Save validation failed:\n' + messages);
            return { success: false, error: messages };
        }
        return { success: false, error: String(err) };
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
