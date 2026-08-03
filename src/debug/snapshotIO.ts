/**
 * Snapshot export & import — the "hit a bug, press a key, get a JSON" loop.
 *
 * Specified by `docs/wayfinder/debug-toolkit/tickets/16-snapshot-export-import.md` and
 * sections 2 and 3 of `06-battle-snapshot-export.md`.
 *
 * Split deliberately into a pure half and a DOM half:
 *
 *   `buildSnapshotFile()`  — pure. Normalizes, stamps and serializes. Testable headlessly.
 *   `exportSnapshot()`     — the pure half plus the Blob download.
 *
 * ZERO PROMPTS. The moment you notice a bug is the worst possible moment to be asked a
 * question, so the file is auto-named `snapshot-t<turn>-<seed prefix>.scenario.json` and
 * dropped straight into the downloads folder. Henry renames it on its way into `repro/`.
 *
 * `version`, `registryHash` and `createdAt` are stamped by `saveScenario()`, and the state
 * goes through `normalizeBattleState()` on the way out and again on the way back in — both
 * inside `scenarioIO`. Nothing here reimplements any of it.
 *
 * THE TAPE IS NOT WIRED UP HERE. The action-tape recorder is a separate ticket
 * (`17-action-tape.md`) landing in parallel; importing it would couple two in-flight
 * tickets together. Every entry point therefore takes an **optional** `tape` argument and
 * carries it into the envelope untouched. When the recorder lands, its owner passes the
 * recorded array in at the call site in `DebugRoot` — no change is needed in this module.
 *
 * Nothing outside `src/debug/` may import this module.
 */

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

import { saveScenario } from './scenarios/scenarioIO';
import { SCENARIO_FILE_EXTENSION } from './scenarios/scenarioSchema';
import type { SnapshotScenario } from './scenarios/scenarioSchema';
import type { IBattleState } from '../engine/types';
import type { RootState } from '../ui/store/store';

/** Shown next to the export button so the hotkey is discoverable from the panel. */
export const SNAPSHOT_EXPORT_HOTKEY_LABEL = 'Ctrl+Shift+E';

// --- Naming ------------------------------------------------------------------

/** Fallback when a state carries an empty or punctuation-only seed. */
const SEED_PREFIX_FALLBACK = 'noseed';

/**
 * First 8 alphanumerics of the seed. Separators are stripped rather than truncated
 * through, so a uuid-ish seed and a `seed-0001` seed both yield something greppable.
 */
export function snapshotSeedPrefix(seed: string): string {
    const cleaned = seed.replace(/[^0-9a-zA-Z]/g, '');
    return cleaned.slice(0, 8) || SEED_PREFIX_FALLBACK;
}

/** Envelope `name`. Same string as the filename, minus the extension. */
export function snapshotName(state: IBattleState): string {
    return `snapshot-t${state.turn}-${snapshotSeedPrefix(state.seed)}`;
}

/** e.g. `snapshot-t14-a3f9c02b.scenario.json`. Unique enough, greppable, no dialog. */
export function snapshotFileName(state: IBattleState): string {
    return `${snapshotName(state)}${SCENARIO_FILE_EXTENSION}`;
}

// --- Build -------------------------------------------------------------------

export interface SnapshotExportResult {
    success: boolean;
    /** Auto-generated download name. Present whenever `success`. */
    fileName?: string;
    /** Pretty-printed `.scenario.json` contents. Present whenever `success`. */
    json?: string;
    /** The stamped, normalized envelope that produced `json`. */
    scenario?: SnapshotScenario;
    error?: string;
}

/**
 * Pure: normalize -> wrap in the ticket-02 envelope -> validate -> stringify.
 *
 * `tape` is written only when the caller supplies one; a file without the key still
 * validates, which is exactly why `tape` was added as optional rather than versioned.
 */
export function buildSnapshotFile(
    state: IBattleState,
    tape?: readonly unknown[],
): SnapshotExportResult {
    const result = saveScenario({
        kind: 'snapshot',
        name: snapshotName(state),
        description: `Auto-captured at turn ${state.turn}, phase ${state.phase}.`,
        tags: ['snapshot'],
        state,
        ...(tape !== undefined ? { tape: [...tape] } : {}),
    });

    if (!result.success || result.json === undefined || result.scenario === undefined) {
        return { success: false, error: result.error ?? 'saveScenario produced no output' };
    }

    return {
        success: true,
        fileName: snapshotFileName(state),
        json: result.json,
        scenario: result.scenario as SnapshotScenario,
    };
}

// --- Download ----------------------------------------------------------------

/**
 * The `downloadCSV` pattern from `panels/BalanceTester.tsx` — a browser page cannot write
 * into `src/debug/scenarios/`, so a Blob + synthetic anchor click is the whole mechanism.
 * Differs from the original in one respect: the object URL is revoked, because a debug
 * session exports dozens of snapshots and each leaked URL pins its Blob for the page's life.
 */
function triggerDownload(fileName: string, contents: string): void {
    const blob = new Blob([contents], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Capture the board as of right now and download it. No dialog, no prompt, no confirm.
 *
 * A null `state` (no battle in progress) is a no-op that warns rather than throwing: the
 * hotkey is global and fires from the hub and the roster too.
 *
 * In a headless environment the file is built and returned but not downloaded, so tests
 * can call the real entry point instead of a parallel one.
 */
export function exportSnapshot(
    state: IBattleState | null | undefined,
    tape?: readonly unknown[],
): SnapshotExportResult {
    if (!state) {
        const error = 'No battle in progress — nothing to snapshot.';
        console.warn(`[snapshot] ${error}`);
        return { success: false, error };
    }

    const built = buildSnapshotFile(state, tape);
    if (!built.success) {
        console.error(`[snapshot] export failed:\n${built.error}`);
        return built;
    }

    if (typeof document === 'undefined') return built;

    triggerDownload(built.fileName!, built.json!);
    console.info(`[snapshot] exported ${built.fileName}`);
    return built;
}

// --- Hotkey ------------------------------------------------------------------

/**
 * The subset of `KeyboardEvent` the predicate reads. Structural, so the predicate can be
 * unit-tested with a plain object in a `node` test environment where `KeyboardEvent` and
 * `HTMLElement` do not exist.
 */
export interface SnapshotHotkeyEvent {
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    key: string;
    code?: string;
    target?: unknown;
}

/**
 * Same guard as `DebugRoot`'s Ctrl+Shift+D handler: the app has real text fields (CardForm,
 * deck naming) and swallowing a keystroke mid-word would be hostile.
 *
 * Duck-typed rather than `instanceof HTMLElement` — `DebugRoot` can use `instanceof`
 * because it only ever runs in a browser; this predicate is exported and tested headlessly.
 */
function isTextEntryTarget(target: unknown): boolean {
    if (target === null || typeof target !== 'object') return false;
    const element = target as { tagName?: unknown; isContentEditable?: unknown };
    if (element.isContentEditable === true) return true;
    if (typeof element.tagName !== 'string') return false;
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
}

/** Ctrl+Shift+E, with no modifier soup and not while typing. */
export function isSnapshotExportHotkey(event: SnapshotHotkeyEvent): boolean {
    if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return false;
    // `key` is 'E' with Shift held on most layouts; `code` covers the rest.
    if (event.code !== 'KeyE' && event.key.toLowerCase() !== 'e') return false;
    if (isTextEntryTarget(event.target)) return false;
    return true;
}

export interface SnapshotExportHotkeyOptions {
    /** Recorded action tape, if a recorder is installed. See the module header. */
    tape?: readonly unknown[];
    /**
     * Preferred over `tape` for a live recorder: read at keypress time rather than render
     * time. `DebugRoot` re-renders on battle actions but not on every dispatch, so a plain
     * `tape` array can be stale by the actions that did not happen to trigger a render.
     * Takes precedence over `tape` when both are given.
     */
    getTape?: () => readonly unknown[];
    /** Fires after every hotkey export, successful or not. */
    onExport?: (result: SnapshotExportResult) => void;
}

interface SnapshotHotkeyOwner {
    battle: IBattleState | null;
    options: SnapshotExportHotkeyOptions;
}

/**
 * ONE window listener, however many components call the hook.
 *
 * `App.tsx` mounts `DebugRoot` twice whenever the Debug tab is open — once as the always-on
 * floating layer and once docked — so a hook that bound its own listener per instance would
 * download the same snapshot twice per keystroke. Owners are refcounted here instead, which
 * also means the parent can put the call anywhere in `DebugRoot` without having to reason
 * about which of the two subtrees it lands in.
 *
 * Every owner reads the same Redux store, so the first one wins and the exported state is
 * identical either way; only `tape` / `onExport` are read from that first owner.
 */
const hotkeyOwners = new Map<symbol, { current: SnapshotHotkeyOwner }>();
let hotkeyListenerInstalled = false;

function onHotkeyDown(event: KeyboardEvent): void {
    if (!isSnapshotExportHotkey(event)) return;
    event.preventDefault();
    const owner = hotkeyOwners.values().next().value;
    if (owner === undefined) return;
    const { battle, options } = owner.current;
    options.onExport?.(exportSnapshot(battle, options.getTape?.() ?? options.tape));
}

function addHotkeyOwner(id: symbol, ref: { current: SnapshotHotkeyOwner }): void {
    hotkeyOwners.set(id, ref);
    if (!hotkeyListenerInstalled && typeof window !== 'undefined') {
        window.addEventListener('keydown', onHotkeyDown);
        hotkeyListenerInstalled = true;
    }
}

function removeHotkeyOwner(id: symbol): void {
    hotkeyOwners.delete(id);
    if (hotkeyListenerInstalled && hotkeyOwners.size === 0 && typeof window !== 'undefined') {
        window.removeEventListener('keydown', onHotkeyDown);
        hotkeyListenerInstalled = false;
    }
}

/**
 * Registers the global Ctrl+Shift+E listener.
 *
 * Call it from `DebugRoot` — NOT from a panel — so that export works with the debug layer
 * closed, which is the whole point of having a hotkey:
 *
 *     useSnapshotExportHotkey();
 *
 * Reads the live battle from Redux itself, so the call site passes nothing. Pass
 * Pass `{ getTape }` to include the ticket-17 action tape, read at keypress time. The listener binds once per mounted owner
 * set and reads the latest state through a ref, so a re-render per battle action does not
 * churn the window listener.
 */
export function useSnapshotExportHotkey(options: SnapshotExportHotkeyOptions = {}): void {
    const battle = useSelector((state: RootState) => state.battle.battle);
    const latest = useRef<SnapshotHotkeyOwner>({ battle, options });

    useEffect(() => {
        latest.current = { battle, options };
    });

    useEffect(() => {
        const id = Symbol('snapshot-export-hotkey');
        addHotkeyOwner(id, latest);
        return () => removeHotkeyOwner(id);
    }, []);
}
