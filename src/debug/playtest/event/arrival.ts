/**
 * TICKET 180c — AN EVENT, ON ARRIVAL.
 *
 * `EventNode` draws what the node offers the first time it renders for a visit and holds the draw
 * in a ref, because a draw reads the run and the run changes while a choice is being made. This is
 * that draw, made when the party steps onto the node and kept in the view for the visit. A node
 * whose event is already spent draws nothing: it shows the dark relay.
 */
import { drawEvent } from '../../../engine/run/events/eventDraw';
import type { EventContext } from '../../../engine/run/events/eventContext';
import { eventResolvedAt } from '../../../engine/run/events/eventState';
import type { IRegionNode } from '../../../engine/runTypes';
import type { World } from '../types';
import { runOf } from '../types';

export const visitKeyOf = (node: IRegionNode): string => `${node.id}:${node.visited}`;

/** The context every event helper takes: the run, the node, and the ranch (roster and blueprints). */
export const eventContextOf = (world: World, node: IRegionNode): EventContext => ({
    run: runOf(world), node, ranch: world.store.getState().game,
});

export function arriveAtEvent(world: World, node: IRegionNode): void {
    const run = runOf(world);
    if (eventResolvedAt(run, node.id)) { world.view.event = null; return; }
    world.view.event = {
        visitKey: visitKeyOf(node),
        event: drawEvent(run, node, world.store.getState().game),
        choiceId: null, outcomeIndex: 0, picks: {}, selected: [], upgrading: false,
    };
}
