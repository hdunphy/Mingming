import { describe, it, expect, beforeEach } from 'vitest';
import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { ActionExecutorRegistry } from './actions/ActionExecutors';
import { createMockEntity } from './data/battleFactories';
import { GetProgramData } from './data/programRegistry';

describe('Advanced Archetypes Logic', () => {
    let initialState: IBattleState;

    beforeEach(() => {
        const player = createMockEntity('Player', 'fenrir', 10);
        const enemy = createMockEntity('Enemy', 'fenrir', 10);

        initialState = {
            sessionId: 'test',
            seed: 'seed',
            turn: 1,
            phase: 'ACTION',
            activeSide: 'PLAYER',
            logs: [],
            osLogs: [],
            procs: [],
            playerParty: [player],
            enemyParty: [enemy],
            playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
            enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
            cardsPlayedThisTurn: 0,
            cardsDrawnThisTurn: 0,
            lastProgramPlayed: null,
        counters: {},
            levelUpQueue: [],
            activeRelics: []
        };
    });

    it('MULTIPLY_STATUS should double status stacks', () => {
        // 1. Give enemy some Poison
        const enemy = { ...initialState.enemyParty[0] };
        let state: IBattleState = {
            ...initialState,
            enemyParty: [{
                ...enemy,
                statusEffects: [{ id: 'poison-1', type: 'Poison', stacks: 2 }]
            }]
        };

        const action: any = {
            type: 'MULTIPLY_STATUS',
            status: 'Poison',
            factor: 2
        };

        const executor = ActionExecutorRegistry['MULTIPLY_STATUS'];
        const nextState = executor.execute(state, state.playerParty[0].id, state.enemyParty[0].id, action, undefined, {} as any);

        expect(nextState.enemyParty[0].statusEffects.find(s => s.type === 'Poison')?.stacks).toBe(4);
    });

    it('TRIGGER_STATUS should deal poison damage immediately', () => {
        // 1. Give enemy Poison
        const enemy = { ...initialState.enemyParty[0] };
        let state: IBattleState = {
            ...initialState,
            enemyParty: [{
                ...enemy,
                statusEffects: [{ id: 'poison-1', type: 'Poison', stacks: 5 }]
            }]
        };

        const action: any = {
            type: 'TRIGGER_STATUS',
            status: 'Poison'
        };

        const executor = ActionExecutorRegistry['TRIGGER_STATUS'];
        const nextState = executor.execute(state, state.playerParty[0].id, state.enemyParty[0].id, action, undefined, {} as any);

        // Poison behavior: damage = stacks, then decrement stacks
        expect(nextState.enemyParty[0].currentHp).toBeLessThan(initialState.enemyParty[0].currentHp);
        expect(nextState.logs.some(l => l.includes('☣️ Poison'))).toBe(true);
    });

    it('PLAY_LAST_CARD should repeat the previous card actions', () => {
        // 1. Mock a "Test Strike" played previously
        let state: IBattleState = {
            ...initialState,
            lastProgramPlayed: 'test_strike'
        };

        const action: any = {
            type: 'PLAY_LAST_CARD'
        };

        const executor = ActionExecutorRegistry['PLAY_LAST_CARD'];
        const nextState = executor.execute(state, state.playerParty[0].id, state.enemyParty[0].id, action, undefined, {} as any);

        // Test Strike deals damage. Check if enemy HP dropped.
        expect(nextState.enemyParty[0].currentHp).toBeLessThan(initialState.enemyParty[0].currentHp);
        expect(nextState.logs.some(l => l.includes('🔁 Reprogramming: Test Strike'))).toBe(true);
    });

    it('CARDS_DRAWN scaling should increase damage', () => {
        // 1. Set cardsDrawnThisTurn to 10 to ensure a clear difference
        let state: IBattleState = {
            ...initialState,
            cardsDrawnThisTurn: 10
        };

        const action: any = {
            type: 'ATTACK',
            power: 5,
            scaling: 'CARDS_DRAWN'
        };

        const executor = ActionExecutorRegistry['ATTACK'];
        const nextState = executor.execute(state, state.playerParty[0].id, state.enemyParty[0].id, action, undefined, {} as any);

        const damageDealt = initialState.enemyParty[0].currentHp - nextState.enemyParty[0].currentHp;
        // Base damage for power 5 level 10 vs level 10 is ~2-3. With x10 it should be ~20-30.
        expect(damageDealt).toBeGreaterThan(10);
    });
});
