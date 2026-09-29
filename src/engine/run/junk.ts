/**
 * TICKET 168c — junk cards: the one place that says what one is and how a deck counts around them.
 *
 * Corrupted Data is a card that does nothing and costs 1 Energy to clear. It clogs a hand, and it is
 * never a card a run is offered, sold, scored or counted, so every rule that asks "how many real
 * cards" asks it through here.
 *
 * Engine module: no React, no Redux.
 */

import { ProgramRegistry } from '../data/programRegistry';
import { resolveProgramId } from '../data/programAliases';

/** The one junk card that ships. */
export const JUNK_CARD_ID = 'corrupted_data';

/** Whether a card id is a junk card. An unknown id is not. */
export function isJunkCard(dataId: string): boolean {
    return ProgramRegistry[resolveProgramId(dataId)]?.junk === true;
}

/** The cards of a deck that count toward the floor: everything but junk (168c rule 4). */
export function countedCards<T extends { readonly dataId: string }>(deck: ReadonlyArray<T>): T[] {
    return deck.filter((card) => !isJunkCard(card.dataId));
}

/** How many deck cards count toward `minimumActiveDeck`. */
export function countedDeckSize(deck: ReadonlyArray<{ readonly dataId: string }>): number {
    return countedCards(deck).length;
}
