/**
 * TICKET 184a — what the draw pile lists when you open it.
 *
 * Henry, 2026-10-01: *"You need to be able to see the draw cards like discard cards."*
 *
 * **NOT IN DRAW ORDER, on purpose (ruled 2026-10-01).** The pile's array IS the order the next
 * cards come off it, so listing it as it stands would tell the player their next draw. The list
 * answers "what is left in there", so it is sorted by cost, then name, and copies of one card are
 * one row with a count. Two piles holding the same cards in any order produce identical rows —
 * `drawPile.test.ts` shuffles the pile to prove it. The AI is held to the same rule (ticket 144a).
 */

import type { ProgramEntity } from '../../engine/types';
import { cardFace, type PileRow } from './pileRow';

export function drawPileRows(drawpile: ReadonlyArray<ProgramEntity>): PileRow[] {
    const counts = new Map<string, number>();
    for (const card of drawpile) counts.set(card.dataId, (counts.get(card.dataId) ?? 0) + 1);
    return [...counts.entries()]
        .map(([dataId, count]): PileRow => ({ key: dataId, ...cardFace(dataId), count }))
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name) || a.dataId.localeCompare(b.dataId));
}
