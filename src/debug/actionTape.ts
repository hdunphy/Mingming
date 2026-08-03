/**
 * Action tape — the actions dispatched since the current battle started.
 *
 * A snapshot says what the board looks like; the tape says how it got there. Exported
 * snapshots carry it as the optional `tape` field on `kind: 'snapshot'`
 * (`scenarios/scenarioSchema.ts`), decided in
 * `docs/wayfinder/debug-toolkit/tickets/06-battle-snapshot-export.md` section 1.
 *
 * `store.subscribe` observes state but never the action that changed it, so recording needs a
 * middleware — and importing a debug module into `store.ts` would break the standing invariant
 * that nothing outside `src/debug/` imports anything inside it. Hence the arrangement here: the
 * production store owns a general-purpose `setActionTap` seam that ships inert, and this module
 * is the only thing that ever fills it. The import edge points debug -> production, never back.
 *
 * Two limits are deliberate:
 *
 * - Ticket 05's god-tool verbs dispatch `setBattleState(verb(...))`, so they land in the tape as
 *   opaque whole-state replacements rather than named verbs. Accepted for v1.
 * - The tape is a *readable record*, not a re-runnable script, until determinism groundwork
 *   (ticket 09) makes battle creation reproducible. It becomes replayable for free when that lands.
 */

import { useEffect } from 'react';

import { setActionTap, store } from '../ui/store/store';

/**
 * Ring-buffer bound. A tape is bug-report evidence, not an audit log, and `setBattleState`
 * entries carry an entire `IBattleState`, so an unbounded buffer would quietly grow an export
 * into the megabytes. Oldest actions are evicted first; `getActionTapeStats().dropped` says how
 * many were lost.
 */
export const ACTION_TAPE_CAPACITY = 256;

/** What the tape reads off the store. Structural, so a test can pass a stub. */
interface TapeStore {
    getState(): { battle: { battle: { sessionId: string } | null } };
    subscribe(listener: () => void): () => void;
}

export interface ActionTapeStats {
    /** Actions currently held. */
    size: number;
    /** Actions evicted by the ring buffer since the last reset. `> 0` means the tape is partial. */
    dropped: number;
    capacity: number;
    /** `state.battle.battle.sessionId` the current tape belongs to, or `null` outside a battle. */
    sessionId: string | null;
}

// Ring buffer. Below capacity it is a plain append-only array with `head === 0`; at capacity
// `head` is the index of the oldest entry and writes wrap.
let buffer: unknown[] = [];
let head = 0;
let dropped = 0;

let sessionId: string | null = null;

// DebugRoot mounts twice (the floating layer, plus the docked Debug tab) and StrictMode
// double-invokes effects, so installs are refcounted: the first install arms the tap and the
// last uninstall disarms it. Without this, unmounting the docked tab would silently stop
// recording for the floating layer.
let installCount = 0;

function readSessionId(target: TapeStore): string | null {
    return target.getState().battle.battle?.sessionId ?? null;
}

/** The tap itself: append, evicting the oldest entry once the buffer is full. */
function recordAction(action: unknown): void {
    if (buffer.length < ACTION_TAPE_CAPACITY) {
        buffer.push(action);
        return;
    }
    buffer[head] = action;
    head = (head + 1) % ACTION_TAPE_CAPACITY;
    dropped += 1;
}

function resetTape(keepLast: boolean): void {
    const previous = keepLast ? getActionTape() : [];
    buffer = previous.length > 0 ? [previous[previous.length - 1]] : [];
    head = 0;
    dropped = 0;
}

/**
 * The recorded actions, oldest first — a fresh array, safe to serialize.
 *
 * This is the accessor the snapshot export (ticket 16) calls to fill `tape`. It returns the
 * actions exactly as dispatched, so an empty array means "recording, nothing yet" and is
 * indistinguishable from "not recording"; use `getActionTapeStats()` if that distinction matters.
 */
export function getActionTape(): unknown[] {
    return head === 0 ? buffer.slice() : buffer.slice(head).concat(buffer.slice(0, head));
}

/** Size, eviction count and owning battle — for overlay display and export metadata. */
export function getActionTapeStats(): ActionTapeStats {
    return { size: buffer.length, dropped, capacity: ACTION_TAPE_CAPACITY, sessionId };
}

/** Drop everything recorded so far, keeping the tap installed. */
export function clearActionTape(): void {
    resetTape(false);
}

/**
 * Arm the recorder against `target` and return the matching uninstall.
 *
 * Refcounted, and each returned disposer is idempotent, so concurrent mounts nest safely.
 * Exported separately from `useActionTape` so it can be tested headlessly, without React.
 */
export function installActionTape(target: TapeStore = store): () => void {
    installCount += 1;
    if (installCount === 1) {
        sessionId = readSessionId(target);
        resetTape(false);
        setActionTap(recordAction);
    }

    // Battle boundaries are detected after the fact, from the store rather than the action:
    // `startBattle` builds the new state inside the reducer, and a mid-battle snapshot import
    // arrives as an ordinary `setBattleState`. Watching `sessionId` catches both without this
    // module having to know either action's name.
    const unsubscribe = target.subscribe(() => {
        const next = readSessionId(target);
        if (next === sessionId) return;
        sessionId = next;
        // Subscribers run immediately after the reducer, so the newest entry *is* the action
        // that started this battle. Keeping it makes the tape open on its own first cause.
        resetTape(true);
    });

    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        unsubscribe();
        installCount -= 1;
        if (installCount === 0) {
            setActionTap(null);
            resetTape(false);
            sessionId = null;
        }
    };
}

/**
 * Record for as long as the calling component is mounted. Call once from `DebugRoot`:
 *
 *     useActionTape();
 *
 * Nothing else needs to know it exists — the tap is cleared on unmount, so a production build
 * (where `DebugRoot` never loads) records nothing.
 */
export function useActionTape(): void {
    useEffect(() => installActionTape(), []);
}
