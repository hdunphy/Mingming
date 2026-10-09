/**
 * TICKET 196a — THE DECK'S MAIN ELEMENT when a card reward was offered.
 *
 * The element most of the deck's elemental cards share. Cards with no element (`None`) are not counted, and a
 * tie has no main element, so a deck split evenly between Fire and Water matches neither. Counting only.
 */
import { GetProgramData } from '../../../engine/data/programRegistry';

export const NO_ELEMENT = 'None';

export function mainElementOf(deck: ReadonlyArray<{ readonly dataId: string }>): string | undefined {
    const counts = new Map<string, number>();
    for (const card of deck) {
        const element = GetProgramData(card.dataId)?.element ?? NO_ELEMENT;
        if (element !== NO_ELEMENT) counts.set(element, (counts.get(element) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0 || (ranked.length > 1 && ranked[0][1] === ranked[1][1])) return undefined;
    return ranked[0][0];
}
