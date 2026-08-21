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
        id: 'real_mm_instance_123',
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
        primaryElement: 'None',
        daemons: [],
        blueprintsCollected: 0,
        hpIV: 0,
        attackIV: 0,
        defenseIV: 0
    };

    const enemy: IBattleEntity = {
        id: 'real_bot_instance_456',
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
        primaryElement: 'None',
        daemons: [],
        blueprintsCollected: 0,
        hpIV: 0,
        attackIV: 0,
        defenseIV: 0
    };

    return {
        sessionId: 'test-session',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: [player],
        enemyParty: [enemy],
        playerDeck: { ownerId: 'PLAYER', hand: [], drawpile: [], discard: [], exhaust: [], deck: [] },
        enemyDeck: { ownerId: 'ENEMY', hand: [], drawpile: [], discard: [], exhaust: [], deck: [] },
        logs: [],
        osLogs: [],
        procs: [],
        seed: '12345',
        levelUpQueue: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {}
    };
};

// Register OS hooks for testing
Object.values(FIRMWARE_REGISTRY).forEach(os => {
    os.hooks.forEach(h => registerHook(h));
});

describe('OS System - Fenrir', () => {
    it('v1 (UNBOUND_KERNEL): applies 1 Strengthened and 2% recoil on Attack', () => {
        let state = createInitialState('fenrir_v1');
        const attackCard: ProgramEntity = { id: 'card1', dataId: 'card_strike', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [attackCard] } };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'real_mm_instance_123', targetId: 'real_bot_instance_456', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const p1 = newState.playerParty[0];

        // Ticket 84: the recoil is BACK, at its original 2%, now that the OS's Fire bonus
        // pays for it (see CustomFirmware's UNBOUND_KERNEL block).
        expect(p1.currentHp).toBe(98);
        expect(p1.statusEffects.some(s => s.type === StatusType.Strengthened && s.stacks === 1)).toBe(true);
    });

    it('v2 (CINDER_WALL_OS): gains 1 Sharp whenever applying Burn', () => {
        let state = createInitialState('fenrir_v2');
        const burnCard: ProgramEntity = { id: 'card1', dataId: 'card_burn_test', currentCost: 1, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [burnCard] } };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'real_mm_instance_123', targetId: 'real_bot_instance_456', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const p1 = newState.playerParty[0];

        expect(p1.statusEffects.some(s => s.type === StatusType.Sharp && s.stacks === 1)).toBe(true);
        expect(newState.logs).toContain('Player Mingming feeds on the flames!');
    });
});

describe('OS System - Ratatoskr', () => {
    it('v1 (GOSSIP_NODE): heals all allies for 2.5% of max HP on 0-cost programs', () => {
        let state = createInitialState('ratatoskr_v1');
        state = {
            ...state,
            playerParty: state.playerParty.map(e => ({ ...e, currentHp: 50 })),
            playerDeck: { ...state.playerDeck, hand: [{ id: 'card1', dataId: 'card_0_cost_test', currentCost: 0, isPlayable: true }] }
        };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'real_mm_instance_123', targetId: 'real_bot_instance_456', programId: 'card1' } };
        const newState = battleReducer(state, action);
        // Ticket 32: the flat healOverride of 1 became a power-based heal so it scales
        // with level (maxHp * 10 / 400 = 2.5% of max HP). This frame heals 2, not 1.
        expect(newState.playerParty[0].currentHp).toBe(52);
    });

    it('v2 (INSTIGATOR_OS): applies 1 Dazed to target on 0-cost programs', () => {
        let state = createInitialState('ratatoskr_v2');
        const zeroCostCard: ProgramEntity = { id: 'card1', dataId: 'card_0_cost_test', currentCost: 0, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [zeroCostCard] } };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'real_mm_instance_123', targetId: 'real_bot_instance_456', programId: 'card1' } };
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

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'real_mm_instance_123', targetId: 'real_bot_instance_456', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const e1 = newState.enemyParty[0];
        expect(e1.statusEffects.some(s => s.type === StatusType.Dazed && s.stacks === 1)).toBe(true);
    });

    it('v1 (ABYSSAL_INK_SYS): triggers when ANY ally draws a card', () => {
        let state = createInitialState(); // p1 is Fenrir (None OS)
        // Add Kraken as p2
        state = {
            ...state,
            playerParty: [
                state.playerParty[0],
                {
                    ...state.playerParty[0],
                    id: 'p2',
                    name: 'Kraken Ally',
                    activeOS: 'kraken_v1',
                    currentHp: 100
                }
            ],
            playerDeck: {
                ...state.playerDeck,
                hand: [{ id: 'card1', dataId: 'card_draw_test', currentCost: 1, isPlayable: true }],
                drawpile: [{ id: 'd1', dataId: 'deck1', currentCost: 0, isPlayable: true }]
            }
        };

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'real_mm_instance_123', targetId: 'real_bot_instance_456', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const e1 = newState.enemyParty[0];
        expect(e1.statusEffects.some(s => s.type === StatusType.Dazed && s.stacks === 1)).toBe(true);
        expect(newState.logs).toContain('Enemy Mingming is blinded by Abyssal Ink!');
    });

    it('v2 (TIDAL_CRUSH_OS): high-cost Water cards deal 30% more damage', () => {
        let state = createInitialState('kraken_v2');
        const waterCard: ProgramEntity = { id: 'card1', dataId: 'card_water_blast', currentCost: 3, isPlayable: true };
        state = { ...state, playerDeck: { ...state.playerDeck, hand: [waterCard] } };

        // We need to know base damage logic. 
        // card_water_blast has power 30.
        // Standard damage = (power + sourceAtk) * multiplier...
        // Let's just compare with/without OS if possible, or just check the value.

        const action = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: 'real_mm_instance_123', targetId: 'real_bot_instance_456', programId: 'card1' } };
        const newState = battleReducer(state, action);
        const e1 = newState.enemyParty[0];

        // Base damage for power 100, atk 10 vs def 10, under the rev-3.1 pace
        // (ticket 23, /45) and TIDAL_CRUSH's ticket-20 multiplier of 1.2:
        // unboosted floors to 3, boosted 3 * 1.2 = 3.6 => 4.
        // The bound still only passes when the OS boost actually landed.

        expect(e1.currentHp).toBeLessThan(97); // 100 - 3 = 97 unboosted, 100 - 4 = 96 boosted.
    });
});
