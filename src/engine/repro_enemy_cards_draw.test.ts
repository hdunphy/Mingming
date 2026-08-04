/**
 * Regression: enemyMode 'CARDS' enemies stopped drawing after their opening hand.
 *
 * processPreTurn's hand refill was gated on `nextSide === 'PLAYER'`, so a CARDS
 * enemy drew once at battle creation (battleFactories) and never again. Once it
 * had played through that opening hand, getBestAction found no legal card plays
 * and returned END_TURN forever - the enemy silently went passive mid-battle.
 *
 * The companion assertion matters just as much: MOVES enemies must still not draw,
 * because a real executeDraw call advances state.seed and would invalidate every
 * recorded scenario and replay.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
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
    it('refills a CARDS enemy hand when the turn passes to it', () => {
        const before = stateHandingTurnToEnemy({ enemyMode: 'CARDS' });
        expect(before.enemyDeck.hand).toHaveLength(0);

        const after = battleReducer(before, { type: 'END_TURN' });

        expect(after.activeSide).toBe('ENEMY');
        expect(after.enemyDeck.hand.length).toBeGreaterThan(0);
    });

    it('still draws nothing for a MOVES enemy, and leaves the seed untouched', () => {
        const before = stateHandingTurnToEnemy({ enemyMode: 'MOVES' });

        const after = battleReducer(before, { type: 'END_TURN' });

        expect(after.activeSide).toBe('ENEMY');
        expect(after.enemyDeck.hand).toHaveLength(0);
        expect(after.seed).toBe(before.seed);
    });

    it('still refills the player hand when the turn comes back round', () => {
        const before = createSparseBattleState({
            activeSide: 'ENEMY',
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

        const after = battleReducer(before, { type: 'END_TURN' });

        expect(after.activeSide).toBe('PLAYER');
        expect(after.playerDeck.hand.length).toBeGreaterThan(0);
    });
});
