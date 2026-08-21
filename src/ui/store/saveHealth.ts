/**
 * Save health — the one place that knows whether the player's progress is actually reaching
 * storage.
 *
 * Ticket 04 (steam-release map). Before this module, `store.ts`'s autosave subscription handled a
 * failed write with `console.error`. `saveGame` validates before it writes, so a bad state was
 * never *persisted* — but the player was never *told*, and a run could continue for an hour on
 * top of a save that had silently stopped updating an hour ago. Console output is not a player-
 * facing channel in a shipped Steam build; there is no console.
 *
 * Deliberately not a Redux slice. The autosave subscription runs *inside* `store.subscribe`, so
 * dispatching from it would re-enter the store on every failed save. This is a plain observable
 * that the banner subscribes to with `useSyncExternalStore`.
 */

import type { SaveFailureKind } from '../../engine/SaveSystem';

export interface SaveHealth {
    /** False from the first failed write until the next successful one. */
    healthy: boolean;
    /** Which way the last write failed. Undefined while healthy. */
    kind?: SaveFailureKind;
    /** Message from the failure, for the details toggle. Undefined while healthy. */
    error?: string;
    /** Consecutive failures. Resets to 0 on any success. */
    failureCount: number;
    /** `Date.now()` of the last write that succeeded, or null if none has this session. */
    lastGoodAt: number | null;
}

const HEALTHY: SaveHealth = { healthy: true, failureCount: 0, lastGoodAt: null };

let current: SaveHealth = HEALTHY;
const listeners = new Set<() => void>();

function emit(next: SaveHealth): void {
    current = next;
    // Copied before iterating: a listener that unsubscribes itself must not skip its neighbour.
    for (const listener of [...listeners]) {
        try {
            listener();
        } catch {
            // A broken listener must not take down the autosave path that called us.
        }
    }
}

/** `useSyncExternalStore` subscribe half. Returns the unsubscriber. */
export function subscribeSaveHealth(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * `useSyncExternalStore` snapshot half. Returns a stable reference between changes — returning a
 * fresh object here would spin React forever.
 */
export function getSaveHealth(): SaveHealth {
    return current;
}

/** Feed every autosave outcome through here. Called by the subscription in `store.ts`. */
export function reportSaveResult(result: { success: boolean; error?: string; kind?: SaveFailureKind }): void {
    if (result.success) {
        if (current.healthy && current.lastGoodAt !== null) {
            // Already healthy and already stamped — nothing observable changed, so don't churn
            // the reference and re-render every subscriber on every single autosave.
            return;
        }
        emit({ healthy: true, failureCount: 0, lastGoodAt: Date.now() });
        return;
    }

    emit({
        healthy: false,
        kind: result.kind,
        error: result.error,
        failureCount: current.failureCount + 1,
        lastGoodAt: current.lastGoodAt,
    });
}

/** Test seam. Not called by production code. */
export function resetSaveHealth(): void {
    current = HEALTHY;
}
