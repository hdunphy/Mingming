/**
 * TICKET 176b — travel is one-way now, so `enterNode` only walks to an unvisited node the current
 * node links to. A test that wants to step onto a distant node (the gym, a shop) first stands the
 * run on a node that links to it, and clears the target's visits so the step is a first entry.
 */
import type { IRunState } from '../engine/runTypes';

export function standBeside(run: IRunState, targetId: string): IRunState {
    const before = run.nodes.find((n) => n.edges.includes(targetId));
    if (!before) throw new Error(`standBeside: nothing links to ${targetId}`);
    return {
        ...run,
        currentNodeId: before.id,
        nodes: run.nodes.map((n) => (n.id === targetId ? { ...n, visited: 0 } : n)),
    };
}
