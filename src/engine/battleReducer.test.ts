import { describe, it, expect, beforeEach, vi } from 'vitest';
import { battleReducer, type BattleAction } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { globalBattleEventBus } from './events';

function createMockState(): IBattleState {
    return {
        sessionId: 'test-session',
        seed: 123,
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        playerParty: [
            { id: 'p1', currentEnergy: 10, maxEnergy: 10, statusEffects: [], name: 'Hero', hpIV: 0, attackIV: 0, defenseIV: 0, level: 10, experience: 0, definitionId: 'def1', baseStats: { hp: 100, attack: 10, defense: 10, energy: 10, cardDraw: 1 }, primaryElement: 'Fire', currentHp: 100, maxHp: 100, attack: 10, defense: 10, speed: 10, tempHp: 0, isTrapped: false } as IBattleEntity,
            { id: 'p2', currentEnergy: 5, maxEnergy: 10, statusEffects: [], name: 'Ally', hpIV: 0, attackIV: 0, defenseIV: 0, level: 10, experience: 0, definitionId: 'def1', baseStats: { hp: 100, attack: 10, defense: 10, energy: 10, cardDraw: 1 }, primaryElement: 'Water', currentHp: 100, maxHp: 100, attack: 10, defense: 10, speed: 10, tempHp: 0, isTrapped: false } as IBattleEntity
        ],
        enemyParty: [],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['card1', 'card2'],
            hand: [
                { id: 'h1', dataId: 'card1', currentCost: 3, isPlayable: true },
                { id: 'h2', dataId: 'card2', currentCost: 1, isPlayable: true }
            ] as ProgramEntity[],
            discard: []
        },
        enemyDeck: {
            ownerId: 'ENEMY',
            deck: [],
            hand: [],
            discard: []
        }
    };
}

describe('Battle Reducer State Machine', () => {
    let initialState: IBattleState;

    beforeEach(() => {
        initialState = createMockState();
        vi.spyOn(globalBattleEventBus, 'emit');
    });

    it('should handle END_TURN transition sequence', () => {
        // ACTION -> POST_TURN -> PRE_TURN (Enemy) -> ACTION (Enemy)
        const newState = battleReducer(initialState, { type: 'END_TURN' });

        expect(newState.phase).toBe('ACTION');
        expect(newState.activeSide).toBe('ENEMY');
        expect(newState.turn).toBe(1);

        // Check events
        expect(globalBattleEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'PHASE_START', phase: 'POST_TURN' }));
        expect(globalBattleEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'PHASE_END', phase: 'POST_TURN' }));
        expect(globalBattleEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'PHASE_START', phase: 'PRE_TURN' }));
    });

    it('should discard hand on POST_TURN', () => {
        const newState = battleReducer(initialState, { type: 'END_TURN' });

        expect(newState.playerDeck.hand.length).toBe(0);
        expect(newState.playerDeck.discard.length).toBe(2);
    });

    it('should transfer energy', () => {
        const action: BattleAction = {
            type: 'TRANSFER_ENERGY',
            payload: { sourceId: 'p1', targetId: 'p2' }
        };

        const newState = battleReducer(initialState, action);

        const p1 = newState.playerParty.find(p => p.id === 'p1');
        const p2 = newState.playerParty.find(p => p.id === 'p2');

        expect(p1?.currentEnergy).toBe(8);
        expect(p2?.currentEnergy).toBe(6);
    });

    it('should reject transfer if insufficient energy', () => {
        // p2 has 5. Let's make p2 have 1 by modifying state immutably before test
        const lowEnergyState = {
            ...initialState,
            playerParty: [
                initialState.playerParty[0],
                { ...initialState.playerParty[1], currentEnergy: 1 }
            ]
        };

        const action: BattleAction = {
            type: 'TRANSFER_ENERGY',
            payload: { sourceId: 'p2', targetId: 'p1' }
        };

        const newState = battleReducer(lowEnergyState, action);
        // Should be unchanged
        expect(newState).toBe(lowEnergyState);
    });

    it('should handle PLAY_PROGRAM', () => {
        const action: BattleAction = {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'p2', programId: 'h2' }
        };

        const newState = battleReducer(initialState, action);

        const p1 = newState.playerParty.find(p => p.id === 'p1');
        // Energy deducted (10 - 1 = 9)
        expect(p1?.currentEnergy).toBe(9);

        // Card removed from hand
        expect(newState.playerDeck.hand.find(c => c.id === 'h2')).toBeUndefined();
        // Card moved to discard
        expect(newState.playerDeck.discard.find(c => c.id === 'h2')).toBeDefined();

        // Event emitted
        expect(globalBattleEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
            type: 'PROGRAM_PLAYED',
            sourceId: 'p1',
            programId: 'card2' // Data ID
        }));
    });

    it('should reject play if insufficient energy', () => {
        // Play h1 (Cost 3). Give p1 only 2 energy.
        const lowEnergyState = {
            ...initialState,
            playerParty: [
                { ...initialState.playerParty[0], currentEnergy: 2 },
                initialState.playerParty[1]
            ]
        };

        const action: BattleAction = {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'p2', programId: 'h1' }
        };

        const newState = battleReducer(lowEnergyState, action);
        // Unchanged
        expect(newState.playerParty[0].currentEnergy).toBe(2);
        expect(newState.playerDeck.hand.length).toBe(2);
    });
});
