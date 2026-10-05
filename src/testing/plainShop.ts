/**
 * TICKET 176c — a plain `marketplace` or `workshop` node for a test that wants one.
 *
 * The map generator makes towns now (one node that is both buildings), so a generated run has no
 * plain shop. The old shop and workshop screens, reducers and tests are still supported as code
 * paths (a town is a shop and a workshop to all of them), and a test that is about the stall or the
 * bay itself, not about the map, takes the run's first town and calls it the building it needs.
 * Its id, biome and links are the town's own, so it sits on a real map.
 */
import type { IRegionNode, IRunState } from '../engine/runTypes';

export function plainShop(
    run: Pick<IRunState, 'nodes'>,
    kind: 'marketplace' | 'workshop',
): IRegionNode {
    const town = run.nodes.find((n) => n.kind === 'town');
    if (!town) throw new Error('plainShop: the run has no town to stand in');
    return { ...town, kind };
}

/**
 * The same, written into the run: the first town becomes a plain `marketplace` or `workshop` in
 * `nodes` itself, for a test whose screen reads the node back from the run by id.
 */
export function withPlainShop(run: IRunState, kind: 'marketplace' | 'workshop'): { run: IRunState; node: IRegionNode } {
    const node = plainShop(run, kind);
    return { run: { ...run, nodes: run.nodes.map((n) => (n.id === node.id ? node : n)) }, node };
}
