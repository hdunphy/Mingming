/**
 * TICKET 169a — the tier ladder, parsed once at load. See `tierSchema.ts` and `data/tiers.json`.
 *
 * Tiers stack: each row lists its whole state and never turns off what a lower row turned on
 * (`tierRegistry.test.ts` pins that). `tierRule` clamps, it does not extrapolate — ticket 60's rule,
 * kept — because a tier beyond the last row would be a scaling knob wearing a ladder's clothes.
 */

import raw from '../../data/tiers.json';
import { parseTiers } from './tierSchema';
import type { TierRule } from './tierSchema';

const FILE = parseTiers(raw);

export const TIERS: ReadonlyArray<TierRule> = FILE.tiers;

/** The last row's tier (3). Tier 0 is always open; this is the highest a run can be started at. */
export const MAX_TIER: number = TIERS[TIERS.length - 1].tier;

/** The row for `tier`, clamped to `0..MAX_TIER`. `tierRule(9)` is the top row; a negative is tier 0. */
export function tierRule(tier: number): TierRule {
    const clamped = Math.min(MAX_TIER, Math.max(0, Math.trunc(tier)));
    return TIERS[clamped];
}

/** The Driver gauntlet fights 1 and 2 carry at a tier with `leaderDriverEveryFight` (169c). */
export function leaderDriverFor(gymId: string): string | undefined {
    return FILE.leaderDrivers[gymId];
}
