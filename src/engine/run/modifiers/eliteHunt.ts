/**
 * TICKET 169f — Elite Hunt: every rival is an elite.
 *
 * Default D6: rivals are removed entirely, so the path species (ticket 142a) can only be met at the
 * scout or recruited from blueprints. That is the modifier's cost. The scout is already an elite and
 * is not touched. Run it before the Driver stakes are dealt, so a converted node pays a Driver.
 */

import type { IRegionNode } from '../../runTypes';

/** The same nodes, with every rival turned into an elite. Pure: returns new nodes, mutates nothing. */
export function applyEliteHunt(nodes: ReadonlyArray<IRegionNode>): ReadonlyArray<IRegionNode> {
    return nodes.map((node) => (node.kind === 'rival' ? { ...node, kind: 'elite' as const } : node));
}
