/** TICKET 180c — an event's "pick one card" step (`CARD_PICK`): take it for the deck or send it to the collection. */
import { offerCards } from '../../../../engine/run/events/eventCards';
import type { Rarity } from '../../../../engine/types';
import { cardLine, cardName } from '../../gameText';
import type { Section } from '../../types';
import type { StepInput } from './stepInput';

export function cardPickStep({ ctx, outcome, slot, take }: StepInput): Section {
    if (outcome.type !== 'CARD_PICK') return { lines: [], moves: [] };
    const offer = offerCards(ctx, { count: outcome.count, rarities: outcome.rarities as Rarity[] }, slot);
    const lines = ['PICK ONE CARD:', ...offer.map((id) => `  ${cardLine(id)}`)];
    const moves = offer.flatMap((cardId) => [
        { key: `event:take:${cardId}`, label: `Take ${cardName(cardId)} into the deck`, apply: () => take({ cardId, toCollection: false }) },
        { key: `event:store:${cardId}`, label: `Send ${cardName(cardId)} to the collection`, apply: () => take({ cardId, toCollection: true }) },
    ]);
    return { lines, moves };
}
