/**
 * TICKET 185f — **WHAT THE RUN SUMMARY SAYS A CLEAR UNLOCKED.**
 *
 * Clearing tier N unlocks tier N+1 (`unlockedTiers`), so the summary used to print the tier you had
 * just cleared as if it were the one you unlocked ("Rootfall cleared · tier 0 unlocked"). The line
 * is built here from the unlocked list rather than by arithmetic in the screen: the tier it names is
 * the lowest unlocked tier above the one cleared, and a clear at the top tier names none.
 *
 * One job: a gym name, the cleared tier and the ranch's unlocked tiers in, a sentence out.
 */
import { MAX_TIER } from './tierRegistry';

/** The tier this clear opened: the lowest unlocked tier above the cleared one, if any. */
export function tierUnlockedBy(clearedTier: number, unlocked: ReadonlyArray<number>): number | undefined {
    if (clearedTier >= MAX_TIER) return undefined;
    return [...unlocked].sort((a, b) => a - b).find((tier) => tier > clearedTier);
}

export function clearLine(gymName: string, clearedTier: number, unlocked: ReadonlyArray<number>): string {
    if (clearedTier >= MAX_TIER) return `${gymName} cleared · top tier`;
    const next = tierUnlockedBy(clearedTier, unlocked);
    return next === undefined ? `${gymName} cleared` : `${gymName} cleared · tier ${next} unlocked`;
}
