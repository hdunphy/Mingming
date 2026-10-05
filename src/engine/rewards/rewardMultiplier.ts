/**
 * TICKET 185e — **HOW MUCH MORE LIKELY A CARD IS TO BE OFFERED, GIVEN WHO IS PLAYING IT.**
 *
 * Three cases, never stacked:
 *
 *   - a PAYOFF of a currency the party runs on and the run holds no payoff for → the missing-payoff
 *     multiplier (×3 as ruled), INSTEAD of the synergy one;
 *   - any other card of a currency the party runs on (an enabler, or a payoff the run already has
 *     company for) → the synergy multiplier (×2);
 *   - everything else → 1.
 *
 * The two numbers are the caller's, not this file's: they are named constants beside
 * `RARITY_WEIGHTS` so a retune after play touches one line, and passing them in keeps this file from
 * importing the reward system that imports it.
 *
 * One job: a card id and a situation in, a number out.
 */
import { cardCurrencyOf, isPayoffCard } from './cardCurrency';

export interface RewardSituation {
    /** The currencies the party's firmware run on (`partyCurrencies`). */
    readonly currencies: ReadonlySet<string>;
    /** The subset of them the run has no payoff for yet (`missingPayoffCurrencies`). */
    readonly missing: ReadonlySet<string>;
}

export interface RewardMultipliers {
    readonly synergy: number;
    readonly missingPayoff: number;
}

export function rewardMultiplierFor(
    cardId: string,
    situation: RewardSituation,
    multipliers: RewardMultipliers,
): number {
    const currency = cardCurrencyOf(cardId);
    if (currency === undefined || !situation.currencies.has(currency)) return 1;
    if (situation.missing.has(currency) && isPayoffCard(cardId)) return multipliers.missingPayoff;
    return multipliers.synergy;
}

/** The situation nobody is playing: every card weighs what its rarity says and no more. */
export const NEUTRAL_SITUATION: RewardSituation = { currencies: new Set(), missing: new Set() };
