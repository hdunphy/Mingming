/**
 * THE DRAW FORMULA, SHOWN AS ARITHMETIC — ticket 22.
 *
 * `sum(cardDraw) − (N − 1)` is the rule the shared deck refills by: three cards at one member, five
 * at two, seven at three. It is not decoration. Ticket 08's whole start-deck ruling was derived from
 * these three numbers — a deck is sized against the hand it has to keep feeding — so a player who
 * cannot see where "7" comes from cannot reason about a third party member's real cost, and cannot
 * see that losing a member mid-fight costs them draw as well as a body.
 *
 * The ticket asks for **the actual arithmetic for the current party, not the formula**. So this
 * returns the terms as well as the total: "MJOLLNIR 3 + HULDRA 3 + FENRIR 3 − 2 = 7", with each
 * member's own `cardDraw` named, because they are not all 3 (three species in the roster draw 4, and
 * the enemy token frame draws 1) and a player holding a 4-draw unit should be able to see it paying.
 *
 * # IT MIRRORS THE REDUCER, AND A TEST HOLDS IT THERE
 *
 * The arithmetic below is a second statement of the expression inside `battleReducer.handleEndTurn`.
 * That is a real drift risk and the honest mitigation is a test rather than a comment:
 * `drawFormula.test.ts` runs the REAL reducer through a turn boundary and asserts the hand grew by
 * exactly the number this predicted, for parties of one, two and three. Extracting the expression
 * from the reducer instead was considered and rejected — the reducer's copy is inside a hot path
 * that already has the alive-party list in hand, and this one needs the per-member terms the reducer
 * has no use for.
 *
 * # THE CLAMP IS PART OF THE TRUTH
 *
 * `Math.min(total, HAND_SIZE_LIMIT − hand.length)` is in the reducer too, and a tooltip that printed
 * 7 while the reducer drew 2 would be exactly the hidden number this ticket is closing. When the cap
 * bites, `total` is what will actually arrive and `capped` says so.
 */

import { HAND_SIZE_LIMIT } from '../../engine/deckLogic';
import type { IBattleState } from '../../engine/types';

export interface DrawBreakdown {
    /** The living members that contribute, in party order. Dead members contribute nothing. */
    readonly members: ReadonlyArray<{ readonly name: string; readonly cardDraw: number }>;
    /** `sum(cardDraw)` over the living members. */
    readonly sum: number;
    /** `N − 1`: the shared-hand discount, one card off per extra body. */
    readonly penalty: number;
    /** `sum − (N − 1)` — the formula's answer, before the hand cap. */
    readonly formulaTotal: number;
    /** Cards the hand can still hold: `HAND_SIZE_LIMIT − hand.length`. */
    readonly handRoom: number;
    /** What will ACTUALLY be drawn at the next refill: the formula, clamped to the room and to 0. */
    readonly total: number;
    /** True when the hand cap, not the formula, is deciding the number. */
    readonly capped: boolean;
    /** "3 + 3 + 3 − 2 = 7" — the formula's answer spelled out in this party's own numbers. */
    readonly arithmetic: string;
    /** "MJOLLNIR 3 + HULDRA 3 + FENRIR 3 − 2 = 7", for a tooltip with room for the names. */
    readonly named: string;
}

/**
 * What the next refill will draw for `side`, and the arithmetic that gets there.
 *
 * Reads the party as it stands: a member who falls mid-fight stops contributing immediately, which
 * is the behaviour the reducer already has and the one the player most needs to be able to see.
 */
export function describeDraw(
    state: IBattleState | null | undefined,
    side: 'PLAYER' | 'ENEMY' = 'PLAYER',
): DrawBreakdown {
    const party = (side === 'PLAYER' ? state?.playerParty : state?.enemyParty) ?? [];
    // The deck was read here for `HAND_SIZE_LIMIT − hand.length`. Ticket 159a made the room the
    // whole limit whoever is acting, so the formula no longer needs the deck at all.
    const alive = party.filter(e => e.currentHp > 0);

    const members = alive.map(e => ({ name: e.name.toUpperCase(), cardDraw: e.cardDraw }));
    const sum = members.reduce((n, m) => n + m.cardDraw, 0);
    // The reducer short-circuits a wiped party to 0 rather than letting `sum − (N − 1)` run to 1.
    const penalty = alive.length === 0 ? 0 : alive.length - 1;
    const formulaTotal = alive.length === 0 ? 0 : sum - penalty;

    /*
     * ── TICKET 155d — THE ROOM IS MEASURED AFTER THE DISCARD, NOT BEFORE IT ─────────────────
     *
     * Henry, 2026-09-19: *"draw pile shows +4 but I drew ~12"*.
     *
     * The cap was `HAND_SIZE_LIMIT − hand.length` against the CURRENT hand, and during your own
     * turn with eleven cards in hand that is 4. But the engine discards your hand at END_TURN
     * BEFORE it refills (`battleReducer.ts:1196` → `:1330`), so by the time the draw happens the
     * hand is empty and the room is the whole limit. The number the player was shown was the one
     * thing it could not be.
     *
     * Whose turn it is used to decide which reading was right: on the ENEMY's turn your hand was
     * what it would still be when your refill came, so the current hand was the cap.
     *
     * ── TICKET 159a COLLAPSED THAT BRANCH ─────────────────────────────────────
     *
     * The draw moved to the end of the owner's own turn, immediately after `discardHand`. So
     * EVERY draw is now preceded by the discard of the very hand it is replacing, whoever is
     * acting right now — your next refill is at the end of your next turn, by which time the
     * cards you are holding are gone. The room is the whole limit in both readings, and a branch
     * on `activeSide` would now be two answers to a question that has one.
     *
     * `side` is still a parameter because the FORMULA is per-side; only the room stopped caring.
     */
    const handRoom = HAND_SIZE_LIMIT;
    const total = Math.max(0, Math.min(formulaTotal, handRoom));

    const terms = members.map(m => `${m.cardDraw}`).join(' + ') || '0';
    const namedTerms = members.map(m => `${m.name} ${m.cardDraw}`).join(' + ') || 'nobody left standing';
    const minus = penalty > 0 ? ` − ${penalty}` : '';

    return {
        members,
        sum,
        penalty,
        formulaTotal,
        handRoom,
        total,
        capped: total < formulaTotal,
        arithmetic: `${terms}${minus} = ${formulaTotal}`,
        named: `${namedTerms}${minus} = ${formulaTotal}`,
    };
}

/** The whole explanation as tooltip lines, cap included when it is the number that will happen. */
export function drawTooltipLines(breakdown: DrawBreakdown): string[] {
    const lines = [
        `Next refill draws ${breakdown.total} card${breakdown.total === 1 ? '' : 's'}.`,
        `${breakdown.named}`,
        `Each member's own draw, minus one per extra member sharing the hand.`,
    ];
    if (breakdown.capped) {
        lines.push(
            `Capped: your hand holds ${HAND_SIZE_LIMIT}, so only ${breakdown.total} of the ${breakdown.formulaTotal} fit.`,
        );
    }
    return lines;
}
