/**
 * Regression tests for the July 2026 bug-fix series.
 * Each test exercises a bug through the REAL reducer + registry
 * (no mocked GetProgramData) so the wiring itself is covered.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity, StatusEffectInstance } from './types';
import { StatusExecutor } from './actions/ActionExecutors';
import type { HookContext } from './core/Hooks';

function makeEntity(overrides: Partial<IBattleEntity> & { id: string; name: string }): IBattleEntity {
    return {
        currentEnergy: 10, maxEnergy: 10, statusEffects: [],
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        definitionId: 'def1', primaryElement: 'Fire',
        currentHp: 100, maxHp: 100, attack: 10, defense: 10, speed: 10,
        cardDraw: 1, tempHp: 0, daemons: [],
        ...overrides
    } as IBattleEntity;
}

function makeState(overrides: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'bugfix-session',
        seed: '123',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [], osLogs: [], procs: [],
        cardsDrawnThisTurn: 0,
        cardsPlayedThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        activeRelics: [],
        playerParty: [makeEntity({ id: 'p1', name: 'Hero' })],
        enemyParty: [makeEntity({ id: 'e1', name: 'Foe', primaryElement: 'Water' })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: []
        },
        enemyDeck: {
            ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: []
        },
        ...overrides
    } as IBattleState;
}

function withHand(state: IBattleState, cards: Array<{ id: string; dataId: string; cost?: number }>): IBattleState {
    return {
        ...state,
        playerDeck: {
            ...state.playerDeck,
            hand: cards.map(c => ({ id: c.id, dataId: c.dataId, currentCost: c.cost ?? 1, isPlayable: true })) as ProgramEntity[]
        }
    };
}

describe('Bug fix: PLAY_LAST_CARD (Reprogram) echoes the PREVIOUS card', () => {
    it('replays the previously played card, not itself', () => {
        let state = withHand(makeState(), [
            { id: 'h1', dataId: 'fury_strike' },
            { id: 'h2', dataId: 'reprogram' }
        ]);

        state = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });
        const hpAfterStrike = state.enemyParty[0].currentHp;
        expect(hpAfterStrike).toBeLessThan(100);
        expect(state.lastProgramPlayed).toBe('fury_strike');

        state = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h2' } });
        // Reprogram must re-execute fury_strike's attack — enemy takes damage again.
        expect(state.enemyParty[0].currentHp).toBeLessThan(hpAfterStrike);
        expect(state.lastProgramPlayed).toBe('reprogram');
    });

    it('does nothing (but does not crash) when no previous card exists', () => {
        let state = withHand(makeState(), [{ id: 'h1', dataId: 'reprogram' }]);
        state = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });
        expect(state.enemyParty[0].currentHp).toBe(100);
    });
});

describe('Bug fix: STATUS consume + STATUS_CONSUMED heal scaling (Ash Reclamation)', () => {
    it('consumes all Burn stacks and heals per stack consumed', () => {
        let state = makeState({
            playerParty: [makeEntity({ id: 'p1', name: 'Hero', currentHp: 40 })],
            enemyParty: [makeEntity({
                id: 'e1', name: 'Foe',
                // `duration` is legacy fixture noise the engine never reads; kept verbatim so the
                // fixture is unchanged, hence the assertion rather than a plain annotation.
                statusEffects: [{ id: 'st1', type: 'Burn', stacks: 3, duration: -1 } as StatusEffectInstance]
            })]
        });
        state = withHand(state, [{ id: 'h1', dataId: 'ash_reclamation' }]);

        state = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });

        // Burn fully consumed from the target
        expect(state.enemyParty[0].statusEffects.find(s => s.type === 'Burn')).toBeUndefined();
        // Ticket 43: power-based now, so the heal scales with the frame instead of being a flat
        // 10. calculateHeal = 100 maxHp * 30 power / 400 = 7 per stack, x3 consumed = 21.
        expect(state.playerParty[0].currentHp).toBe(61);
    });
});

describe('Bug fix: negative STATUS stacks decrement instead of wiping', () => {
    it('removes only the specified number of stacks', () => {
        const state = makeState({
            enemyParty: [makeEntity({
                id: 'e1', name: 'Foe',
                statusEffects: [{ id: 'st1', type: 'Poison', stacks: 5, duration: -1 } as StatusEffectInstance]
            })]
        });
        const executor = new StatusExecutor();
        const context = { state, triggerDepth: 0 } as HookContext;
        const next = executor.execute(state, 'p1', 'e1', { type: 'STATUS', status: 'Poison', stacks: -2, target: 'TARGET' }, undefined, context);
        const poison = next.enemyParty[0].statusEffects.find(s => s.type === 'Poison');
        expect(poison).toBeDefined();
        expect(poison!.stacks).toBe(3);
    });

    it('removes the status entirely when stacks reach zero', () => {
        const state = makeState({
            enemyParty: [makeEntity({
                id: 'e1', name: 'Foe',
                statusEffects: [{ id: 'st1', type: 'Poison', stacks: 2, duration: -1 } as StatusEffectInstance]
            })]
        });
        const executor = new StatusExecutor();
        const context = { state, triggerDepth: 0 } as HookContext;
        const next = executor.execute(state, 'p1', 'e1', { type: 'STATUS', status: 'Poison', stacks: -2, target: 'TARGET' }, undefined, context);
        expect(next.enemyParty[0].statusEffects.find(s => s.type === 'Poison')).toBeUndefined();
    });
});

describe('Bug fix: dying to two DoTs in one end-turn counts as ONE defeat', () => {
    it('logs a single status defeat for a Burn+Poison death', () => {
        const state = makeState({
            activeSide: 'ENEMY',
            enemyParty: [makeEntity({
                id: 'e1', name: 'Foe', currentHp: 1,
                statusEffects: [
                    { id: 'st1', type: 'Burn', stacks: 2, duration: -1 },
                    { id: 'st2', type: 'Poison', stacks: 2, duration: -1 }
                    // `duration` is legacy fixture noise no engine path reads; kept verbatim.
                ] as unknown as StatusEffectInstance[]
            })]
        });

        const next = battleReducer(state, { type: 'END_TURN' });
        const defeatLogs = next.logs.filter(l => l.includes('DEFEATED BY STATUS'));
        expect(defeatLogs).toHaveLength(1);
    });
});

describe('Bug fix: defeated units cannot act', () => {
    it('ignores PLAY_PROGRAM from a dead source', () => {
        let state = makeState({
            playerParty: [makeEntity({ id: 'p1', name: 'Hero', currentHp: 0 })]
        });
        state = withHand(state, [{ id: 'h1', dataId: 'fury_strike' }]);
        const next = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });
        expect(next).toBe(state);
    });

    it('does not refill energy for dead units on pre-turn', () => {
        const state = makeState({
            activeSide: 'ENEMY', // END_TURN flips to PLAYER pre-turn
            playerParty: [
                makeEntity({ id: 'p1', name: 'Hero', currentHp: 0, currentEnergy: 0 }),
                makeEntity({ id: 'p2', name: 'Ally', currentEnergy: 0 })
            ]
        });
        const next = battleReducer(state, { type: 'END_TURN' });
        expect(next.playerParty.find(e => e.id === 'p1')!.currentEnergy).toBe(0);
        expect(next.playerParty.find(e => e.id === 'p2')!.currentEnergy).toBe(10);
    });
});

describe('Bug fix: exhausted cards go to the exhaust pile', () => {
    it('a played exhaust card lands in exhaust, not nowhere', () => {
        let state = withHand(makeState(), [{ id: 'h1', dataId: 'strength_burst' }]);
        state = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'p1', programId: 'h1' } });
        expect(state.playerDeck.hand).toHaveLength(0);
        expect(state.playerDeck.discard.find(c => c.id === 'h1')).toBeUndefined();
        expect(state.playerDeck.exhaust.find(c => c.id === 'h1')).toBeDefined();
    });
});

describe('Bug fix: enemies only execute intents, never play cards', () => {
    it('returns END_TURN after intents are exhausted even with a playable enemy hand', async () => {
        const { getBestAction } = await import('./ai/TacticalAI');
        // Enemy side active, no intents left, but a full playable hand + energy.
        const state = makeState({
            activeSide: 'ENEMY',
            enemyParty: [makeEntity({ id: 'e1', name: 'Ratatoskr', primaryElement: 'Nature', currentIntent: null })],
            enemyDeck: {
                ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [
                    { id: 'eh1', dataId: 'water_slap', currentCost: 1, isPlayable: true },
                    { id: 'eh2', dataId: 'seed_bomb_v2', currentCost: 2, isPlayable: true }
                ]
            }
        });
        const action = getBestAction(state);
        expect(action.type).toBe('END_TURN');
    });

    it('still executes a pending intent first', async () => {
        const { getBestAction } = await import('./ai/TacticalAI');
        const state = makeState({
            activeSide: 'ENEMY',
            enemyParty: [makeEntity({
                id: 'e1', name: 'Ratatoskr', primaryElement: 'Nature',
                currentIntent: { id: 'rata_nut', name: 'Acorn Throw', intentType: 'Attack', priority: 10, actions: [{ type: 'ATTACK', power: 8, target: 'Single' }] }
            })]
        });
        const action = getBestAction(state);
        expect(action.type).toBe('EXECUTE_INTENT');
    });

    it('player side still uses the card simulation (Balance Tester path)', async () => {
        const { getBestAction } = await import('./ai/TacticalAI');
        const state = makeState({
            activeSide: 'PLAYER',
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [{ id: 'h1', dataId: 'fury_strike', currentCost: 1, isPlayable: true }]
            }
        });
        const action = getBestAction(state);
        expect(action.type).toBe('PLAY_PROGRAM');
    });
});

describe('Bug fix: SHARP_STACKS card scaling actually scales (spike_launch)', () => {
    it('deals more damage with Sharp stacks than without', () => {
        const base = makeState({
            playerParty: [makeEntity({ id: 'p1', name: 'Hero', primaryElement: 'Earth' })],
            enemyParty: [makeEntity({ id: 'e1', name: 'Foe', primaryElement: 'Fire' })]
        });

        // No Sharp
        let s1 = withHand(base, [{ id: 'h1', dataId: 'spike_launch' }]);
        s1 = battleReducer(s1, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });
        const dmgNoSharp = 100 - s1.enemyParty[0].currentHp;

        // 3 Sharp
        let s2 = withHand({
            ...base,
            playerParty: [makeEntity({
                id: 'p1', name: 'Hero', primaryElement: 'Earth',
                statusEffects: [{ id: 'sh', type: 'Sharp', stacks: 3 }]
            })]
        }, [{ id: 'h1', dataId: 'spike_launch' }]);
        s2 = battleReducer(s2, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });
        const dmgWithSharp = 100 - s2.enemyParty[0].currentHp;

        expect(dmgNoSharp).toBeGreaterThan(0);
        expect(dmgWithSharp).toBeGreaterThan(dmgNoSharp);
    });
});
