/**
 * TICKET 168a — the cards an event offers: `count` DISTINCT cards from a pool, each one rolled the
 * way a fight reward rolls (`RewardSystem.rollCardFromPool`): a rarity by weight, then a card of
 * that rarity. The difference is that the rarities are RESTRICTED to the ones the event names
 * (Scattered Verses offers Common or Uncommon; the Dragon's Barrow only Rare), and the three are distinct.
 *
 * Seeded by the caller's stream, so the same node offers the same three cards on resume.
 */

import { ProgramRegistry } from '../../data/programRegistry';
import { RARITY_WEIGHTS, offerTasteForRun, rarityOfCard, rewardCardPool } from '../../RewardSystem';
import { drawOffer } from '../../rewards/offerDraw';
import { candidatesAfterRecent } from '../../rewards/recentOffers';
import { NO_TASTE, type OfferTaste } from '../../rewards/offerTaste';
import { ownedCardIdsOf } from '../../rewards/ownedCards';
import { SeedStream } from '../../core/SeedStream';
import { nodeSeed } from '../nodeSeed';
import { partyMembersOf } from './eventContext';
import type { EventContext } from './eventContext';
import type { Rarity } from '../../types';

export function rollCardChoices(
    pool: ReadonlyArray<string>,
    rarities: ReadonlyArray<Rarity>,
    count: number,
    stream: SeedStream,
    /** Ticket 185e: the run's multipliers and recently shown cards. Omitted means a plain draw. */
    taste: OfferTaste = NO_TASTE,
): string[] {
    const allowed = pool.filter((id) => rarities.includes(ProgramRegistry[id]?.rarity as Rarity));

    // Ticket 185e: ONE weighted draw per slot, over the cards the last two picks did not just show
    // (let back in, oldest first, only if that would leave fewer than `count`). Only rarities that
    // still have a card left are rolled (`liveOnly`), exactly as before.
    return drawOffer({
        candidates: candidatesAfterRecent(allowed, taste.recent, count),
        count,
        rarityOf: rarityOfCard,
        rarityWeights: RARITY_WEIGHTS,
        multiplierOf: taste.multiplierOf,
        rule: 'liveOnly',
        nextU: () => stream.next(),
    });
}

/**
 * The three cards a `CARD_PICK` outcome offers on this node: the party's reward pool, restricted to
 * the outcome's rarities. `slot` is the outcome's index in its choice, so a choice with two picks
 * (or two choices with one each) draws from separate streams.
 */
export function offerCards(
    ctx: EventContext,
    outcome: { readonly count: number; readonly rarities: ReadonlyArray<Rarity> },
    slot: string,
): string[] {
    const stream = new SeedStream(new SeedStream(nodeSeed(ctx.run, ctx.node, 'event-offer')).fork(slot));
    const party = partyMembersOf(ctx);
    const taste = offerTasteForRun(party, ownedCardIdsOf(ctx.run), ctx.run.recentOffers ?? []);
    return rollCardChoices(rewardCardPool(party), outcome.rarities, outcome.count, stream, taste);
}
