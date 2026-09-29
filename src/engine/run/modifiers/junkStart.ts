/**
 * TICKET 169f — Junk Start: the cards it adds to the starting deck.
 *
 * Minted AFTER the normal starting deck, from the same stream, so every other card's instance id is
 * exactly what it was without the modifier. They belong to no member (`ownerId: null`), as the junk
 * an event hands out does (`applyJunk` in `ui/events/applyOutcome.ts`).
 */

import type { SeedStream } from '../../core/SeedStream';
import type { IRunCard, IRunState } from '../../runTypes';
import { JUNK_CARD_ID } from '../junk';
import { hasModifier, modifierNumber } from './modifierRegistry';

/** The junk cards Junk Start adds, or none when the run does not have it. */
export function junkStartCards(run: Pick<IRunState, 'modifiers'>, deckStream: SeedStream): IRunCard[] {
    if (!hasModifier(run, 'junk_start')) return [];
    return Array.from({ length: modifierNumber('junk_start', 'junkCount') }, (): IRunCard => ({
        instanceId: deckStream.nextId('card'),
        dataId: JUNK_CARD_ID,
        ownerId: null,
    }));
}
