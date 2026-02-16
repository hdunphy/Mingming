import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity, StatusType } from './types';
import { GetProgramData } from './data/programRegistry';

// --- Helper: Mock State ---
function createMockState(): IBattleState {
    const p1: IBattleEntity = {
        id: 'p1', name: 'Hero', level: 10, experience: 0, nickname: 'Hero', definitionId: 'def1',
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10, primaryElement: 'Fire', statusEffects: [],
        tempHp: 0, speed: 10, hooks: []
    };

    const e1: IBattleEntity = {
        id: 'e1', name: 'Villain', level: 10, experience: 0, nickname: 'Villain', definitionId: 'def2',
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10, primaryElement: 'Nature', statusEffects: [],
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

describe('Milestone 8: Program Factory & Constraints', () => {

    it('Compositional Effects: prog_drain attacks target and heals self', () => {
        let state = createMockState();
        // Setup P1 with 50 HP (needs healing)
        const p1 = { ...state.playerParty[0], currentHp: 50 };
        state = { ...state, playerParty: [p1] };

        const card: ProgramEntity = { id: 'c1', dataId: 'prog_drain', currentCost: 2, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [card] } };

        const nextState = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        });

        // 1. Target should take damage
        expect(nextState.enemyParty[0].currentHp).toBeLessThan(100);
        // 2. Source should be healed (Heal formula is strong, so it hits maxHp)
        expect(nextState.playerParty[0].currentHp).toBe(100);
    });

    it('Constraints: prog_adrenaline fails if HP >= 30%', () => {
        let state = createMockState();
        const card: ProgramEntity = { id: 'c1', dataId: 'prog_adrenaline', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [card] } };

        const nextState = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        });

        // Current HP is 100/100 (100%), limit is 30%. Should reject action.
        expect(nextState).toEqual(state);
    });

    it('Constraints: prog_adrenaline succeeds if HP < 30%', () => {
        let state = createMockState();
        const p1 = { ...state.playerParty[0], currentHp: 20 }; // 20%
        state = { ...state, playerParty: [p1] };

        const card: ProgramEntity = { id: 'c1', dataId: 'prog_adrenaline', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [card] } };

        const nextState = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        });

        // Should succeed
        expect(nextState.enemyParty[0].currentHp).toBeLessThan(100);
        expect(nextState.playerParty[0].currentEnergy).toBe(9);
    });

    it('Constraints: prog_kick fails if target lacks Burn', () => {
        let state = createMockState();
        const card: ProgramEntity = { id: 'c1', dataId: 'prog_kick', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [card] } };

        const nextState = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        });

        expect(nextState).toEqual(state);
    });

    it('Constraints: prog_kick succeeds if target has Burn', () => {
        let state = createMockState();
        const e1 = {
            ...state.enemyParty[0],
            statusEffects: [{ id: 'b1', type: 'Burn' as StatusType, stacks: 1, duration: 3 }]
        };
        state = { ...state, enemyParty: [e1] };

        const card: ProgramEntity = { id: 'c1', dataId: 'prog_kick', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [card] } };

        const nextState = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        });

        expect(nextState.enemyParty[0].currentHp).toBeLessThan(100);
    });

});
