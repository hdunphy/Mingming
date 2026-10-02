/**
 * TICKET 169c — the words the run-start screen prints about a tier, kept out of the component so a
 * test can read them without rendering anything.
 */

import { TIERS, tierRule } from './tierRegistry';

/** The first tier whose row makes the leader's Driver active in every gauntlet fight (3 today). */
const LEADER_DRIVER_TIER = TIERS.find((row) => row.leaderDriverEveryFight)?.tier;

/**
 * The extra line printed under the gym's signature Driver on the offer screen, or null when the
 * selected tier does not put that Driver in fights 1 and 2. Printed as written by Henry's ticket:
 * "Tier 3: active in all three gauntlet fights."
 */
export function leaderDriverTierLine(selectedTier: number): string | null {
    if (LEADER_DRIVER_TIER === undefined || !tierRule(selectedTier).leaderDriverEveryFight) return null;
    return `Tier ${LEADER_DRIVER_TIER}: active in all three gauntlet fights.`;
}
