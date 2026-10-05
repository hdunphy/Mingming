/**
 * TICKET 184b — **A BURN OVERFLOW SAYS "OVERFLOW", NEVER A NEGATIVE NUMBER.**
 *
 * Henry, 2026-10-01: *"When burn overflows it says -2 burn or -3 burn which is confusing. We need
 * to make it say something like overflow +2 or overflow|+2 burn, for the situation when you have 2
 * burn and add 4 burn."* Ruled the same day: `OVERFLOW · 2 BURN` — the word says the pile went off,
 * the number is the pile left behind.
 *
 * Burn caps at 4. Pushing past it detonates (14% of max HP) and the cap comes off the pile, so the
 * pile SHRINKS while Burn is being added. The hover preview diffed the pile — 4 + 2 leaves 2, which
 * read "-2 BURN", and 2 + 4 leaves 2, which read nothing at all. The engine now marks the
 * detonation (`IDamageRecord.overflow`, `StatusAppliedEvent.overflowRemaining`); this module turns
 * that mark into words, once, for the preview chip and the battle float alike.
 */

import { displayStacks } from '../components/displayStacks';

/** One status chip on the hover preview. `overflow` is set when the pile went off: what is left. */
export interface StatusChange {
    readonly status: string;
    readonly delta: number;
    readonly overflow?: number;
}

/** The words, shared by the preview chip and the float: `OVERFLOW · 2 BURN`. */
export function overflowText(status: string, remaining: number): string {
    const name = String(status).replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
    return `OVERFLOW · ${Math.max(0, Math.round(remaining))} ${name}`;
}

/** A preview chip's text: the overflow wording, or a signed stack change (`+2 POISON`). */
export function statusChipText(change: StatusChange): string {
    if (change.overflow !== undefined) return overflowText(change.status, change.overflow);
    // 194c: through `displayStacks`, so a fractional Bark Shield never prints `4.00000001`.
    const delta = displayStacks(change.delta);
    return `${delta > 0 ? '+' : ''}${delta} ${change.status.toUpperCase()}`;
}

/**
 * Replace the diffed chip of every status that went off with an overflow chip carrying the pile
 * that is left (`after`). A status that overflowed is listed even when its pile ends where it
 * started (2 + 4 detonates and leaves 2), which the plain diff dropped. Overflows come first: a
 * detonation is the most important thing the card does to this status.
 */
export function withOverflows(
    changes: ReadonlyArray<StatusChange>,
    overflowed: ReadonlySet<string>,
    after: Readonly<Record<string, number>>,
    before: Readonly<Record<string, number>>,
): StatusChange[] {
    if (overflowed.size === 0) return [...changes];
    const flagged: StatusChange[] = [...overflowed].map((status) => ({
        status,
        delta: (after[status] ?? 0) - (before[status] ?? 0),
        overflow: after[status] ?? 0,
    }));
    return [...flagged, ...changes.filter((change) => !overflowed.has(change.status))];
}

/**
 * The pile a float should report after one more STATUS_APPLIED in the same burst, or undefined
 * while nothing has gone off. A detonation reports its own leftover; stacks that land AFTER a
 * detonation in the same burst sit on top of that leftover.
 */
export function nextOverflowRemaining(
    previous: number | undefined,
    eventStacks: number,
    eventOverflowRemaining: number | undefined,
): number | undefined {
    if (eventOverflowRemaining !== undefined) return eventOverflowRemaining;
    return previous === undefined ? undefined : previous + eventStacks;
}
