/**
 * Regression: enemyMode 'CARDS' enemies stopped drawing after their opening hand.
 *
 * processPreTurn's hand refill was gated on `nextSide === 'PLAYER'`, so a CARDS
 * enemy drew once at battle creation (battleFactories) and never again.
 *
 * TICKET 159a moved the refill out of `processPreTurn` entirely: a side now draws at the end of
 * its OWN turn so its hand exists while the other side decides. These tests were rewritten around
 * the guarantee rather than the mechanism — what must hold is that a CARDS enemy keeps getting
 * hands, not which phase hands them over. Once it
 * had played through that opening hand, getBestAction found no legal card plays
 * and returned END_TURN forever - the enemy silently went passive mid-battle.
 *
 * The companion assertion matters just as much: MOVES enemies must still not draw,
 * because a real executeDraw call advances state.seed and would invalidate every
 * recorded scenario and replay.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { globalBattleEventBus } from './events';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from './types';

function card(id: string): ProgramEntity {
    return { id, dataId: 'ignite', currentCost: 1, isPlayable: true } as ProgramEntity;
}

/** Player's turn, about to hand over to an enemy whose drawpile is stocked but hand is empty. */
function stateHandingTurnToEnemy(overrides: Partial<IBattleState> = {}): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'draugr', name: 'Draugr', cardDraw: 3 })],
        enemyDeck: {
            ownerId: 'ENEMY',
            deck: ['ignite', 'ignite', 'ignite', 'ignite'],
            drawpile: [card('e-c1'), card('e-c2'), card('e-c3'), card('e-c4')],
            hand: [],
            discard: [],
            exhaust: [],
        },
        ...overrides,
    });
}

describe('enemy card draw across turns', () => {
    it('keeps a CARDS enemy in cards across a full round', () => {
        /*
         * The guarantee this file exists for, re-expressed for 159a's timing.
         *
         * It used to read "END_TURN hands over to the enemy and the enemy draws". The draw now
         * happens at the end of the owner's OWN turn, so the round is two steps: the player's
         * END_TURN refills the PLAYER, and the enemy's own END_TURN refills the ENEMY. What must
         * stay true is the thing the regression was about — that a CARDS enemy which has played
         * its opening hand gets another one, instead of going silently passive for the rest of
         * the fight.
         */
        const before = stateHandingTurnToEnemy({ enemyMode: 'CARDS' });
        expect(before.enemyDeck.hand).toHaveLength(0);

        // The player's turn ends: the PLAYER draws, the enemy does not.
        const enemyTurn = battleReducer(before, { type: 'END_TURN' });
        expect(enemyTurn.activeSide).toBe('ENEMY');
        expect(enemyTurn.enemyDeck.hand).toHaveLength(0);

        // The enemy's turn ends: now it draws, and it has cards for the turn after this one.
        const backToPlayer = battleReducer(enemyTurn, { type: 'END_TURN' });
        expect(backToPlayer.activeSide).toBe('PLAYER');
        expect(backToPlayer.enemyDeck.hand.length).toBeGreaterThan(0);
    });

    it('draws the enemy hand BEFORE the player has to decide \u2014 ticket 159a', () => {
        /*
         * 159 §1: the reason the draw moved at all. `END_TURN` discarded the active side's hand
         * and the next `TURN_START` drew it fresh, so during the player's turn the enemy held no
         * cards and 159b's face-up hand would have shown an empty panel.
         */
        const before = stateHandingTurnToEnemy({ enemyMode: 'CARDS' });
        const enemyTurn = battleReducer(before, { type: 'END_TURN' });
        const playerTurn = battleReducer(enemyTurn, { type: 'END_TURN' });

        // It is the player's move, and there is an enemy hand on the table to read.
        expect(playerTurn.activeSide).toBe('PLAYER');
        expect(playerTurn.enemyDeck.hand.length).toBeGreaterThan(0);
    });

    it('draws BEFORE TURN_END fires \u2014 the property 159b reads, proved by event order', () => {
        /*
         * The ruling asks for "a reducer test that the hand exists at `TURN_END`". Inspecting the
         * returned state cannot show that: the state is the same object whether the draw happened
         * before the event or after it. What CAN show it is the bus itself — `drawCards` emits a
         * `CARD_DRAWN` per card, so the question becomes whether those land before `TURN_END`,
         * which is exactly the ordering 159b depends on and exactly what a careless refactor
         * would flip.
         */
        const before = stateHandingTurnToEnemy({ enemyMode: 'CARDS' });
        const enemyTurn = battleReducer(before, { type: 'END_TURN' });

        const order: string[] = [];
        const unsubscribe = globalBattleEventBus.subscribe((event) => {
            if (event.type === 'CARD_DRAWN' && event.ownerId === 'ENEMY') order.push('draw');
            if (event.type === 'TURN_END') order.push('turnEnd');
        });
        try {
            battleReducer(enemyTurn, { type: 'END_TURN' });
        } finally {
            unsubscribe();
        }

        expect(order).toContain('draw');
        expect(order).toContain('turnEnd');
        // Every draw precedes the turn ending, so a listener on TURN_END sees the settled hand.
        expect(order.lastIndexOf('draw')).toBeLessThan(order.indexOf('turnEnd'));
    });

    it('leaves a DRAW-on-cast drawing MID-turn, where it belongs', () => {
        /*
         * 159a moved the REFILL, not every draw. The ruling asks for this explicitly, because the
         * obvious wrong way to implement the move is to make the deck untouchable outside the
         * end-of-turn phase — which would silently break the twenty-four cards whose whole text
         * is "and draw a card".
         */
        const state = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            enemyMode: 'MOVES',
            playerParty: [createSparseEntity({ id: 'p1', definitionId: 'skoll', name: 'Skoll', currentEnergy: 5 })],
            playerDeck: {
                ownerId: 'PLAYER',
                deck: [],
                drawpile: [card('p-a'), card('p-b'), card('p-c')],
                hand: [{ id: 'keen', dataId: 'keen_edge', currentCost: 1, isPlayable: true } as ProgramEntity],
                discard: [],
                exhaust: [],
            },
        });

        const after = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'p1', programId: 'keen' },
        });

        // Still the player's turn — no phase change — and the card drew into hand as it resolved.
        expect(after.activeSide).toBe('PLAYER');
        expect(after.phase).toBe('ACTION');
        expect(after.playerDeck.hand.length).toBeGreaterThan(0);
        expect(after.playerDeck.drawpile.length).toBeLessThan(3);
    });

    it('still draws nothing for a MOVES enemy, and leaves the seed untouched', () => {
        /*
         * A real `executeDraw` advances `state.seed` and would invalidate every recorded scenario
         * and replay. Asserted at the end of the ENEMY's own turn, which is where a MOVES enemy
         * would now wrongly draw if the gate were lost.
         */
        const playerTurn = stateHandingTurnToEnemy({ enemyMode: 'MOVES' });
        const enemyTurn = battleReducer(playerTurn, { type: 'END_TURN' });

        const after = battleReducer(enemyTurn, { type: 'END_TURN' });

        expect(after.activeSide).toBe('PLAYER');
        expect(after.enemyDeck.hand).toHaveLength(0);
        expect(after.seed).toBe(enemyTurn.seed);
    });

    it('still refills the player hand \u2014 at the end of the PLAYER\'s turn', () => {
        /*
         * The mirror of the enemy case. This asserted that ending the ENEMY's turn refilled the
         * player; under 159a the player refills when the PLAYER's turn ends, which is what puts
         * their next hand on the table while the enemy acts.
         */
        const playerTurn = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            enemyMode: 'MOVES',
            playerDeck: {
                ownerId: 'PLAYER',
                deck: ['ignite', 'ignite', 'ignite'],
                drawpile: [card('p-c1'), card('p-c2'), card('p-c3')],
                hand: [],
                discard: [],
                exhaust: [],
            },
        });

        const enemyTurn = battleReducer(playerTurn, { type: 'END_TURN' });

        // The enemy is acting, and the player's next hand is already dealt.
        expect(enemyTurn.activeSide).toBe('ENEMY');
        expect(enemyTurn.playerDeck.hand.length).toBeGreaterThan(0);

        // And `TURN_START` leaves it alone — the hand they end the enemy's turn with is the hand
        // they play. 159a's other half, and what 159b's panel depends on for the player's side.
        const backToPlayer = battleReducer(enemyTurn, { type: 'END_TURN' });
        expect(backToPlayer.activeSide).toBe('PLAYER');
        expect(backToPlayer.playerDeck.hand.map(c => c.id))
            .toEqual(enemyTurn.playerDeck.hand.map(c => c.id));
    });
});
