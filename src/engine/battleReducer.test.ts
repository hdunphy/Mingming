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
            { id: 'p1', currentEnergy: 10, maxEnergy: 10, statusEffects: [], name: 'Hero', hpIV: 0, attackIV: 0, defenseIV: 0, level: 10, experience: 0, definitionId: 'def1', baseStats: { hp: 100, attack: 10, defense: 10, energy: 10, cardDraw: 1 }, primaryElement: 'Fire', currentHp: 100, maxHp: 100, attack: 10, defense: 10, speed: 10, cardDraw: 1, tempHp: 0 } as IBattleEntity,
            { id: 'p2', currentEnergy: 5, maxEnergy: 10, statusEffects: [], name: 'Ally', hpIV: 0, attackIV: 0, defenseIV: 0, level: 10, experience: 0, definitionId: 'def1', baseStats: { hp: 100, attack: 10, defense: 10, energy: 10, cardDraw: 1 }, primaryElement: 'Water', currentHp: 100, maxHp: 100, attack: 10, defense: 10, speed: 10, cardDraw: 1, tempHp: 0 } as IBattleEntity
        ],
        enemyParty: [],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['card1', 'card2'],
            hand: [
                { id: 'h1', dataId: 'card1', currentCost: 3, isPlayable: true },
                { id: 'h2', dataId: 'card2', currentCost: 1, isPlayable: true }
            ] as ProgramEntity[],
            drawpile: [], // Empty for this test? Or populated?
            discard: []
        },
        enemyDeck: {
            ownerId: 'ENEMY',
            deck: [],
            drawpile: [],
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


    it('should apply status effects additively', () => {
        // Initial: p1 has 2 stacks of 'Poison'
        const p1WithStatus = {
            ...initialState.playerParty[0],
            statusEffects: [{ id: 's1', type: 'Poison', duration: 3, stacks: 2 }]
        } as IBattleEntity;

        const testState = {
            ...initialState,
            playerParty: [p1WithStatus, initialState.playerParty[1]]
        };

        const action: BattleAction = {
            type: 'APPLY_STATUS',
            payload: { targetId: 'p1', status: 'Poison', stacks: 3 }
        };

        const newState = battleReducer(testState, action);
        const p1 = newState.playerParty[0];

        expect(p1.statusEffects.length).toBe(1);
        expect(p1.statusEffects[0].type).toBe('Poison');
        expect(p1.statusEffects[0].stacks).toBe(5); // 2 + 3
    });

    it('should handle Status Duality (Sharp cancels Dazed)', () => {
        // Initial: p1 has 5 stacks of 'Dazed'
        const p1WithStatus = {
            ...initialState.playerParty[0],
            statusEffects: [{ id: 's1', type: 'Dazed', duration: 3, stacks: 5 }]
        } as IBattleEntity;

        const testState = {
            ...initialState,
            playerParty: [p1WithStatus, initialState.playerParty[1]]
        };

        // Apply 3 Sharp. Should reduce Dazed to 2.
        const action1: BattleAction = {
            type: 'APPLY_STATUS',
            payload: { targetId: 'p1', status: 'Sharp', stacks: 3 }
        };

        let newState = battleReducer(testState, action1);
        let p1 = newState.playerParty[0];

        expect(p1.statusEffects.length).toBe(1);
        expect(p1.statusEffects[0].type).toBe('Dazed');
        expect(p1.statusEffects[0].stacks).toBe(2); // 5 - 3

        // Apply 4 Sharp. Should remove Dazed and add 2 Sharp.
        const action2: BattleAction = {
            type: 'APPLY_STATUS',
            payload: { targetId: 'p1', status: 'Sharp', stacks: 4 }
        };

        newState = battleReducer(newState, action2);
        p1 = newState.playerParty[0];

        expect(p1.statusEffects.length).toBe(1);
        expect(p1.statusEffects[0].type).toBe('Sharp');
        expect(p1.statusEffects[0].stacks).toBe(2); // 4 - 2 (remaining dazed)
    });

    it('should draw cards from drawpile on PRE_TURN', () => {
        // Setup state where Enemy has 1 card in drawpile
        const enemyDrawpileCard: ProgramEntity = { id: 'd1', dataId: 'card_e1', currentCost: 1, isPlayable: true };
        const testState: IBattleState = {
            ...initialState,
            enemyDeck: {
                ...initialState.enemyDeck,
                drawpile: [enemyDrawpileCard],
                hand: []
            }
        };

        // Player ends turn -> Enemy PRE_TURN -> Draw
        const newState = battleReducer(testState, { type: 'END_TURN' } as BattleAction);

        // Enemy active
        expect(newState.activeSide).toBe('ENEMY');
        // Check Enemy Hand
        expect(newState.enemyDeck.hand.length).toBe(1);
        expect(newState.enemyDeck.hand[0].id).toBe('d1');
        // Check Enemy Drawpile empty
        expect(newState.enemyDeck.drawpile.length).toBe(0);

        // Check event
        expect(globalBattleEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
            type: 'CARD_DRAWN',
            ownerId: 'ENEMY',
            cardId: 'card_e1'
        }));
    });
});
