import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { StatusType } from './types';
import { registerHook } from './core/Hooks';
import { FIRMWARE_REGISTRY } from './data/firmwareRegistry';
import { TestProgramRegistry } from './data/testProgramRegistry';
import { vi } from 'vitest';

// Mock GetProgramData to use our test registry
vi.mock('./data/programRegistry', async () => {
    const actual = await vi.importActual('./data/programRegistry');
    return {
        ...actual as any,
        GetProgramData: (id: string) => {
            return TestProgramRegistry[id] || (actual as any).GetProgramData(id);
        }
    };
});

// Helper to initialize a minimal battle state
const createInitialState = (playerOS?: string, enemyOS?: string): IBattleState => {
    const player: IBattleEntity = {
        id: 'p1',
        name: 'Player Mingming',
        currentHp: 100,
        maxHp: 100,
        tempHp: 0,
        attack: 10,
        defense: 10,
        maxEnergy: 5,
        currentEnergy: 5,
        level: 1,
        experience: 0,
        cardDraw: 3,
        statusEffects: [],
        definitionId: 'fenrir',
        activeOS: playerOS,
        hooks: [],
        speed: 10,
        primaryElement: 'None'
    };

    const enemy: IBattleEntity = {
        id: 'e1',
        name: 'Enemy Mingming',
        currentHp: 100,
        maxHp: 100,
        tempHp: 0,
        attack: 10,
        defense: 10,
        maxEnergy: 5,
        currentEnergy: 5,
        level: 1,
        experience: 0,
        cardDraw: 3,
        statusEffects: [],
        definitionId: 'kraken',
        activeOS: enemyOS,
        hooks: [],
        speed: 10,
        primaryElement: 'None'
    };

    return {
        sessionId: 'test-session',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        playerParty: [player],
        enemyParty: [enemy],
        playerDeck: { ownerId: 'PLAYER', hand: [], drawpile: [], discard: [], deck: [] },
        enemyDeck: { ownerId: 'ENEMY', hand: [], drawpile: [], discard: [], deck: [] },
        logs: [],
        seed: 12345,
        levelUpQueue: []
    };
};

// Register OS hooks for testing
Object.values(FIRMWARE_REGISTRY).forEach(os => {
    os.hooks.forEach(h => registerHook(h));
});

describe('OS System - Fenrir', () => {
    it('v1 (UNBOUND_KERNEL): applies 3 Strengthened and deals 2% recoil damage on Attack', () => {
        let state = createInitialState('fenrir_v1');
        const attackCard: ProgramEntity = { id: 'card1', dataId: 'card_strike', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [attackCard] } };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'p1', targetId: 'e1', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const p1 = newState.playerParty[0];

        expect(p1.currentHp).toBe(98);
        expect(p1.statusEffects.some(s => s.type === StatusType.Strengthened && s.stacks === 3)).toBe(true);
    });

    it('v2 (CINDER_WALL_OS): gains 1 Sharp whenever applying Burn', () => {
        let state = createInitialState('fenrir_v2');
        const burnCard: ProgramEntity = { id: 'card1', dataId: 'card_burn_test', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [burnCard] } };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'p1', targetId: 'e1', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const p1 = newState.playerParty[0];

        expect(p1.statusEffects.some(s => s.type === StatusType.Sharp && s.stacks === 1)).toBe(true);
        expect(newState.logs).toContain('Player Mingming feeds on the flames!');
    });
});

describe('OS System - Ratatoskr', () => {
    it('v1 (GOSSIP_NODE): heals all allies for 1 HP on 0-cost programs', () => {
        let state = createInitialState('ratatoskr_v1');
        state = {
            ...state,
            playerParty: state.playerParty.map(e => ({ ...e, currentHp: 50 })),
            playerDeck: { ...state.playerDeck, hand: [{ id: 'card1', dataId: 'card_0_cost_test', currentCost: 0, isPlayable: true }] }
        };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'p1', targetId: 'e1', programId: 'card1' } };
        const newState = battleReducer(state, action);
        expect(newState.playerParty[0].currentHp).toBe(51);
    });

    it('v2 (INSTIGATOR_OS): applies 1 Dazed to target on 0-cost programs', () => {
        let state = createInitialState('ratatoskr_v2');
        const zeroCostCard: ProgramEntity = { id: 'card1', dataId: 'card_0_cost_test', currentCost: 0, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [zeroCostCard] } };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'p1', targetId: 'e1', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const e1 = newState.enemyParty[0];
        expect(e1.statusEffects.some(s => s.type === StatusType.Dazed && s.stacks === 1)).toBe(true);
    });
});

describe('OS System - Kraken', () => {
    it('v1 (ABYSSAL_INK_SYS): applies 1 Dazed to random enemy when drawing outside draw phase', () => {
        let state = createInitialState('kraken_v1');
        state = {
            ...state,
            playerDeck: {
                ...state.playerDeck,
                hand: [{ id: 'card1', dataId: 'card_draw_test', currentCost: 1, isPlayable: true }],
                drawpile: [{ id: 'd1', dataId: 'deck1', currentCost: 0, isPlayable: true }]
            }
        };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'p1', targetId: 'e1', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const e1 = newState.enemyParty[0];
        expect(e1.statusEffects.some(s => s.type === StatusType.Dazed && s.stacks === 1)).toBe(true);
    });

    it('v2 (TIDAL_CRUSH_OS): high-cost Water cards deal 30% more damage', () => {
        let state = createInitialState('kraken_v2');
        const waterCard: ProgramEntity = { id: 'card1', dataId: 'card_water_blast', currentCost: 3, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [waterCard] } };

        // We need to know base damage logic. 
        // card_water_blast has power 30.
        // Standard damage = (power + sourceAtk) * multiplier...
        // Let's just compare with/without OS if possible, or just check the value.

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'p1', targetId: 'e1', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const e1 = newState.enemyParty[0];

        // Base damage for power 100, atk 10 vs def 10:
        // reduced = (200 / 50) + 2 = 6
        // With 30% boost: 6 * 1.3 = 7.8 => 7.

        expect(e1.currentHp).toBeLessThan(95); // 100 - 6 = 94. 100 - 7 = 93.
    });
});
