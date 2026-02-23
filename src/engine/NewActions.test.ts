import { describe, it, expect, beforeEach } from 'vitest';
import type { IBattleState, ProgramEntity } from './types';
import { ActionExecutorRegistry } from './actions/ActionExecutors';
import { createMockEntity } from './data/battleFactories';

function createInitialState(): IBattleState {
    return {
        sessionId: 'test-session',
        seed: 'test-seed',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        osLogs: [],
        procs: [],
        playerParty: [createMockEntity('Player', 'kraken', 10)],
        enemyParty: [createMockEntity('Enemy', 'fenrir', 10)],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['card_1', 'card_2', 'card_3'],
            hand: [
                { id: 'h1', dataId: 'water_slap', currentCost: 0, isPlayable: true },
                { id: 'h2', dataId: 'defend', currentCost: 1, isPlayable: true }
            ] as ProgramEntity[],
            drawpile: [],
            discard: [
                { id: 'd1', dataId: 'strike', currentCost: 1, isPlayable: true }
            ] as ProgramEntity[],
            exhaust: [
                { id: 'e1', dataId: 'surge', currentCost: 2, isPlayable: true }
            ] as ProgramEntity[]
        },
        enemyDeck: {
            ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: []
        },
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        levelUpQueue: [],
        activeRelics: []
    };
}

describe('New Utility Actions', () => {
    let initialState: IBattleState;

    beforeEach(() => {
        initialState = createInitialState();
    });

    it('GENERATE_CARD should add the specified card to hand', () => {
        const action: any = { type: 'GENERATE_CARD', dataId: 'feedback_token' };
        const executor = ActionExecutorRegistry['GENERATE_CARD'];
        const state = executor.execute(initialState, initialState.playerParty[0].id, initialState.enemyParty[0].id, action, undefined, {} as any);

        const hand = state.playerDeck.hand;
        expect(hand.length).toBe(3);
        expect(hand[2].dataId).toBe('feedback_token');
        expect(hand[2].currentCost).toBe(0); // Generated cards defaults to usually 0 cost if handled in effect handler
    });

    it('CLEANSE should remove debuffs', () => {
        // Add poison and sleep to player
        const player = initialState.playerParty[0];
        let state = {
            ...initialState,
            playerParty: [{
                ...player,
                statusEffects: [
                    { id: 's1', type: 'Poison' as any, stacks: 2 },
                    { id: 's2', type: 'Asleep' as any, stacks: 1 },
                    { id: 's3', type: 'Sharp' as any, stacks: 1 } // buff
                ]
            }]
        };

        const action: any = { type: 'CLEANSE' }; // General cleanse
        const executor = ActionExecutorRegistry['CLEANSE'];
        const nextState = executor.execute(state, player.id, player.id, action, undefined, {} as any);

        const updatedPlayer = nextState.playerParty[0];
        // Poison and Asleep should be gone, Sharp should remain
        expect(updatedPlayer.statusEffects.length).toBe(1);
        expect(updatedPlayer.statusEffects[0].type).toBe('Sharp');
    });

    it('DISCARD should move top N cards from hand to discard', () => {
        const action: any = { type: 'DISCARD', amount: 1, isRandom: false };
        const executor = ActionExecutorRegistry['DISCARD'];
        const state = executor.execute(initialState, initialState.playerParty[0].id, initialState.playerParty[0].id, action, undefined, {} as any);

        expect(state.playerDeck.hand.length).toBe(1);
        expect(state.playerDeck.hand[0].dataId).toBe('defend'); // 'water_slap' got discarded
        expect(state.playerDeck.discard.length).toBe(2);
        expect(state.playerDeck.discard.some(c => c.dataId === 'water_slap')).toBe(true);
    });

    it('EXHAUST should move cards from hand to exhaust', () => {
        const action: any = { type: 'EXHAUST', amount: 1 };
        const executor = ActionExecutorRegistry['EXHAUST'];
        const state = executor.execute(initialState, initialState.playerParty[0].id, initialState.playerParty[0].id, action, undefined, {} as any);

        expect(state.playerDeck.hand.length).toBe(1);
        expect(state.playerDeck.exhaust.length).toBe(2);
        expect(state.playerDeck.exhaust.some(c => c.dataId === 'water_slap')).toBe(true);
    });

    it('RETURN should move cards from specified pile to hand', () => {
        const action: any = { type: 'RETURN', amount: 1, sourcePile: 'DISCARD', destinationPile: 'HAND' };
        const executor = ActionExecutorRegistry['RETURN'];
        const state = executor.execute(initialState, initialState.playerParty[0].id, initialState.playerParty[0].id, action, undefined, {} as any);

        // 'strike' was in discard
        expect(state.playerDeck.discard.length).toBe(0);
        expect(state.playerDeck.hand.length).toBe(3);
        expect(state.playerDeck.hand.some(c => c.dataId === 'strike')).toBe(true);
    });

    it('SEARCH should pick X cards matching criteria from deck into hand', () => {
        // Deck currently has 'card_1', 'card_2', 'card_3' strings (drawpile logic normally populates them as ProgramEntities)
        // Let's populate the drawpile properly first
        const stateWithDrawpile = {
            ...initialState,
            playerDeck: {
                ...initialState.playerDeck,
                drawpile: [
                    { id: 'dp1', dataId: 'whirlpool', currentCost: 1, isPlayable: true },
                    { id: 'dp2', dataId: 'defend', currentCost: 1, isPlayable: true }
                ] as ProgramEntity[]
            }
        };

        const action: any = { type: 'SEARCH', amount: 1 };
        const executor = ActionExecutorRegistry['SEARCH'];
        const state = executor.execute(stateWithDrawpile, initialState.playerParty[0].id, initialState.playerParty[0].id, action, undefined, {} as any);

        // Should draw 1 card since no criteria means any card
        expect(state.playerDeck.hand.length).toBe(3); // 2 original + 1 drawn
        expect(state.playerDeck.drawpile.length).toBe(1);
    });
});
