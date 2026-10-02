/**
 * TICKET 180a — A PLACE THE PLAYTESTER CANNOT PLAY YET.
 *
 * 180b builds the market and the workshop, 180c the events and the gym. Until a screen exists for a
 * node kind this one stands in for it, with the one move every place has: walk back out. 180c's test
 * asserts a whole run never lands here, which is the "no unknown screen" rule from the ticket.
 */
import type { Screen, World } from '../types';
import { runOf } from '../types';
import { nodeLabel } from '../gameText';

export const leftKey = (nodeId: string, visited: number): string => `${nodeId}:${visited}`;

export function unbuiltScreen(world: World): Screen {
    const run = runOf(world);
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return {
        id: 'unbuilt',
        body: [`${nodeLabel(node)}: the playtester has no screen for this place yet.`],
        moves: [{
            key: 'leave',
            label: 'Walk back out to the map',
            apply: (w) => { w.view.left = [...w.view.left, leftKey(node.id, node.visited)]; },
        }],
    };
}
