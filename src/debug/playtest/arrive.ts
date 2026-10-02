/**
 * TICKET 180 — WALKING ONTO A NODE, AND WHAT THE SCREEN DOES THE MOMENT THE PARTY ARRIVES.
 *
 * `RunScreen` reacts to arrival in four places, and this is each of them as one dispatch:
 * a fight node starts its battle (played here by the game's AI), a gym starts the gauntlet
 * (`beginGauntlet`), a market freezes its shelf for the team it was first seen with
 * (`MarketplaceNode`'s effect), and an event draws what it will offer (`EventNode`'s draw, kept for
 * the visit). Anything else simply becomes the current node.
 */
import { isFightNode } from '../../engine/run/encounter';
import { isMarketNode } from '../../engine/run/marketplace';
import { beginGauntlet, enterNode, freezeMarketParty } from '../../ui/store/runSlice';
import { arriveAtEvent } from './event/arrival';
import { playFightNode } from './fightFlow';
import { liveRanchParty } from './stalls';
import type { World } from './types';
import { runOf } from './types';

export function stepOnto(world: World, nodeId: string): void {
    world.store.dispatch(enterNode(nodeId));
    const node = runOf(world).nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (node.kind === 'gym') world.store.dispatch(beginGauntlet());
    else if (isFightNode(node.kind)) playFightNode(world, node);
    else if (isMarketNode(node.kind)) world.store.dispatch(freezeMarketParty({ nodeId, party: liveRanchParty(world) }));
    else if (node.kind === 'event') arriveAtEvent(world, node);
}
