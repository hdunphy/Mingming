/**
 * TICKET 185e — **DRAW AN OFFER: DISTINCT CARDS, ONE WEIGHTED DRAW EACH.**
 *
 * Two callers draw offers (a fight's pick-1-of-3, an event's card pick) and they differ in exactly
 * one respect, which is what the `rule` says:
 *
 *   - `fallToCommon` (a fight): the weights are worked out ONCE for the candidates and each later
 *     card is drawn from what is left, renormalised. That is the same distribution as the old
 *     "reroll until it is not a repeat".
 *   - `liveOnly` (an event): the weights are worked out again for the cards still left before each
 *     slot, which is what the old event draw did by only ever rolling rarities that still had a card.
 *
 * `nextU` hands back a number in `[0, 1)`; the caller owns the stream, so a fight's seed chain and an
 * event's `SeedStream` both drive this.
 */
import type { Rarity } from '../types';
import { pickByWeight, weighCandidates, type CandidateWeight, type EmptyTierRule } from './weightedCardPick';

export interface OfferDrawInput {
    readonly candidates: ReadonlyArray<string>;
    readonly count: number;
    readonly rarityOf: (cardId: string) => Rarity | undefined;
    readonly rarityWeights: Readonly<Record<Rarity, number>>;
    readonly multiplierOf: (cardId: string) => number;
    readonly rule: EmptyTierRule;
    readonly nextU: () => number;
}

export function drawOffer(input: OfferDrawInput): string[] {
    const { candidates, count, rarityOf, rarityWeights, multiplierOf, rule, nextU } = input;
    const weigh = (ids: ReadonlyArray<string>) => weighCandidates(ids, rarityOf, rarityWeights, multiplierOf, rule);

    const chosen: string[] = [];
    let weighted: CandidateWeight[] = weigh(candidates);
    while (chosen.length < count && weighted.length > 0) {
        const cardId = pickByWeight(weighted, nextU());
        chosen.push(cardId);
        weighted = rule === 'liveOnly'
            ? weigh(candidates.filter((id) => !chosen.includes(id)))
            : weighted.filter((entry) => entry.cardId !== cardId);
    }
    return chosen;
}
