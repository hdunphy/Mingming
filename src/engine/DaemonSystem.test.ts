import { describe, it, expect, beforeEach, vi } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { globalBattleEventBus } from './events';
import { GetProgramData } from './data/programRegistry';

const TestProgramRegistry: Record<string, any> = {
    'scratch': { id: 'scratch', name: 'Scratch', power: 40, element: 'None', category: 'Attack', target: 'Single', baseCost: 1, actions: [{ type: 'ATTACK', power: 40, target: 'TARGET' }] },
    'whirlpool': { id: 'whirlpool', name: 'Whirlpool', power: 30, element: 'Water', category: 'Attack', target: 'Single', baseCost: 2, actions: [{ type: 'ATTACK', power: 30, target: 'TARGET' }, { type: 'DRAW', count: 1 }] },
    'recursion_daemon': { id: 'recursion_daemon', name: 'RECURSION_DAEMON', category: 'Daemon', hooks: ['recursion_daemon_hook'] },
    'thermal_overload': { id: 'thermal_overload', name: 'THERMAL_OVERLOAD', category: 'Daemon', hooks: ['thermal_overload_hook', 'thermal_overload_logic', 'thermal_overload_burn_boost'] }
};

vi.mock('./data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('./data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) => TestProgramRegistry[id] || original.GetProgramData(id))
    };
});

function createMockState(): IBattleState {
    return {
        sessionId: 'test-session',
        seed: '123',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        osLogs: [],
        procs: [],
        cardsPlayedThisTurn: 0,
        playerParty: [
            {
                id: 'p1',
                currentEnergy: 10,
                maxEnergy: 10,
                statusEffects: [],
                name: 'Hero',
                hpIV: 0,
                attackIV: 0,
                defenseIV: 0,
                blueprintsCollected: 0,
                level: 10,
                experience: 0,
                definitionId: 'fenrir',
                primaryElement: 'Fire',
                currentHp: 100,
                maxHp: 100,
                attack: 10,
                defense: 10,
                speed: 10,
                cardDraw: 1,
                tempHp: 0,
                daemons: []
            } as IBattleEntity
        ],
        enemyParty: [
            {
                id: 'e1',
                currentEnergy: 10,
                maxEnergy: 10,
                statusEffects: [],
                name: 'Enemy',
                hpIV: 0,
                attackIV: 0,
                defenseIV: 0,
                blueprintsCollected: 0,
                level: 10,
                experience: 0,
                definitionId: 'fenrir',
                primaryElement: 'Fire',
                currentHp: 100,
                maxHp: 100,
                attack: 10,
                defense: 10,
                speed: 10,
                cardDraw: 1,
                tempHp: 0,
                daemons: []
            } as IBattleEntity
        ],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['recursion_daemon', 'thermal_overload', 'scratch'],
            hand: [
                { id: 'h1', dataId: 'recursion_daemon', currentCost: 1, isPlayable: true },
                { id: 'h2', dataId: 'thermal_overload', currentCost: 2, isPlayable: true },
                { id: 'h3', dataId: 'scratch', currentCost: 1, isPlayable: true }
            ] as ProgramEntity[],
            drawpile: [
                { id: 'h4', dataId: 'scratch', currentCost: 1, isPlayable: true }
            ],
            discard: []
        },
        enemyDeck: {
            ownerId: 'ENEMY',
            deck: [],
            drawpile: [],
            hand: [],
            discard: []
        },
        levelUpQueue: []
    };
}

describe('Daemon System', () => {
    let initialState: IBattleState;

    beforeEach(() => {
        initialState = createMockState();
        vi.spyOn(globalBattleEventBus, 'emit');
    });

    it('should install a Daemon card instead of discarding it', () => {
        const action = {
            type: 'PLAY_PROGRAM' as const,
            payload: { sourceId: 'p1', targetId: 'p1', programId: 'h1' } // Play recursion_daemon
        };

        const newState = battleReducer(initialState, action);

        const p1 = newState.playerParty.find(p => p.id === 'p1');
        expect(p1?.daemons.length).toBe(1);
        expect(p1?.daemons[0].dataId).toBe('recursion_daemon');

        // Should be removed from hand
        expect(newState.playerDeck.hand.find(c => c.id === 'h1')).toBeUndefined();
        // Should NOT be in discard
        expect(newState.playerDeck.discard.find(c => c.id === 'h1')).toBeUndefined();
    });

    it('RECURSION_DAEMON should heal on non-natural card draws', () => {
        // 1. Install Daemon
        let state = battleReducer(initialState, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'p1', programId: 'h1' }
        });

        // 2. Reduce HP for testing heal
        state = {
            ...state,
            playerParty: state.playerParty.map(e => e.id === 'p1' ? { ...e, currentHp: 50 } : e)
        };

        // 3. Trigger a draw effect (h3 is scratch, but let's assume we play something that draws)
        // Wait, scratch doesn't draw. Let's use 'whirlpool' if it exists or just mock a draw action.
        // Actually, I can just use executeDraw from resolutionEngine if I exported it.
        // Or I can add a card to hand that has a DRAW action.

        // Let's modify h3 to be 'whirlpool' (which has a DRAW action)
        const stateWithWhirlpool = {
            ...state,
            playerDeck: {
                ...state.playerDeck,
                hand: state.playerDeck.hand.map(c => c.id === 'h3' ? { ...c, dataId: 'whirlpool' } : c)
            }
        };

        const newState = battleReducer(stateWithWhirlpool, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'h3' }
        });

        const p1 = newState.playerParty.find(p => p.id === 'p1');
        // Initial 50 + 5 from Daemon = 55
        expect(p1?.currentHp).toBe(55);
        expect(newState.logs).toContain("Hero's RECURSION_DAEMON repairs 5 HP!");
    });

    it('THERMAL_OVERLOAD should increase damage and deal recoil', () => {
        // 1. Install Daemon
        let state = battleReducer(initialState, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'p1', programId: 'h2' }
        });

        // 2. Play an attack (h3 is scratch: power 40)
        // We need to bypass some damage calculation complexity for prediction, 
        // but scratch deals 40 base. With 10 Atk vs 10 Def, it should be 40.
        // With +25% it should be 50.

        const attackAction = {
            type: 'PLAY_PROGRAM' as const,
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'h3' }
        };

        const stateAfterAttack = battleReducer(state, attackAction);
        const e1 = stateAfterAttack.enemyParty.find(e => e.id === 'e1');
        // 100 - 7 = 93
        expect(e1?.currentHp).toBe(93);

        // 3. End Turn and check recoil
        const stateAfterTurn = battleReducer(stateAfterAttack, { type: 'END_TURN' });
        const p1 = stateAfterTurn.playerParty.find(p => p.id === 'p1');
        // 100 - 5 = 95
        expect(p1?.currentHp).toBe(95);
        expect(stateAfterTurn.logs).toContain("Hero's THERMAL_OVERLOAD causes 5 overheat damage!");
    });

    it('should clear Daemons when a MingMing faints', () => {
        // 1. Install Daemon
        let state = battleReducer(initialState, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'p1', programId: 'h1' }
        });

        // 2. Deal lethal damage to p1
        // We'll use a direct mutation for simplicity in test setup if needed, 
        // or just play a high damage card.
        // Let's just set HP to 1 and then apply a small attack.
        state = {
            ...state,
            playerParty: state.playerParty.map(e => e.id === 'p1' ? { ...e, currentHp: 1 } : e)
        };

        // We need an enemy action. Let's switch to enemy turn or just force a status application that deals damage if needed.
        // Actually, handleAttack calls checkDefeat.

        // Mocking an enemy attack on p1
        const killAction = {
            type: 'APPLY_STATUS' as const,
            payload: { targetId: 'p1', status: 'Poison', stacks: 1 } // Status application can deal damage if behavior says so? 
            // Better use a direct HP mutation via action if possible, but APPLY_STATUS doesn't deal dmg by default unless it's a specific behavior.
        };

        // Let's use handleAttack directly if possible or just use battleReducer with a custom action if supported.
        // Since we only have specific actions, let's use a scratch from enemy.
        const enemyState = {
            ...state,
            activeSide: 'ENEMY' as const,
            phase: 'ACTION' as const,
            enemyDeck: {
                ...state.enemyDeck,
                hand: [{ id: 'eh1', dataId: 'scratch', currentCost: 0, isPlayable: true }]
            }
        };

        const stateAfterKill = battleReducer(enemyState, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'e1', targetId: 'p1', programId: 'eh1' }
        });

        const p1 = stateAfterKill.playerParty.find(p => p.id === 'p1');
        expect(p1?.currentHp).toBe(0);
        expect(p1?.daemons.length).toBe(0); // Should be cleared
    });
});
