/**
 * THE DRAW TOOLTIP TELLS THE TRUTH — ticket 22.
 *
 * `sum(cardDraw) − (N − 1)` is stated twice in this codebase: once inside `battleReducer`'s turn
 * boundary, where it decides how many cards actually arrive, and once in `drawFormula.describeDraw`,
 * where it decides what the player is told. Two statements of one rule is a drift risk, and the
 * mitigation has to be a test rather than a comment — so **every assertion below runs the REAL
 * reducer through a turn boundary and compares the hand that appears against the number the tooltip
 * promised.** A tooltip that agreed with itself and disagreed with the game would be exactly the
 * hidden number ticket 22 was opened to close.
 *
 * The 3/5/7 at one/two/three members is the specific triple worth pinning: ticket 08's whole
 * start-deck ruling was derived from it.
 */

import { describe, expect, it } from 'vitest';

import { describeDraw, drawTooltipLines } from './drawFormula';
import { battleReducer } from '../../engine/battleReducer';
import { HAND_SIZE_LIMIT } from '../../engine/deckLogic';
import type { Element, IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

function unit(id: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id,
        name: id.toUpperCase(),
        definitionId: 'test_def',
        blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0,
        maxHp: 200, currentHp: 200,
        cardDraw: 3, maxEnergy: 3, currentEnergy: 3,
        attack: 45, defense: 30, speed: 10,
        primaryElement: 'None' as Element, secondaryElement: 'None' as Element,
        tempHp: 0, statusEffects: [], daemons: [], hooks: [],
        playsThisTurn: 0,
        ...over,
    } as IBattleEntity;
}

/** A deep draw pile of the plainest card in the registry, so nothing the draw pulls does anything. */
const pile = (n: number): ProgramEntity[] =>
    Array.from({ length: n }, (_, i) => ({
        id: `d${i}`, dataId: 'test_strike', currentCost: 1, isPlayable: true,
    }));

function board(playerParty: IBattleEntity[], over: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'draw-test',
        seed: 'draw-seed',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        playerParty,
        enemyParty: [unit('e1')],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: pile(30), hand: [], discard: [], exhaust: [],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        ...over,
    } as unknown as IBattleState;
}

/**
 * Hand the fight back to the player and report the hand that arrives.
 *
 * Two END_TURNs, because a refill only happens on the way INTO a side's turn: the first discards
 * the player's hand and hands over, the second brings it back and draws. Measuring after a real
 * round-trip rather than by calling `executeDraw` directly is the whole point — the clamp, the
 * short-circuit on a wiped party and the hand-length term are all in the reducer's copy, not in a
 * helper this test could accidentally share with the thing it is checking.
 */
function handAfterRoundTrip(state: IBattleState): number {
    const toEnemy = battleReducer(state, { type: 'END_TURN' });
    const backToPlayer = battleReducer(toEnemy, { type: 'END_TURN' });
    return backToPlayer.playerDeck.hand.length;
}

describe('the draw tooltip matches what drawCards actually draws', () => {
    it('one member draws 3, and the reducer agrees', () => {
        const state = board([unit('p1')]);
        const said = describeDraw(state);
        expect(said.total).toBe(3);
        expect(said.arithmetic).toBe('3 = 3');
        expect(handAfterRoundTrip(state)).toBe(said.total);
    });

    it('two members draw 5, and the reducer agrees', () => {
        const state = board([unit('p1'), unit('p2')]);
        const said = describeDraw(state);
        expect(said.total).toBe(5);
        expect(said.arithmetic).toBe('3 + 3 − 1 = 5');
        expect(handAfterRoundTrip(state)).toBe(said.total);
    });

    it('three members draw 7, and the reducer agrees — ticket 08`s number', () => {
        const state = board([unit('p1'), unit('p2'), unit('p3')]);
        const said = describeDraw(state);
        expect(said.total).toBe(7);
        expect(said.arithmetic).toBe('3 + 3 + 3 − 2 = 7');
        expect(said.sum).toBe(9);
        expect(said.penalty).toBe(2);
        expect(handAfterRoundTrip(state)).toBe(said.total);
    });

    it('a member who draws 4 is visible in the arithmetic, not averaged away', () => {
        // Three species in the roster carry cardDraw 4 and it is priced against their Energy. A
        // tooltip that printed the formula rather than this party's terms would hide that entirely.
        const state = board([unit('p1'), unit('p2', { cardDraw: 4 }), unit('p3')]);
        const said = describeDraw(state);
        expect(said.arithmetic).toBe('3 + 4 + 3 − 2 = 8');
        expect(said.named).toBe('P1 3 + P2 4 + P3 3 − 2 = 8');
        expect(handAfterRoundTrip(state)).toBe(said.total);
    });

    it('a downed member stops contributing immediately, in the tooltip and in the reducer', () => {
        const state = board([unit('p1'), unit('p2'), unit('p3', { currentHp: 0 })]);
        const said = describeDraw(state);
        expect(said.members.map(m => m.name)).toEqual(['P1', 'P2']);
        expect(said.total).toBe(5);
        expect(handAfterRoundTrip(state)).toBe(said.total);
    });

    it('a wiped party draws nothing — the short-circuit, not `0 − (−1)`', () => {
        const said = describeDraw(board([unit('p1', { currentHp: 0 })]));
        expect(said.total).toBe(0);
        expect(said.formulaTotal).toBe(0);
    });

    it('reports the HAND CAP when the cap, not the formula, decides the number', () => {
        /*
         * The player's hand survives the enemy's end of turn (only the active side discards), so a
         * near-full hand meets the refill and the clamp bites. A tooltip that still promised 7 here
         * would be the hidden number in its purest form.
         */
        const state = board([unit('p1'), unit('p2'), unit('p3')], {
            activeSide: 'ENEMY',
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: pile(30),
                hand: pile(HAND_SIZE_LIMIT - 1), discard: [], exhaust: [],
            },
        } as Partial<IBattleState>);

        const said = describeDraw(state);
        expect(said.formulaTotal).toBe(7);
        expect(said.handRoom).toBe(1);
        expect(said.total).toBe(1);
        expect(said.capped).toBe(true);
        expect(drawTooltipLines(said).join(' ')).toContain('Capped');

        const back = battleReducer(state, { type: 'END_TURN' });
        expect(back.playerDeck.hand.length - (HAND_SIZE_LIMIT - 1)).toBe(said.total);
    });

    it('the tooltip leads with the number and then shows its working', () => {
        const lines = drawTooltipLines(describeDraw(board([unit('p1'), unit('p2'), unit('p3')])));
        expect(lines[0]).toBe('Next refill draws 7 cards.');
        expect(lines[1]).toBe('P1 3 + P2 3 + P3 3 − 2 = 7');
        // The rule in words, so the arithmetic is not just a coincidence the player has to infer.
        expect(lines[2]).toContain('minus one per extra member');
    });
});
