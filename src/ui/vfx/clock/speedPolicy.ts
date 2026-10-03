/**
 * THE SPEED POLICY — ticket 189a.
 *
 * One function that answers "how fast does the battle clock run?". In ticket 189 it answers 1.
 * Ticket 190a adds the five speed tiers, hold-to-fast-forward and catch-up as inputs to this same
 * function, so the clock, hit-stop and the driver never need to change again to learn about them.
 *
 * INSTANT is not a big number, it is `Infinity`, and every consumer asks `isInstantSpeed` rather
 * than comparing against a threshold. Skipping animation has to skip the WAITS too (Temtem's "skip
 * animations" left its pauses in, and players hated it), and a finite stand-in would still leave
 * some.
 */

/** The multiplier that means "resolve every wait and play at once". */
export const INSTANT = Number.POSITIVE_INFINITY;

export interface SpeedInputs {
    /** Instant mode: every wait and play resolves at once. */
    readonly instant?: boolean;
    /** A finite, positive multiplier. Ticket 190a feeds the tier here. */
    readonly multiplier?: number;
}

/** What the clock reads every frame. */
export type SpeedPolicy = () => number;

export const isInstantSpeed = (multiplier: number): boolean => !Number.isFinite(multiplier) && multiplier > 0;

export function speedMultiplier(inputs: SpeedInputs = {}): number {
    if (inputs.instant) return INSTANT;
    const m = inputs.multiplier;
    return m !== undefined && Number.isFinite(m) && m > 0 ? m : 1;
}
