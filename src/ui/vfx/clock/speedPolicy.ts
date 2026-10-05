/**
 * THE SPEED POLICY — ticket 189a, fed by ticket 190a.
 *
 * One function that answers "how fast does the battle clock run?". Its inputs, all optional:
 *
 * - `tier`: the player's battle speed (Slow, Showy and Snappy run the clock at 1, Fast at 2, Instant
 *   at Infinity);
 * - `fastForward`: the fast-forward key is held (Right Shift), x3;
 * - `catchUp` and `queued`: when cards are queued, the clock runs x(1 + 0.2 * min(queued, 3)), so a
 *   long pile-up tops out at x1.6;
 * - `instant` and `multiplier`: the 189a inputs, kept so nothing built on them changes.
 *
 * INSTANT is not a big number, it is `Infinity`, and every consumer asks `isInstantSpeed` rather
 * than comparing against a threshold. Skipping animation has to skip the WAITS too (Temtem's "skip
 * animations" left its pauses in, and players hated it), and a finite stand-in would still leave
 * some. Instant beats everything else here: nothing is faster than "at once".
 */

import { type BattleSpeedTier, tierMultiplier } from './battleSpeedTiers';
import { INSTANT } from './instantSpeed';

export { INSTANT };

/** Hold the fast-forward key and the clock runs three times as fast (Henry, D2). */
export const FAST_FORWARD_MULTIPLIER = 3;
/** Each queued card adds this much speed... */
export const CATCH_UP_STEP = 0.2;
/** ...for up to this many cards, so the ceiling is x1.6. */
export const CATCH_UP_MAX_QUEUED = 3;

export interface SpeedInputs {
    /** Instant mode: every wait and play resolves at once. */
    readonly instant?: boolean;
    /** A finite, positive multiplier. When set it replaces the tier's. */
    readonly multiplier?: number;
    /** The player's battle speed (190a). */
    readonly tier?: BattleSpeedTier;
    /** The fast-forward key is held (190a). */
    readonly fastForward?: boolean;
    /** Catch-up is switched on (190a). */
    readonly catchUp?: boolean;
    /** How many cards are waiting behind the one playing (190a). */
    readonly queued?: number;
}

/** What the clock reads every frame. */
export type SpeedPolicy = () => number;

export const isInstantSpeed = (multiplier: number): boolean => !Number.isFinite(multiplier) && multiplier > 0;

/** The catch-up multiplier for a backlog: 1 when off or empty, up to 1.6 at three or more waiting. */
export function catchUpFactor(queued: number, enabled: boolean): number {
    if (!enabled || !Number.isFinite(queued) || queued <= 0) return 1;
    return 1 + CATCH_UP_STEP * Math.min(Math.floor(queued), CATCH_UP_MAX_QUEUED);
}

export function speedMultiplier(inputs: SpeedInputs = {}): number {
    if (inputs.instant) return INSTANT;
    const base = inputs.multiplier !== undefined && Number.isFinite(inputs.multiplier) && inputs.multiplier > 0
        ? inputs.multiplier
        : inputs.tier !== undefined ? tierMultiplier(inputs.tier) : 1;
    if (isInstantSpeed(base)) return INSTANT;

    const held = inputs.fastForward ? FAST_FORWARD_MULTIPLIER : 1;
    return base * held * catchUpFactor(inputs.queued ?? 0, inputs.catchUp ?? false);
}
