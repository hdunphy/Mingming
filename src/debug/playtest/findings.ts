/**
 * TICKET 180e — WHAT A SESSION FOUND: surprises and invariant failures.
 *
 * Findings are not stored. They are produced while a session replays, move by move, by the same
 * deterministic code that played it, so any replay of a session file rebuilds exactly the findings
 * the live session had, and the morning report (180f) reads them by replaying. `atMove` is the
 * zero-based index of the move in the log.
 *
 * A **surprise** is a prediction the agent made (`--expect`) that the game did not keep: a bug, or
 * wording that misled a careful player. An **invariant failure** is a state the game should never be
 * in. Both are worth a person's attention; the second is more likely a plain bug.
 */
import type { Difference } from './expect/compare';
import type { World } from './types';

export interface SurpriseFinding {
    readonly kind: 'surprise';
    readonly atMove: number;
    readonly subject: { readonly type: 'card' | 'macro'; readonly id: string; readonly name: string; readonly text: string };
    readonly prediction: unknown;
    /** What happened, for the keys the agent predicted. */
    readonly result: Readonly<Record<string, unknown>>;
    readonly differences: ReadonlyArray<Difference>;
}

/** The names a violation can carry. The report groups by name. */
export type InvariantName =
    | 'run-schema' | 'duplicate-card-id' | 'hp-range' | 'energy-negative' | 'card-vanished'
    | 'turn-cap' | 'soft-lock' | 'engine-error' | 'move-refused' | 'fight-truncated' | 'screen-error';

export interface InvariantFinding {
    readonly kind: 'invariant';
    readonly atMove: number;
    readonly name: InvariantName;
    readonly detail: string;
}

export type Finding = SurpriseFinding | InvariantFinding;

/** Record an invariant failure against the move being applied (the log has not grown by it yet). */
export function flag(world: World, name: InvariantName, detail: string): void {
    world.findings.push({ kind: 'invariant', atMove: world.log.length, name, detail });
}
