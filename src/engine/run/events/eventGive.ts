/**
 * TICKET 168e — the cards an event may take from the player ("give up a card"), and the floor.
 *
 * Rule 7: a card given up can come from the deck or the run collection, but a deck card cannot go
 * if that would drop the deck below `minimumActiveDeck(partySize)` — the same rule `sellRunCard`
 * enforces. Junk never counts toward the floor (168c) and is never given up: it is removed for a
 * price at the shop. Pure functions over the run; no dispatch here.
 */

import { ProgramRegistry } from '../../data/programRegistry';
import { resolveProgramId } from '../../data/programAliases';
import type { IRunCard, IRunState } from '../../runTypes';
import { minimumActiveDeck } from '../createRun';
import { countedDeckSize, isJunkCard } from '../junk';

export type CardPile = 'deck' | 'collection';

export interface GiveRow {
    readonly card: IRunCard;
    readonly pile: CardPile;
}

/** The printed rarity of a card, resolving the v1 spellings; a `+` card reads as its own entry. */
export function rarityOf(card: Pick<IRunCard, 'dataId'>): string | undefined {
    return ProgramRegistry[resolveProgramId(card.dataId)]?.rarity ?? ProgramRegistry[card.dataId]?.rarity;
}

/** How many deck cards can go before the deck hits its floor. */
export function deckSpare(run: IRunState): number {
    return Math.max(0, countedDeckSize(run.deck) - minimumActiveDeck(run.partyIds.length));
}

/** Every non-junk card the player holds, deck first, optionally only one rarity. */
export function heldCards(run: IRunState, rarity?: string): GiveRow[] {
    const rows: GiveRow[] = [
        ...run.deck.map((card): GiveRow => ({ card, pile: 'deck' })),
        ...(run.collection ?? []).map((card): GiveRow => ({ card, pile: 'collection' })),
    ];
    return rows.filter((row) => !isJunkCard(row.card.dataId) && (rarity === undefined || rarityOf(row.card) === rarity));
}

/**
 * Whether `count` cards (of `rarity`, when named) can be given up right now: every collection card
 * can, and deck cards only as far as the floor allows.
 */
export function canGive(run: IRunState, count: number, rarity?: string): boolean {
    const rows = heldCards(run, rarity);
    const fromDeck = rows.filter((row) => row.pile === 'deck').length;
    const fromCollection = rows.length - fromDeck;
    return fromCollection + Math.min(fromDeck, deckSpare(run)) >= count;
}

/**
 * Whether a deck card can be added to a selection of `selectedDeckCards` others without breaking
 * the floor. A collection card is never blocked.
 */
export function deckCardStillGivable(run: IRunState, selectedDeckCards: number): boolean {
    return selectedDeckCards < deckSpare(run);
}
