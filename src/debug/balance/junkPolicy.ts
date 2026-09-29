/**
 * TICKET 168c — the walker's shop rule for junk: clear what it can afford to, one card at a time.
 *
 * A pure function over the deck and the scrap, so the rule is testable without walking a whole run.
 */

import { JUNK_REMOVAL_PRICE } from '../../engine/run/marketplace';
import { isJunkCard } from '../../engine/run/junk';
import type { IRunCard } from '../../engine/runTypes';

/** The junk cards, in deck order, that `scrap` pays to remove. Removal is never floor-blocked. */
export function junkToRemove(
    deck: readonly IRunCard[],
    scrap: number,
    /** TICKET 169j: what one removal costs. Tight Budget raises it; the default is the shop's plain price. */
    price: number = JUNK_REMOVAL_PRICE,
): string[] {
    const affordable = Math.max(0, Math.floor(scrap / price));
    return deck.filter((card) => isJunkCard(card.dataId)).slice(0, affordable).map((card) => card.instanceId);
}
