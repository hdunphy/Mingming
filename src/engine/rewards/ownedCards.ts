/**
 * TICKET 185e — **THE CARDS A RUN HOLDS: DECK PLUS COLLECTION.**
 *
 * The missing-payoff multiplier asks whether the run owns a payoff for a currency. A payoff parked
 * in the collection (a benched member's engine, a card taken to play later) is owned, so both halves
 * count. An upgraded copy's `dataId` is its `+` id; `cardCurrency` reads through that.
 *
 * One job: a run in, the data ids it holds out.
 */
import type { IRunState } from '../runTypes';

export function ownedCardIdsOf(run: Pick<IRunState, 'deck' | 'collection'>): string[] {
    return [...run.deck, ...(run.collection ?? [])].map((card) => card.dataId);
}
