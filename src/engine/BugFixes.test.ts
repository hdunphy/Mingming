/**
 * Regression tests for the July 2026 bug-fix series.
 * Each test exercises a bug through the REAL reducer + registry
 * (no mocked GetProgramData) so the wiring itself is covered.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { StatusExecutor } from './actions/ActionExecutors';
import type { HookContext } from './core/Hooks';

function makeEntity(overrides: Partial<IBattleEntity> & { id: string; name: string }): IBattleEntity {
    return {
        currentEnergy: 10, maxEnergy: 10, statusEffects: [],
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        level: 10, experience: 0, definitionId: 'def1', primaryElement: 'Fire',
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
        levelUpQueue: [],
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
    it('consumes all Burn stacks and heals 10 per stack consumed', () => {
        let state = makeState({
            playerParty: [makeEntity({ id: 'p1', name: 'Hero', currentHp: 40 })],
            enemyParty: [makeEntity({
                id: 'e1', name: 'Foe',
                statusEffects: [{ id: 'st1', type: 'Burn', stacks: 3, duration: -1 } as any]
            })]
        });
        state = withHand(state, [{ id: 'h1', dataId: 'ash_reclamation' }]);

        state = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });

        // Burn fully consumed from the target
        expect(state.enemyParty[0].statusEffects.find(s => s.type === 'Burn')).toBeUndefined();
        // Healed 10 per stack: 40 + 30 = 70
        expect(state.playerParty[0].currentHp).toBe(70);
    });
});

describe('Bug fix: negative STATUS stacks decrement instead of wiping', () => {
    it('removes only the specified number of stacks', () => {
        const state = makeState({
            enemyParty: [makeEntity({
                id: 'e1', name: 'Foe',
                statusEffects: [{ id: 'st1', type: 'Poison', stacks: 5, duration: -1 } as any]
            })]
        });
        const executor = new StatusExecutor();
        const context = { state, triggerDepth: 0 } as HookContext;
        const next = executor.execute(state, 'p1', 'e1', { type: 'STATUS', status: 'Poison', stacks: -2, target: 'TARGET' } as any, undefined, context);
        const poison = next.enemyParty[0].statusEffects.find(s => s.type === 'Poison');
        expect(poison).toBeDefined();
        expect(poison!.stacks).toBe(3);
    });

    it('removes the status entirely when stacks reach zero', () => {
        const state = makeState({
            enemyParty: [makeEntity({
                id: 'e1', name: 'Foe',
                statusEffects: [{ id: 'st1', type: 'Poison', stacks: 2, duration: -1 } as any]
            })]
        });
        const executor = new StatusExecutor();
        const context = { state, triggerDepth: 0 } as HookContext;
        const next = executor.execute(state, 'p1', 'e1', { type: 'STATUS', status: 'Poison', stacks: -2, target: 'TARGET' } as any, undefined, context);
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
                ] as any
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
            enemyParty: [makeEntity({ id: 'e1', name: 'Ratatoskr', primaryElement: 'Nature', currentIntent: null } as any)],
            enemyDeck: {
                ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [
                    { id: 'eh1', dataId: 'leaf_blade', currentCost: 1, isPlayable: true },
                    { id: 'eh2', dataId: 'seed_bomb_v2', currentCost: 2, isPlayable: true }
                ]
            }
        } as any);
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
            } as any)]
        } as any);
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
        } as any);
        const action = getBestAction(state);
        expect(action.type).toBe('PLAY_PROGRAM');
    });
});

describe('Enemy combat mode guard (locked at battle creation)', () => {
    it('CARDS mode lets the enemy AI play cards from its hand', async () => {
        const { getBestAction } = await import('./ai/TacticalAI');
        const state = makeState({
            activeSide: 'ENEMY',
            enemyMode: 'CARDS',
            enemyParty: [makeEntity({ id: 'e1', name: 'CardUser', primaryElement: 'Nature' })],
            enemyDeck: {
                ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [{ id: 'eh1', dataId: 'leaf_blade', currentCost: 1, isPlayable: true }]
            }
        } as any);
        const action = getBestAction(state);
        expect(action.type).toBe('PLAY_PROGRAM');
    });

    it('default (no enemyMode) is MOVES: no card play', async () => {
        const { getBestAction } = await import('./ai/TacticalAI');
        const state = makeState({
            activeSide: 'ENEMY',
            enemyParty: [makeEntity({ id: 'e1', name: 'MoveUser', currentIntent: null } as any)],
            enemyDeck: {
                ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [{ id: 'eh1', dataId: 'leaf_blade', currentCost: 1, isPlayable: true }]
            }
        } as any);
        expect(getBestAction(state).type).toBe('END_TURN');
    });

    it('createBattleState defaults to MOVES: empty enemy hand, intents generated', async () => {
        const { createBattleState } = await import('./data/battleFactories');
        const { createStarterSave } = await import('./gameTypes');
        const save = createStarterSave('fenrir');
        const state = createBattleState(save as any, ['ratatoskr']);
        expect(state.enemyMode).toBe('MOVES');
        expect(state.enemyDeck.hand).toHaveLength(0);
        expect(state.enemyDeck.drawpile).toHaveLength(0);
        expect(state.enemyParty[0].currentIntent).toBeTruthy();
    });

    it('createBattleState with enemyMode CARDS: hand dealt, no intents', async () => {
        const { createBattleState } = await import('./data/battleFactories');
        const { createStarterSave } = await import('./gameTypes');
        const save = createStarterSave('fenrir');
        const state = createBattleState(save as any, ['ratatoskr'], undefined, { enemyMode: 'CARDS' });
        expect(state.enemyMode).toBe('CARDS');
        expect(state.enemyDeck.hand.length).toBeGreaterThan(0);
        expect(state.enemyParty[0].currentIntent ?? null).toBeNull();
    });
});

describe('XP pacing: decelerating span-based death XP with level-gap scaling', () => {
    it('same-level KO at low level yields ~1/3 of a level (solo receiver)', async () => {
        const { calculateDeathXp } = await import('./effectHandlers');
        const { getExpForLevel } = await import('./types');
        const defeated = makeEntity({ id: 'd', name: 'D', level: 5 });
        const receiver = makeEntity({ id: 'r', name: 'R', level: 5 });
        const span = getExpForLevel(6) - getExpForLevel(5);
        const xp = calculateDeathXp(defeated as any, receiver as any);
        expect(xp).toBe(Math.floor(span / 3));
        expect(xp).toBeLessThan(span); // never a full level from one KO
    });

    it('high-level same-level KOs decelerate (bigger divisor)', async () => {
        const { calculateDeathXp } = await import('./effectHandlers');
        const { getExpForLevel } = await import('./types');
        const defeated = makeEntity({ id: 'd', name: 'D', level: 22 });
        const receiver = makeEntity({ id: 'r', name: 'R', level: 22 });
        const span = getExpForLevel(23) - getExpForLevel(22);
        const xp = calculateDeathXp(defeated as any, receiver as any);
        expect(xp).toBe(Math.floor(span / 5)); // divisor 3 + floor(22/10)
        // A same-level KO must never grant a full level anymore
        expect(xp * 3).toBeLessThan(span * 2);
    });

    it('stomping low-level enemies yields half XP; punching up pays more', async () => {
        const { calculateDeathXp } = await import('./effectHandlers');
        const lowDefeated = makeEntity({ id: 'd1', name: 'D1', level: 5 });
        const highDefeated = makeEntity({ id: 'd2', name: 'D2', level: 40 });
        const receiver = makeEntity({ id: 'r', name: 'R', level: 20 });
        const sameDefeated = makeEntity({ id: 'd3', name: 'D3', level: 20 });

        const stomp = calculateDeathXp(lowDefeated as any, receiver as any);
        const same = calculateDeathXp(sameDefeated as any, receiver as any);
        const up = calculateDeathXp(highDefeated as any, receiver as any);

        // Gap multiplier clamps: 0.5x for stomping, 1.5x cap punching up
        const { getExpForLevel } = await import('./types');
        const lowSpan = getExpForLevel(6) - getExpForLevel(5);
        expect(stomp).toBe(Math.max(1, Math.floor((lowSpan * 0.5) / 5)));
        expect(up).toBeGreaterThan(same);
    });

    it('battle KO still distributes XP and logs the split', () => {
        let state = makeState({
            playerParty: [
                makeEntity({ id: 'p1', name: 'Hero', level: 10, experience: 800 }),
                makeEntity({ id: 'p2', name: 'Ally', level: 10, experience: 800 })
            ],
            enemyParty: [makeEntity({ id: 'e1', name: 'Foe', level: 10, currentHp: 5 })]
        });
        state = withHand(state, [{ id: 'h1', dataId: 'fury_strike' }]);
        state = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } });
        expect(state.enemyParty[0].currentHp).toBe(0);
        expect(state.logs.some(l => l.includes('XP split among 2 allies'))).toBe(true);
        // Each receives floor(span(10)*1.0/4 / 2) = floor(265/4/2) = 33
        expect(state.playerParty[0].experience).toBeGreaterThan(800);
        expect(state.playerParty[0].experience - 800).toBeLessThan(100);
    });
});
