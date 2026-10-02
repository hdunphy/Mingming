import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { IBattleState } from '../../engine/types';

/**
 * TICKET 182b — does this card care how many cards were played this turn?
 *
 * A card says so in its own data: an action with `scaling: 'CARDS_PLAYED'` (Stampede, Serpent's
 * Coil, Seed Bomb v2) or a constraint of type `CARDS_PLAYED` (the "if you have played 3 cards"
 * conditions). Reading the serialised card finds both without knowing the action shapes, and the
 * result is cached because the top bar asks on every render.
 */
const cache = new Map<string, boolean>();

export function cardScalesWithCardsPlayed(dataId: string): boolean {
    let known = cache.get(dataId);
    if (known === undefined) {
        const data = ProgramRegistry[dataId];
        known = data !== undefined && JSON.stringify(data).includes('"CARDS_PLAYED"');
        cache.set(dataId, known);
    }
    return known;
}

/** True when any card the player owns this fight - in any pile - scales with cards played. */
export function deckScalesWithCardsPlayed(state: IBattleState): boolean {
    const { deck, hand, drawpile, discard, exhaust } = state.playerDeck;
    return [deck, hand, drawpile, discard, exhaust]
        // `deck` holds card ids (or entities, depending on where the state came from); the piles hold entities.
        .some((pile) => (pile ?? []).some((card) => cardScalesWithCardsPlayed(typeof card === 'string' ? card : card.dataId)));
}
