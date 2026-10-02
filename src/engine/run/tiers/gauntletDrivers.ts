/**
 * TICKET 169c — which Drivers a gauntlet fight's enemy side carries.
 *
 * The boss fight (the third) has always carried the gym's signature Driver. At a tier whose row says
 * `leaderDriverEveryFight` (tier 3, "Leaders' Drivers"), fights 1 and 2 carry the leader's Driver
 * too, read from `tiers.json`'s `leaderDrivers` map. Drivers are content, so this changes how the
 * fights PLAY and never who is in them or what their numbers are.
 */

import type { IRunState } from '../../runTypes';
import { authoredBossFor } from '../bosses';
import { leaderDriverFor, tierRule } from './tierRegistry';

/** The Driver ids the enemy side carries into one gauntlet fight. Empty means none, not "unknown". */
export function gauntletDriversFor(run: IRunState, boss: boolean): string[] {
    if (boss) {
        const authored = authoredBossFor(run.gymId);
        return authored ? [authored.driver] : [];
    }
    if (!tierRule(run.tier).leaderDriverEveryFight) return [];
    const driver = leaderDriverFor(run.gymId);
    return driver ? [driver] : [];
}
