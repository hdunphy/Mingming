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

    it('measures the room after the discard, whoever is acting \u2014 ticket 159a', () => {
        /*
         * This used to assert the opposite, and 159a is why it flipped.
         *
         * Under the old timing the player's hand survived the enemy's end of turn and met the
         * refill at the START of the player's next turn, so a near-full hand capped the draw to 1
         * and the tooltip had to say so (155d). The draw now happens at the end of the owner's
         * OWN turn, immediately after that hand is discarded — so a hand held during the enemy's
         * turn is gone before its own refill, and the room is the whole limit either way.
         *
         * Same board, same near-full hand, opposite answer, because the engine changed under it.
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
        expect(said.handRoom).toBe(HAND_SIZE_LIMIT);
        expect(said.total).toBe(7);
        expect(said.capped).toBe(false);
        expect(drawTooltipLines(said).join(' ')).not.toContain('Capped');

        /*
         * And the engine agrees. Ending the ENEMY's turn no longer refills the player at all —
         * the player's refill happens at the end of the PLAYER's turn — so the hand they are
         * holding is untouched here. That is 159a's property, checked against the reducer rather
         * than against a second copy of the rule.
         */
        const afterEnemyTurn = battleReducer(state, { type: 'END_TURN' });
        expect(afterEnemyTurn.playerDeck.hand.length).toBe(HAND_SIZE_LIMIT - 1);
    });

    it('the tooltip leads with the number and then shows its working', () => {
        const lines = drawTooltipLines(describeDraw(board([unit('p1'), unit('p2'), unit('p3')])));
        expect(lines[0]).toBe('Next refill draws 7 cards.');
        expect(lines[1]).toBe('P1 3 + P2 3 + P3 3 − 2 = 7');
        // The rule in words, so the arithmetic is not just a coincidence the player has to infer.
        expect(lines[2]).toContain('minus one per extra member');
    });
});

/**
 * TICKET 155d — the cap depends on whose turn it is.
 *
 * Henry, 2026-09-19: *"draw pile shows +4 but I drew ~12"*. The room was measured against the hand
 * the player was holding, and on their own turn that hand is discarded before the refill — so the
 * cap was the one number it could not be.
 *
 * Only the enemy-turn case had a test, which is precisely why the player-turn case was wrong.
 */
describe('155d/159a — the hand is discarded before its own refill, always', () => {
    it('ignores the current hand on YOUR turn, because it is about to be thrown away', () => {
        const state = board([unit('p1'), unit('p2'), unit('p3')], {
            activeSide: 'PLAYER',
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: pile(30), hand: pile(11), discard: [], exhaust: [],
            },
        } as Partial<IBattleState>);

        const draw = describeDraw(state);
        // 3 + 3 + 3 − 2 = 7, uncapped. The old code answered 4 (15 − 11).
        expect(draw.total).toBe(7);
        expect(draw.capped).toBe(false);
    });

    it('ignores it on the ENEMY\'s turn too, since 159a moved the draw', () => {
        /*
         * This asserted `total: 4` until 2026-09-21. Under the old timing the player's hand
         * survived the enemy's turn and met the refill still holding eleven cards, so the clamp
         * bit. 159a draws at the end of the owner's own turn, right after that hand is discarded,
         * so there is no longer a reading in which the current hand is the cap.
         *
         * The hand limit still clamps — it is just `HAND_SIZE_LIMIT` rather than what is left of
         * it, so a formula over 15 is still capped.
         */
        const state = board(
            [unit('p1', { cardDraw: 9 }), unit('p2', { cardDraw: 9 }), unit('p3', { cardDraw: 9 })],
            {
                activeSide: 'ENEMY',
                playerDeck: {
                    ownerId: 'PLAYER', deck: [], drawpile: pile(30), hand: pile(11), discard: [], exhaust: [],
                },
            } as Partial<IBattleState>,
        );

        const draw = describeDraw(state);
        // 9 + 9 + 9 − 2 = 25, clamped by the LIMIT rather than by the eleven cards in hand.
        expect(draw.total).toBe(HAND_SIZE_LIMIT);
        expect(draw.capped).toBe(true);
    });

    it('still caps a huge formula on your own turn at the hand limit itself', () => {
        // The cap does not go away — it stops being measured against a hand that will not exist.
        const state = board(
            [unit('p1', { cardDraw: 9 }), unit('p2', { cardDraw: 9 }), unit('p3', { cardDraw: 9 })],
            { activeSide: 'PLAYER' } as Partial<IBattleState>,
        );

        expect(describeDraw(state).total).toBe(HAND_SIZE_LIMIT);
    });
});
