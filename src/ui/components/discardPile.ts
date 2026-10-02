/**
 * What the discard viewer lists — Henry, 2026-09-25, off the Rootfall playtest.
 *
 * *"You should be able to see your cards when you click on discard if you need to see what the last
 * card did."* The pile was a count and nothing else. Kept out of the component so the order and the
 * text can be checked without rendering a stage — the same split `enemyHand.ts` makes.
 *
 * NEWEST FIRST, and not stacked. The question the player is asking is "what did I just play", so
 * the top row is the last card in, and two copies of Tackle are two rows because they were two
 * plays. `battleReducer` appends a resolved card to the END of the discard (and `discardHand`
 * appends the unplayed hand after it), so reversing the array is the whole of the ordering.
 */

import type { ProgramEntity } from '../../engine/types';
import { cardFace, type PileRow } from './pileRow';

/** A discard row keeps its instance id — two copies of one card are two rows with two keys. */
export interface DiscardRow extends PileRow {
    readonly id: string;
}

export function discardRows(discard: ReadonlyArray<ProgramEntity>): DiscardRow[] {
    return [...discard].reverse().map((card, index) => ({
        id: card.id,
        key: card.id,
        ...cardFace(card.dataId),
        // The top row is the answer to "what did I just play", so it is marked as such.
        ...(index === 0 ? { tag: 'last in', highlight: true } : {}),
    }));
}
