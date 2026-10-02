/**
 * TICKET 168e — the outcomes that move cards: give up, trade up, duplicate, recompile.
 *
 * One small function each, all through reducers that already exist. A card is removed through
 * `sellRunCard` at price 0 (spent, not sold), so the deck floor is enforced by the reducer and not
 * only by the picker.
 *
 * ORDER inside a swap: the new card is added FIRST and the old one removed after. A crash between
 * the two leaves the player with both, not neither — the codebase's "generous state" rule.
 */

import { nodeSeed } from '../../engine/run/nodeSeed';
import { SeedStream } from '../../engine/core/SeedStream';
import { recompileTarget, tradeUpTarget } from '../../engine/run/events/eventTrade';
import type { IRunCard } from '../../engine/runTypes';
import {
    addRunCards, addRunCollection, buyMarketCard, sellRunCard, spendRunScrap,
} from '../store/runSlice';
import type { OutcomeContext, OutcomeDispatch } from './applyOutcome';

/** The held card with this instance id, and which pile it sits in. */
export function findHeld(ctx: OutcomeContext, instanceId: string): { card: IRunCard; inDeck: boolean } | null {
    const inDeck = ctx.run.deck.find((card) => card.instanceId === instanceId);
    if (inDeck) return { card: inDeck, inDeck: true };
    const inCollection = (ctx.run.collection ?? []).find((card) => card.instanceId === instanceId);
    return inCollection ? { card: inCollection, inDeck: false } : null;
}

function mint(ctx: OutcomeContext, purpose: string, prefix: string): string {
    return new SeedStream(nodeSeed(ctx.run, ctx.node, purpose)).nextId(prefix);
}

/** `GIVE_CARD`: each chosen card leaves the run at price 0. */
export function applyGiveCards(dispatch: OutcomeDispatch, instanceIds: ReadonlyArray<string>): void {
    for (const instanceId of instanceIds) dispatch(sellRunCard({ instanceId, price: 0 }));
}

/** A new card into the pile the old one was in. */
function addLike(dispatch: OutcomeDispatch, inDeck: boolean, card: IRunCard): void {
    dispatch(inDeck ? addRunCards([card]) : addRunCollection([card]));
}

/** `TRADE_UP` (Trader): the given card is swapped for one a rarity higher. */
export function applyTradeUp(dispatch: OutcomeDispatch, ctx: OutcomeContext, instanceId: string): void {
    const held = findHeld(ctx, instanceId);
    if (!held) return;
    const target = tradeUpTarget({ ...ctx, ranch: ctx.ranch ?? { roster: [], blueprints: {} } }, held.card);
    if (target === null) return;
    addLike(dispatch, held.inDeck, { instanceId: mint(ctx, 'event-trade', 'trd'), dataId: target, ownerId: null });
    dispatch(sellRunCard({ instanceId, price: 0 }));
}

/** `TRANSFORM` (Recompiler): the given card is swapped for another of its element and rarity. */
export function applyTransform(dispatch: OutcomeDispatch, ctx: OutcomeContext, instanceId: string): void {
    const held = findHeld(ctx, instanceId);
    if (!held) return;
    const target = recompileTarget({ ...ctx, ranch: ctx.ranch ?? { roster: [], blueprints: {} } }, held.card);
    if (target === null) return;
    addLike(dispatch, held.inDeck, { instanceId: mint(ctx, 'event-recompile', 'rcp'), dataId: target, ownerId: null });
    dispatch(sellRunCard({ instanceId, price: 0 }));
}

/**
 * `DUPLICATE` (Mirror Protocol): an exact copy — same card, same upgrade — into the pile the
 * original is in. A copy into the deck rides ONE action with its price (`buyMarketCard`); a copy
 * into the collection is added first and the price taken after.
 */
export function applyDuplicate(dispatch: OutcomeDispatch, ctx: OutcomeContext, instanceId: string, price: number): void {
    const held = findHeld(ctx, instanceId);
    if (!held) return;
    const copy: IRunCard = {
        instanceId: mint(ctx, 'event-copy', 'cpy'),
        dataId: held.card.dataId,
        ownerId: held.card.ownerId,
        ...(held.card.upgraded === true ? { upgraded: true as const } : {}),
    };
    if (price > 0 && held.inDeck) { dispatch(buyMarketCard({ card: copy, price })); return; }
    addLike(dispatch, held.inDeck, copy);
    if (price > 0) dispatch(spendRunScrap(price));
}
