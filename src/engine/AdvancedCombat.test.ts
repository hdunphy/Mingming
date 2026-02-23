import { describe, it, expect, vi } from 'vitest';
import { battleReducer, type BattleAction } from './battleReducer';
import { getStatusBehavior } from './StatusBehaviors';
import type { IBattleState, IBattleEntity, ProgramData, StatusEffectInstance } from './types';
import { StatusType } from './types';
import { calculateDamage } from './combatUtils';
import { registerHook } from './core/Hooks';
import { GetProgramData } from './data/programRegistry';
import { TestProgramRegistry } from './data/testProgramRegistry';
import { DEFAULT_GAME_CONFIG } from './data/gameConfig';

vi.mock('./data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('./data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) => TestProgramRegistry[id] || original.GetProgramData(id))
    };
});

// --- Helper: Mock State ---
function createMockState(): IBattleState {
    const p1: IBattleEntity = {
        id: 'p1', name: 'Hero', level: 10, experience: 0,
        nickname: 'Hero',
        definitionId: 'def1',
        blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0,
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Fire', statusEffects: [],
        tempHp: 0, speed: 10, hooks: [], daemons: []
    };

    const e1: IBattleEntity = {
        id: 'e1', name: 'Villain', level: 10, experience: 0,
        nickname: 'Villain',
        definitionId: 'def2',
        blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0,
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Nature', statusEffects: [],
        tempHp: 0, speed: 10, hooks: [], daemons: []
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
        levelUpQueue: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {}
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
            priority: 50, // ATTACKER
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

    // 3. Burn Scaling (via StatusBehavior.endTurn)
    it('Burn Scaling: 1 stack = 2%, 2 stacks = 5% + shred, 3 stacks = 12% + shred', () => {
        const burnBehavior = getStatusBehavior('Burn');
        const burnConfig = DEFAULT_GAME_CONFIG.status.burnStacks;

        const entity = {
            id: 'e1', name: 'Target', maxHp: 1000, currentHp: 1000, defense: 100
        } as IBattleEntity;

        // 1 Stack
        const burn1: StatusEffectInstance = { id: 'b1', type: 'Burn', stacks: 1 };
        const result1 = burnBehavior.endTurn(burn1, entity);
        expect(result1.damage).toBe(Math.floor(1000 * burnConfig[0].damagePercent));
        expect(result1.defenseShred).toBe(Math.floor(100 * burnConfig[0].defShredPercent));
        expect(result1.updatedInstance).not.toBeNull(); // Permanent

        // 2 Stacks
        const burn2: StatusEffectInstance = { id: 'b2', type: 'Burn', stacks: 2 };
        const result2 = burnBehavior.endTurn(burn2, entity);
        expect(result2.damage).toBe(Math.floor(1000 * burnConfig[1].damagePercent));
        expect(result2.defenseShred).toBe(Math.floor(100 * burnConfig[1].defShredPercent));

        // 3 Stacks
        const burn3: StatusEffectInstance = { id: 'b3', type: 'Burn', stacks: 3 };
        const result3 = burnBehavior.endTurn(burn3, entity);
        expect(result3.damage).toBe(Math.floor(1000 * burnConfig[2].damagePercent));
        expect(result3.defenseShred).toBe(Math.floor(100 * burnConfig[2].defShredPercent));
    });
});
