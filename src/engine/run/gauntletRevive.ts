/**
 * TICKET 202b — **A DOWNED MEMBER COMES BACK BETWEEN GAUNTLET FIGHTS.**
 *
 * Ticket 173a made every member still standing repair 30% between fights and left a member at 0 at 0
 * ("Revive is how the fallen come back"). The 2026-10-06 night showed the cost: all three party runs
 * that lost, lost fight 3, the boss, after arriving with members already down (r22 with two of three
 * down, 536 HP on the third, and it lost in one turn). Henry, 2026-10-07: *"Add a revive between
 * fights."* On whether to reshape the gauntlet: *"I think it's good for the first run to be hard."*
 * So the gauntlet stays three fights, and a downed member is revived for the next one.
 *
 * This module sits beside `gauntletHeal.ts` and composes with it: a standing member is repaired by
 * `healBetweenFights`, exactly as before; a downed member is revived at `GAUNTLET_REVIVE_PERCENT` of
 * its max HP. Only the gauntlet asks for this. The Revive Draught and every other path are untouched,
 * and a member who is down at the END of the whole gauntlet stays down for the run summary.
 *
 * The amount is printed on the pit stop ("revived at 30%", "repaired 30%"), so none of it is hidden
 * math.
 */
import { healBetweenFights } from './gauntletHeal';

/**
 * Percent of max HP a downed member is revived at between gauntlet fights (decision D1, proposed 30%,
 * Henry's to confirm after the walker's before-and-after). Numbers move in 5s.
 */
export const GAUNTLET_REVIVE_PERCENT = 30;

/** What happened to one member between two gauntlet fights. */
export interface BetweenFightsResult {
    /** HP going into the next fight. */
    readonly hp: number;
    /** HP the repair gave a member who was standing (0 for anyone else). */
    readonly healed: number;
    /** True when the member was down and is back on their feet. */
    readonly revived: boolean;
}

/**
 * HP after the between-fights settle. A standing member is repaired; a downed member (HP 0) is revived
 * at the floor, rounded down like the repair, and never at less than 1 so a revive always stands. A
 * member with no max HP has nothing to revive and stays at 0.
 */
export function settleBetweenFights(hp: number, maxHp: number): BetweenFightsResult {
    if (hp > 0) {
        const repair = healBetweenFights(hp, maxHp);
        return { hp: repair.hp, healed: repair.healed, revived: false };
    }
    if (maxHp <= 0) return { hp: 0, healed: 0, revived: false };
    const floor = Math.max(1, Math.floor((maxHp * GAUNTLET_REVIVE_PERCENT) / 100));
    return { hp: Math.min(maxHp, floor), healed: 0, revived: true };
}
