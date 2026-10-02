/**
 * TICKET 180b — small helpers the stall screens (market, workshop, benches) share.
 */
import type { PayloadAction } from '@reduxjs/toolkit';

import { withEffectiveOS } from '../../engine/run/effectiveOS';
import type { IRanchMember, IRunCard, IRegionNode } from '../../engine/runTypes';
import type { World } from './types';
import { runOf } from './types';

/** `RunScreen`'s `stallOpen`: a stall is open unless it is the one the player last walked out of. */
export const stallOpen = (world: World, node: IRegionNode): boolean => world.view.closedStall !== node.id;

/**
 * Dispatch one of the game's own actions and say so when it changed nothing.
 *
 * The run slice refuses by returning its state untouched (it has no error channel), so a move that
 * was listed as legal and then did nothing is a disagreement between the screen's eligibility check
 * and the reducer's. That is worth a line in the news, and 180e's invariants count it.
 */
export function dispatchChecked(world: World, action: PayloadAction<unknown>, what: string): boolean {
    const before = world.store.getState().run.run;
    world.store.dispatch(action);
    const changed = world.store.getState().run.run !== before;
    if (!changed) world.view.news.push(`Nothing happened (${what}).`);
    return changed;
}

/** One entry per unique card, insertion-ordered: the screens' "one tile per unique card". */
export function groupByData<T extends { readonly dataId: string }>(
    cards: ReadonlyArray<T>,
): Array<{ readonly dataId: string; readonly instances: T[] }> {
    const byData = new Map<string, T[]>();
    for (const card of cards) {
        const held = byData.get(card.dataId);
        if (held) held.push(card);
        else byData.set(card.dataId, [card]);
    }
    return [...byData.entries()].map(([dataId, instances]) => ({ dataId, instances }));
}

/** `N short` when a price is out of reach, '' when it is affordable. */
export const shortBy = (world: World, price: number): number => Math.max(0, price - runOf(world).scrap);

export const priceNote = (world: World, price: number): string => {
    const short = shortBy(world, price);
    return short > 0 ? `${price} scrap, ${short} short` : `${price} scrap`;
};

export const ownedCards = (world: World): ReadonlyArray<IRunCard> => {
    const run = runOf(world);
    return [...run.deck, ...(run.collection ?? [])];
};

/** The party as the shop rolls for it: roster members on the firmware they run this run (`RunScreen`'s `marketParty`). */
export const liveRanchParty = (world: World): IRanchMember[] => {
    const run = runOf(world);
    const { roster } = world.store.getState().game;
    return run.partyIds
        .map((id) => roster.find((m) => m.id === id))
        .filter((m): m is IRanchMember => m !== undefined)
        .map((m) => withEffectiveOS(run, m));
};

/** The node the party stands on. */
export const hereNode = (world: World): IRegionNode => {
    const run = runOf(world);
    return run.nodes.find((n) => n.id === run.currentNodeId)!;
};

/** Walk out of the stall: `RunScreen`'s `setClosedNodeId(current.id)`. The node is not spent. */
export const leaveStall = (world: World): void => { world.view.closedStall = hereNode(world).id; };
