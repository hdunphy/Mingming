/**
 * TICKET 185e — **WHICH OF THE PARTY'S CURRENCIES HAVE NO PAYOFF IN THE RUN YET.**
 *
 * Henry's fallback for his own idea was *"check if you have all the payoffs for that OS's tuned
 * deck in your collection"*; the version built is the currency one he described, because it covers
 * every Strength payoff and not only the one in a tuned deck. A currency is MISSING when none of
 * the run's cards is a payoff of it. The run's cards are the active deck plus the collection (which
 * is where a benched member's engine waits), so a payoff you are holding for later still counts.
 *
 * The boost turns off the moment one such payoff is owned: the set simply loses that currency.
 *
 * One job: currencies and owned card ids in, the currencies still missing a payoff out.
 */
import { cardCurrencyOf, isPayoffCard } from './cardCurrency';

export function missingPayoffCurrencies(
    currencies: ReadonlySet<string>,
    ownedCardIds: ReadonlyArray<string>,
): ReadonlySet<string> {
    const covered = new Set<string>();
    for (const id of ownedCardIds) {
        if (!isPayoffCard(id)) continue;
        const currency = cardCurrencyOf(id);
        if (currency !== undefined) covered.add(currency);
    }
    return new Set([...currencies].filter((currency) => !covered.has(currency)));
}
