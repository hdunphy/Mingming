/**
 * TICKET 185e — **WHAT A CARD IS FOR, READ FROM THE REGISTRY.**
 *
 * Henry (2026-10-02): payoff cards should be more likely to show up *"if you don't have a payoff
 * for your deck 'currency'"*. That needs two facts about every card: which currency it feeds or
 * spends (`cur`), and whether it PAYS that currency out (`shape`: a `scalar` or `consume` card).
 * Both were in the design record and neither was in the game; they are on the card data now.
 *
 * One job: answer those two questions about a card id, treating an upgraded `+` as the base card it
 * is a mark on (`upgradeOf`), so a deck holding Sun Devourer+ counts as holding a Sun Devourer.
 */
import { ProgramRegistry } from '../data/programRegistry';
import type { CardShape } from '../types';

/** The shapes that PAY a currency out. The same definition `startKits.test.ts` has always used. */
export const PAYOFF_SHAPES: ReadonlySet<CardShape> = new Set<CardShape>(['scalar', 'consume']);

/** The design record's mark for a card with no currency at all. */
const NO_CURRENCY = '—';

/** The card a `+` is a mark on, or the card itself. */
function baseIdOf(cardId: string): string {
    return ProgramRegistry[cardId]?.upgradeOf ?? cardId;
}

export function cardShapeOf(cardId: string): CardShape | undefined {
    return ProgramRegistry[baseIdOf(cardId)]?.shape;
}

/** The currency a card feeds or spends, or undefined for a card with none (or none recorded). */
export function cardCurrencyOf(cardId: string): string | undefined {
    const cur = ProgramRegistry[baseIdOf(cardId)]?.cur;
    return cur === undefined || cur === NO_CURRENCY ? undefined : cur;
}

/** True for a card that pays its currency out: a `scalar` or a `consume`. */
export function isPayoffCard(cardId: string): boolean {
    const shape = cardShapeOf(cardId);
    return shape !== undefined && PAYOFF_SHAPES.has(shape);
}
