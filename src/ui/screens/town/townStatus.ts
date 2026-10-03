/**
 * TICKET 176c — small reads of the run that the town screen prints. Pure, so a test can pin them.
 */
import { upgradeAllowanceFor, upgradeBenchKeyFor } from '../../../engine/run/marketplace';
import type { IRegionNode, IRunState, TownTab } from '../../../engine/runTypes';

/** Upgrades this town visit can still buy. */
export function upgradesLeftAt(run: IRunState, node: IRegionNode): number {
    const key = upgradeBenchKeyFor(node);
    const used = (run.upgradesTaken ?? []).filter((taken) => taken === key).length;
    return Math.max(0, upgradeAllowanceFor(node) - used);
}

/** The tab the run has open on this town; any other town (or none) reads as the square. */
export function townTabOf(run: IRunState, nodeId: string): TownTab {
    return run.townTab?.nodeId === nodeId ? run.townTab.tab : 'square';
}
