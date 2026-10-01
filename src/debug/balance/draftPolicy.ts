/**
 * TICKET 170e — A DRAFTER FOR DRAFT START THAT PICKS THE BEST CARD.
 *
 * Draft Start (169i) lets the player draft five starting cards from offers of three. The walker's
 * first drafter (`chooseDraftPick` in `runWalker.ts`, 169j) takes the first offered card that is in
 * the member's normal start kit, and falls back to the score only when no offered card is. On most
 * offers that rebuilds the kit the game would have dealt, so the Draft Start report could never show
 * what a good drafter gains or loses. This is the other drafter: it picks the card it likes best.
 *
 * THE RULE, in the ticket's words: the offer with the highest `scoreOf`, ties to the first offered;
 * but when two offers are within 5 points of each other, prefer the one that adds an ELEMENT or a
 * ROLE (the card's category: Attack, Skill, Daemon, Status, Heal) that the cards picked so far
 * lack.
 *
 * # WHAT "5 POINTS" IS ON `scoreOf`'S SCALE — A READING, NOT A MEASUREMENT
 *
 * `scoreOf` returns the card budget score, which is a card's POWER divided by ten (an energy of
 * budget is 4.0 on it; see `powerscale.ts`). Every number in the game moves by 5 POWER, so 5 points
 * is 0.5 on this scale. Read as 5.0 on this scale the window would be 50 power, wider than a whole
 * energy of budget and wider than the whole spread of most starting kits, and the "highest score"
 * half of the rule would almost never decide a pick. The constant below is that one reading; if the
 * ticket meant 5.0, it is the only line to change.
 *
 * It is a pure function of the offer, the picks so far and a score, so it is testable without a walk. It
 * does not look at the member's start kit, its firmware or the rest of the party: "the cards picked
 * so far" is the whole of its context.
 */

import { GetProgramData } from '../../engine/data/programRegistry';

/** Which drafter a walk uses. Left out of a walk, it is `'kit'`: 169j's drafter exactly. */
export type DraftPolicy = 'kit' | 'best';

/** Five power points, on `scoreOf`'s power-over-ten scale. See the header. */
export const DRAFT_TIE_WINDOW = 0.5;

interface Traits { readonly element: string | null; readonly role: string | null }

const traitsOf = (dataId: string): Traits => {
    try {
        const data = GetProgramData(dataId);
        return { element: data?.element ?? null, role: data?.category ?? null };
    } catch {
        return { element: null, role: null };
    }
};

/**
 * The offered card to take, or undefined for an empty offer.
 *
 * 1. Find the best score among the offers (an unknown card scores as the worst there is).
 * 2. Keep the offers within `DRAFT_TIE_WINDOW` of it.
 * 3. Of those, prefer one that adds an element or a role not among `picked`: the best-scoring such
 *    card, ties to the first offered. If none adds anything, take the best-scoring one.
 */
export function chooseDraftPickBest(
    offer: ReadonlyArray<string>,
    picked: ReadonlyArray<string>,
    /** The card score. The walker passes its own `scoreOf`; it is a parameter so this file need not import the walker. */
    scoreOf: (dataId: string) => number | null,
): string | undefined {
    if (offer.length === 0) return undefined;
    const scored = offer.map((id) => ({ id, score: scoreOf(id) ?? -Infinity }));
    const top = Math.max(...scored.map((row) => row.score));
    const near = scored.filter((row) => row.score >= top - DRAFT_TIE_WINDOW);

    const held = picked.map(traitsOf);
    const elements = new Set(held.map((t) => t.element));
    const roles = new Set(held.map((t) => t.role));
    const adds = (id: string): boolean => {
        const t = traitsOf(id);
        return (t.element !== null && !elements.has(t.element)) || (t.role !== null && !roles.has(t.role));
    };

    const pool = near.filter((row) => adds(row.id));
    const candidates = pool.length > 0 ? pool : near;
    let best = candidates[0];
    // Strictly greater, so a tie keeps the first offered.
    for (const row of candidates) if (row.score > best.score) best = row;
    return best.id;
}
