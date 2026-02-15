import { describe, it, expect } from 'vitest';
import { battleReducer, BattleAction } from './battleReducer';
import { resolvestatusEffects } from './effectHandlers';
import { IBattleState, IBattleEntity, ProgramData, StatusType } from './types';
import { calculateDamage } from './combatUtils';
import { registerHook } from './core/Hooks';
import { GetProgramData } from './data/programRegistry';

// --- Helper: Mock State ---
function createMockState(): IBattleState {
    const p1: IBattleEntity = {
        id: 'p1', name: 'Hero', level: 10, experience: 0,
        nickname: 'Hero',
        definitionId: 'def1',
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Fire', statusEffects: [],
        tempHp: 0, speed: 10, hooks: []
    };

    const e1: IBattleEntity = {
        id: 'e1', name: 'Villain', level: 10, experience: 0,
        nickname: 'Villain',
        definitionId: 'def2',
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Nature', statusEffects: [],
        tempHp: 0, speed: 10, hooks: []
    };

    return {
        sessionId: 'test', seed: 123, turn: 1, phase: 'ACTION', activeSide: 'PLAYER',
        playerParty: [p1], enemyParty: [e1],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [] },
        logs: []
    };
}

describe('Advanced Combat Mechanics', () => {

    // 1. Multi-Hit Logic
    it('Multi-Hit: Stops executing actions if target dies', () => {
        let state = createMockState();

        // Setup: Enemy has 0 HP (already dead for this card play)
        const deadEnemy = { ...state.enemyParty[0], currentHp: 0 };
        state = { ...state, enemyParty: [deadEnemy] };

        // Mock a program with 2 actions
        const multiHitCard = { id: 'c1', dataId: 'card_fireball', currentCost: 2, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [multiHitCard] } };

        const action: BattleAction = {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        };

        const nextState = battleReducer(state, action);

        expect(nextState.enemyParty[0].currentHp).toBe(0);
        // Attacker energy should be spent (paid 2 for fireball)
        expect(nextState.playerParty[0].currentEnergy).toBe(8);
    });

    // 2. Middleware Hooks
    it('Hooks: "DamageDoubler" hook doubles damage', () => {
        const hookId = 'hook_double_damage';
        registerHook({
            id: hookId,
            onDamageCalculated: (dmg) => dmg * 2
        });

        const state = createMockState();
        const p1 = { ...state.playerParty[0], hooks: [hookId] };
        const newState = { ...state, playerParty: [p1] };

        const target = newState.enemyParty[0];
        const program = { element: 'None' } as ProgramData;

        const damage = calculateDamage(p1, target, program, 10, newState);

        // Normal calc for level 10: raw ~3. Doubled = 6.
        expect(damage).toBeGreaterThan(4);
    });

    // 3. Burn Scaling
    it('Burn Scaling: 1 stack = 1%, 2 stacks = 2% + shred, 3 stacks = 5% + shred', () => {
        let state = createMockState();
        const target = {
            ...state.enemyParty[0],
            maxHp: 1000,
            currentHp: 1000,
            defense: 100,
            statusEffects: [{ id: 'b1', type: 'Burn' as StatusType, stacks: 1, duration: 3 }]
        };
        state = { ...state, enemyParty: [target], activeSide: 'ENEMY' }; // Enemy turn ending processes their status

        // 1 Stack
        let nextState = resolvestatusEffects(state);
        expect(nextState.enemyParty[0].currentHp).toBe(990);
        expect(nextState.enemyParty[0].defense).toBe(100);

        // 2 Stacks
        state = {
            ...state,
            enemyParty: [{ ...target, currentHp: 1000, statusEffects: [{ id: 'b1', type: 'Burn' as StatusType, stacks: 2, duration: 3 }] }]
        };
        nextState = resolvestatusEffects(state);
        expect(nextState.enemyParty[0].currentHp).toBe(980);
        expect(nextState.enemyParty[0].defense).toBe(99);

        // 3 Stacks
        state = {
            ...state,
            enemyParty: [{ ...target, currentHp: 1000, defense: 100, statusEffects: [{ id: 'b1', type: 'Burn' as StatusType, stacks: 3, duration: 3 }] }]
        };
        nextState = resolvestatusEffects(state);
        expect(nextState.enemyParty[0].currentHp).toBe(950);
        expect(nextState.enemyParty[0].defense).toBe(95);
    });
});
