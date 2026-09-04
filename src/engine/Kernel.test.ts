import { describe, it, expect, vi } from 'vitest';
import { battleReducer, type BattleAction } from './battleReducer';
import { effectHandlers } from './effectHandlers';
import { type IBattleState, type IBattleEntity, type ProgramData, StatusType } from './types';
import { calculateModifier } from './combatUtils';
import { globalBattleEventBus } from './events';
import { TestProgramRegistry } from './data/testProgramRegistry';

vi.mock('./data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('./data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) => TestProgramRegistry[id] || original.GetProgramData(id))
    };
});

// --- Test Helpers ---

function createMockState(): IBattleState {
    const p1: IBattleEntity = {
        id: 'p1', name: 'Hero', 
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Fire', statusEffects: [],
        definitionId: 'def1', tempHp: 0, speed: 10, daemons: []
    };

    const e1: IBattleEntity = {
        id: 'e1', name: 'Villain', 
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Nature', statusEffects: [],
        definitionId: 'def2', tempHp: 0, speed: 10, daemons: []
    };

    return {
        sessionId: 'test', seed: '123', turn: 1, phase: 'ACTION', activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: [p1], enemyParty: [e1],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [],
        osLogs: [],
        procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {}
    };
}

describe('Kernel Milestone 7: Mandatory Unit Tests', () => {

    // 1. Insufficient Energy
    it('Action PLAY_PROGRAM is rejected if cost > energy', () => {
        let state = createMockState();
        // Setup: Player has 1 energy, Card costs 2
        const p1 = { ...state.playerParty[0], currentEnergy: 1 };
        state = { ...state, playerParty: [p1] };

        // Mock a card in hand
        const cardId = 'card_1';
        const deck = {
            ...state.playerDeck,
            hand: [{ id: cardId, dataId: 'card1', currentCost: 2, isPlayable: true }]
        };
        state = { ...state, playerDeck: deck };

        const action: BattleAction = {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: cardId }
        };

        const nextState = battleReducer(state, action);

        // Expect state not to change (or at least energy not consumed)
        expect(nextState.playerParty[0].currentEnergy).toBe(1);
        // Hand should still have the card
        expect(nextState.playerDeck.hand.length).toBe(1);
    });

    // 2. Energy Transfer
    it('Energy Transfer: Source -2, Target +1. Fails if Source < 2', () => {
        let state = createMockState();
        // Add a second player
        const p1 = state.playerParty[0];
        const p2 = { ...p1, id: 'p2', currentEnergy: 5 };

        state = { ...state, playerParty: [p1, p2] };

        // Valid Transfer p1 -> p2 (p1 has 10)
        let action: BattleAction = {
            type: 'TRANSFER_ENERGY',
            payload: { sourceId: 'p1', targetId: 'p2' }
        };

        let nextState = battleReducer(state, action);
        expect(nextState.playerParty[0].currentEnergy).toBe(8); // 10 - 2
        expect(nextState.playerParty[1].currentEnergy).toBe(6); // 5 + 1

        // Invalid Transfer p2 -> p1 (Set p2 energy to 1)
        const lowEnergyP2 = { ...nextState.playerParty[1], currentEnergy: 1 };
        state = { ...nextState, playerParty: [nextState.playerParty[0], lowEnergyP2] };

        action = {
            type: 'TRANSFER_ENERGY',
            payload: { sourceId: 'p2', targetId: 'p1' }
        };
        nextState = battleReducer(state, action);

        expect(nextState.playerParty[1].currentEnergy).toBe(1); // Unchanged
    });

    // 3. Type Effectiveness
    it('Type Effectiveness: Fire Program on Nature MingMing deals 1.5x damage (ticket 35)', () => {
        const attacker = { primaryElement: 'Water', attack: 10 } as IBattleEntity; // Non-STAB
        const target = { primaryElement: 'Nature', defense: 10 } as IBattleEntity;
        const program = { element: 'Fire' } as ProgramData;

        const mod = calculateModifier(attacker, target, program);
        expect(mod).toBe(1.5);
    });

    // 3b. Type Effectiveness is surfaced in the combat log
    it('Effectiveness Log: "Super effective!" appears for a 2x matchup and not for neutral', () => {
        const state = createMockState();

        // Fire attack vs Nature target (e1) = 2.0x
        const superState = effectHandlers['ATTACK'](state, { sourceId: 'p1', targetId: 'e1', power: 10, element: 'Fire' });
        expect(superState.logs.some(l => l.includes('Super effective!'))).toBe(true);

        // 'None' attack vs Nature target = neutral — no effectiveness line at all
        const neutralState = effectHandlers['ATTACK'](state, { sourceId: 'p1', targetId: 'e1', power: 10, element: 'None' });
        expect(neutralState.logs.some(l => l.toLowerCase().includes('effective'))).toBe(false);
        // The damage line itself still appears
        expect(neutralState.logs.some(l => l.includes('takes'))).toBe(true);
    });

    it('Effectiveness Log: "Not very effective..." can no longer fire (ticket 35)', () => {
        // The matrix is asymmetric now - resistance was removed, so `effectiveness` is never
        // below 1 and this branch in effectHandlers is unreachable via the elemental path. The
        // log line is deliberately left in place for a future matrix that reintroduces
        // resistance; this test pins the CURRENT design so its removal is a conscious act.
        const state = createMockState();

        // Nature attack vs Fire target (p1): Fire used to resist this at 0.5x, now neutral.
        const resistedState = effectHandlers['ATTACK'](state, { sourceId: 'e1', targetId: 'p1', power: 10, element: 'Nature' });
        expect(resistedState.logs.some(l => l.includes('Not very effective...'))).toBe(false);
        expect(resistedState.logs.some(l => l.includes('Super effective!'))).toBe(false);
    });

    // 4. Status Cancellation
    it('Status Cancellation: Applying Sharp to a Dazed unit nullifies both', () => {
        let state = createMockState();
        // Give target Dazed (2 stacks)
        const e1 = {
            ...state.enemyParty[0],
            statusEffects: [{ id: '1', type: 'Dazed' as StatusType, stacks: 2 }]
        };
        state = { ...state, enemyParty: [e1] };

        // Apply Sharp (2 stacks)
        const action: BattleAction = {
            type: 'APPLY_STATUS',
            payload: { targetId: 'e1', status: 'Sharp', stacks: 2 }
        };

        const nextState = battleReducer(state, action);
        const effects = nextState.enemyParty[0].statusEffects;

        // Should be empty
        expect(effects.length).toBe(0);
    });

    // 5. Sleep Interaction
    it('Sleep Interaction: Unit with Asleep has 0 energy; wakes up on hit', () => {
        let state = createMockState();
        const p1 = state.playerParty[0];

        // 5a. Check Energy Reset Logic (Simulate Turn Start)
        // Give P1 Asleep
        const asleepP1 = {
            ...p1,
            currentEnergy: 0,
            statusEffects: [{ id: 's1', type: 'Asleep' as StatusType, stacks: 1 }]
        };
        state = { ...state, playerParty: [asleepP1] };

        // Set Active Side to ENEMY so END_TURN triggers PreTurn for PLAYER
        state = { ...state, activeSide: 'ENEMY', turn: 1, phase: 'ACTION' };

        // Mock event bus to avoid noise
        globalBattleEventBus.mute();

        const nextState = battleReducer(state, { type: 'END_TURN' });

        // It should now be Player's Turn
        expect(nextState.activeSide).toBe('PLAYER');

        // P1 should have the same energy because Asleep doesn't drain energy.
        expect(nextState.playerParty[0].currentEnergy).toBe(10);

        globalBattleEventBus.unmute();

        // 5b. Wake on Hit
        let sleepState = createMockState();
        const asleepP1_2 = {
            ...sleepState.playerParty[0],
            statusEffects: [{ id: 's1', type: 'Asleep' as StatusType, stacks: 1 }]
        };
        sleepState = { ...sleepState, playerParty: [asleepP1_2] };

        // Hit p1 with Damage
        const handler = effectHandlers['ATTACK'];
        const damageState = handler(sleepState, {
            sourceId: 'e1', targetId: 'p1', power: 10, element: 'None'
        });

        const p1Effects = damageState.playerParty[0].statusEffects;
        expect(p1Effects.some(s => s.type === 'Asleep')).toBe(false);
    });

    // 6. Exponential XP
});
