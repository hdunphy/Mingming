/**
 * Save v4 — the ranch that persists, and at most one run in progress.
 *
 * Rewritten by ticket 23 (steam-release map) from the v1–v3 single-blob save. Three of Henry's
 * rulings shape this file, and all three are load-bearing:
 *
 * 1. **TWO KEYS, WRITTEN INDEPENDENTLY.** The ranch holds the only irreplaceable things in the
 *    game — blueprints are the only persistent currency, and individuals carry unrepeatable stat
 *    rolls. A run is at most 45 minutes old and was always going to end. Splitting the keys makes
 *    the blast radius of a corrupt run stop at the run. The price is that the cross-object laws
 *    stop being schema refinements and become an explicit load step — `reconcileLoadedState` in
 *    `runTypes.ts`, whose law is *the run is always the disposable half, never half-repaired*.
 *
 * 2. **v4 IS THE FLOOR. THERE IS NO MIGRATION.** Anything whose `version` is not 4 reads as *no
 *    save*, not as corruption. That distinction is the subtle one: ticket 04's loader treats a
 *    parse failure as damage and keeps clinging to the last good bytes, which is exactly the wrong
 *    response to a v3 save that is meant to be abandoned. A v3 blob must make a NEW PLAYER, not a
 *    damaged one. The v1→v2→v3 upgrade chain is gone, not extended.
 *
 * 3. **`.default()`, NEVER `.catch()`.** See `runTypes.ts`. v3 used `.catch([])` on `blueprints`,
 *    `relics`, `unlockedSectors` and `baseDecksGranted`, which silently replaces *malformed* input
 *    with the fallback and lets the parse succeed — so one corrupt blueprint count would have
 *    emptied the player's permanent inventory and the next autosave would have written that
 *    emptiness over the good save. Harmless when blueprints were an unspendable list; not harmless
 *    now they are currency.
 *
 * Storage goes through `save/storage.ts`, the one module that names `localStorage`, so ticket 42
 * can swap in a file backend for Steam Cloud without reopening this file.
 */

import { z } from 'zod';

import {
    RanchSaveSchema,
    RunSaveSchema,
    SAVE_VERSION_V4,
    isSupportedSaveVersion,
    reconcileLoadedState,
    type IRanchState,
    type IRunState,
    type RunDiscardReason,
} from './runTypes';
import { getActiveRanchKey, getActiveRunKey } from './SaveSlots';
import { getSaveStorage } from './save/storage';

export const CURRENT_SAVE_VERSION = SAVE_VERSION_V4;

// --- Failure classification ------------------------------------------------------------------

/**
 * How a write failed. Ticket 04 split this out of a bare `error` string because the three cases
 * need different words in front of the player:
 *
 *   `validation` — the state we were handed is not a legal save. A bug, not something the player
 *                  can act on; nothing is written, so storage keeps the last good bytes.
 *   `quota`      — storage is full. Recoverable by the player.
 *   `storage`    — storage is unavailable outright: private-browsing modes, an embedded webview
 *                  with storage disabled, or no storage at all (node).
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
 * (legacy code 22), Firefox throws `NS_ERROR_DOM_QUOTA_REACHED` (code 1014), and some older WebKit
 * builds throw a plain `Error` whose message is the only clue.
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

/** One line per issue, path first — the shape both debug panels render and the log carries. */
function zodMessage(err: z.ZodError): string {
    return err.issues.map((issue) => `[${issue.path.join('.')}] ${issue.message}`).join('\n');
}

/**
 * The shared write path for both keys: **validate, then serialize, then write.**
 *
 * The ordering is the guarantee, not a style choice. A state that fails its schema never reaches
 * the storage backend, and a backend write that throws leaves the previous bytes untouched — so on
 * every failure path what is in storage is still the last save that was known good. Ticket 04's
 * requirement is met by that ordering rather than by keeping a backup copy.
 */
function writeValidated<T>(key: string, schema: z.ZodType<T>, envelope: unknown, label: string): SaveResult {
    let parsed: T;
    try {
        parsed = schema.parse(envelope);
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = zodMessage(err);
            console.error(`${label} validation failed:\n${messages}`);
            return { success: false, error: messages, kind: 'validation' };
        }
        return { success: false, error: String(err), kind: 'validation' };
    }

    let json: string;
    try {
        json = JSON.stringify(parsed);
    } catch (err) {
        console.error(`${label} serialization failed:`, err);
        return { success: false, error: String(err), kind: 'validation' };
    }

    try {
        getSaveStorage().write(key, json);
        return { success: true };
    } catch (err) {
        if (isQuotaError(err)) {
            console.error(`${label} failed — storage is full. The last good save is untouched.`, err);
            return {
                success: false,
                error: 'Browser storage is full, so this save could not be written. Your previous save is untouched.',
                kind: 'quota',
            };
        }
        console.error(`${label} failed — storage is unavailable. The last good save is untouched.`, err);
        return {
            success: false,
            error: `Storage is unavailable (${String(err)}). Your previous save is untouched.`,
            kind: 'storage',
        };
    }
}

// --- Writing ---------------------------------------------------------------------------------

/** Persist the ranch. The half that must never be lost. */
export function saveRanch(ranch: IRanchState): SaveResult {
    return writeValidated(
        getActiveRanchKey(),
        RanchSaveSchema,
        { version: CURRENT_SAVE_VERSION, ranch },
        'Ranch save',
    );
}

/**
 * Persist the run in progress, or clear the key when there is none.
 *
 * Passing `null` REMOVES the key rather than writing a null envelope. A run that has ended should
 * leave no bytes behind: the next load then takes the "no run" branch by absence, which is the
 * same branch a fresh player takes, so there is exactly one code path for "not in a run".
 */
export function saveRun(run: IRunState | null): SaveResult {
    if (run === null) {
        try {
            getSaveStorage().remove(getActiveRunKey());
            return { success: true };
        } catch (err) {
            return { success: false, error: String(err), kind: 'storage' };
        }
    }
    return writeValidated(
        getActiveRunKey(),
        RunSaveSchema,
        { version: CURRENT_SAVE_VERSION, run },
        'Run save',
    );
}

// --- Reading ---------------------------------------------------------------------------------

export interface LoadResult {
    /** Null when there is no usable ranch — a fresh player, or an unreadable one. */
    ranch: IRanchState | null;
    /** Null when there is no run, or when one was discarded during reconciliation. */
    run: IRunState | null;
    /** Set when a run existed and was thrown away. Surface it; do not swallow it. */
    discarded?: RunDiscardReason;
    /**
     * Set only when the ranch bytes were PRESENT and UNREADABLE — genuine corruption, worth
     * telling the player about. A missing key and a pre-v4 blob both leave this undefined,
     * because both mean "new player" rather than "your save is damaged".
     */
    error?: string;
}

function readJson(key: string): unknown {
    const raw = getSaveStorage().read(key);
    if (raw === null) return null;
    try {
        return JSON.parse(raw);
    } catch {
        // Deliberately distinct from `null`: unparseable bytes are corruption, absent bytes are a
        // new player. The caller separates them.
        return { __unparseable: true };
    }
}

/**
 * Load both keys and reconcile them.
 *
 * The pre-v4 check happens BEFORE the schema parse, and that ordering is the whole point of
 * ruling 2: a v3 blob would also fail `RanchSaveSchema`, but reporting it as a parse *error* would
 * make ticket 04's loader treat an abandoned save as damage. Checking the version first lets a v3
 * blob return cleanly as "no ranch, no error" — a new player.
 */
export function loadGameState(): LoadResult {
    const rawRanch = readJson(getActiveRanchKey());
    const rawRun = readJson(getActiveRunKey());

    if (rawRanch === null) {
        return { ranch: null, run: null };
    }

    if ((rawRanch as { __unparseable?: boolean }).__unparseable) {
        console.error('Corrupted ranch save (invalid JSON)');
        return { ranch: null, run: null, error: 'Corrupted save data (invalid JSON)' };
    }

    const version = (rawRanch as { version?: unknown }).version;
    if (!isSupportedSaveVersion(version)) {
        // A pre-v4 save. Ruling 2: this is a NEW PLAYER, not a damaged one.
        console.warn(
            `Save version ${String(version)} predates v4 and is not migrated (ticket 23). Starting fresh.`,
        );
        return { ranch: null, run: null };
    }

    const runEnvelope = rawRun !== null && !(rawRun as { __unparseable?: boolean }).__unparseable
        ? rawRun
        : null;

    const reconciled = reconcileLoadedState(rawRanch, runEnvelope);

    if (reconciled.ranch === null) {
        const parsed = RanchSaveSchema.safeParse(rawRanch);
        const message = parsed.success ? 'Ranch save failed validation' : zodMessage(parsed.error);
        console.error(`Ranch load validation failed:\n${message}`);
        return { ranch: null, run: null, error: message };
    }

    // Unparseable run bytes are the same outcome as a schema-invalid run: discard the run, keep
    // the ranch. `reconcileLoadedState` never saw them, so report it here.
    if (rawRun !== null && runEnvelope === null) {
        return { ranch: reconciled.ranch, run: null, discarded: 'run-schema-invalid' };
    }

    return reconciled;
}

// --- Removal ---------------------------------------------------------------------------------

/** Wipe the active slot — both keys. The hub's "restart" confirm and the defeat path. */
export function deleteSave(): void {
    const storage = getSaveStorage();
    try {
        storage.remove(getActiveRanchKey());
    } catch {
        // Storage may be unavailable; nothing to remove either way.
    }
    try {
        storage.remove(getActiveRunKey());
    } catch {
        // As above.
    }
}

/** Is there a ranch to load? A run without a ranch is meaningless, so the ranch is the question. */
export function hasSave(): boolean {
    return getSaveStorage().read(getActiveRanchKey()) !== null;
}

// Re-exported so callers importing the save API do not also have to import `runTypes`.
export { RanchSaveSchema, RunSaveSchema, isSupportedSaveVersion };
export type { IRanchState, IRunState, RunDiscardReason };
