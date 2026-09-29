/**
 * TICKET 168c — what the deck-floor pill prints: the cards that COUNT, the floor, and how many junk
 * cards sit beside them. Junk never counts toward the floor, so a pill that printed `deck.length`
 * would show "9 / floor 8" for a deck that is really at 8 and refuses to shed a card.
 */

import { minimumActiveDeck } from '../../engine/run/createRun';
import { countedDeckSize } from '../../engine/run/junk';
import type { IRunState } from '../../engine/runTypes';

export interface DeckFloorReading {
    readonly counted: number;
    readonly junk: number;
    readonly floor: number;
    readonly atFloor: boolean;
}

export function readDeckFloor(run: Pick<IRunState, 'deck' | 'partyIds'>): DeckFloorReading {
    const counted = countedDeckSize(run.deck);
    const floor = minimumActiveDeck(run.partyIds.length);
    return { counted, junk: run.deck.length - counted, floor, atFloor: counted <= floor };
}

/** " · +2 junk", or nothing. */
export function junkNote(reading: DeckFloorReading): string {
    return reading.junk > 0 ? ` · +${reading.junk} junk` : '';
}
