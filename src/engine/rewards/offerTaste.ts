/**
 * TICKET 185e — **EVERYTHING ABOUT THE RUN THAT BENDS AN OFFER, IN ONE VALUE.**
 *
 * A fight reward and an event pick both need the same two things from the run: how much more a
 * card weighs for this party and what it holds (`multiplierOf`), and which cards were just shown
 * (`recent`). Bundling them is what lets both callers take one extra argument.
 *
 * One job: a party, the run's cards and its recent offers in, a taste out.
 */
import { partyCurrencies } from './partyCurrencies';
import { missingPayoffCurrencies } from './missingPayoffs';
import { rewardMultiplierFor, type RewardMultipliers } from './rewardMultiplier';

export interface OfferTaste {
    readonly multiplierOf: (cardId: string) => number;
    /** One array of shown card ids per recent pick, oldest first. */
    readonly recent: ReadonlyArray<ReadonlyArray<string>>;
}

/** No party bias and nothing recent: every card weighs what its rarity says. */
export const NO_TASTE: OfferTaste = { multiplierOf: () => 1, recent: [] };

export function offerTasteFor(
    party: ReadonlyArray<{ readonly activeOS?: string }>,
    ownedCardIds: ReadonlyArray<string>,
    recent: ReadonlyArray<ReadonlyArray<string>>,
    multipliers: RewardMultipliers,
): OfferTaste {
    const currencies = partyCurrencies(party);
    const missing = missingPayoffCurrencies(currencies, ownedCardIds);
    return {
        multiplierOf: (cardId) => rewardMultiplierFor(cardId, { currencies, missing }, multipliers),
        recent,
    };
}
