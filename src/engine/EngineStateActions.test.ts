import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { battleReducer, type BattleAction } from './battleReducer';
import type { IBattleEntity, IBattleState, IMove, StatusEffectInstance } from './types';
import { getExpForLevel } from './types';
import { globalBattleEventBus, type BattleEvent } from './events';
import { registerHook, HookPriority } from './core/Hooks';

/**
 * Coverage for the five general-purpose state actions added by
 * docs/wayfinder/debug-toolkit/tickets/14-engine-state-actions.md:
 * SET_VITALS, REMOVE_STATUS, ADD_CARD_TO_HAND, SET_INTENT, KILL_ENTITY.
 *
 * Each action asserts both what it fires AND what it deliberately does not, plus
 * a hook-cycle case proving resolutionEngine's resolutionStackDepth guard
 * terminates a self-feeding cascade (this is the real version of the placeholder
 * left in SnapshotPattern.test.ts, "Recursion Safety: Trigger depth terminates at 5").
 */

function makeEntity(id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id, name, level: 5, experience: 0,
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Fire', statusEffects: [],
        definitionId: 'fenrir', tempHp: 0, speed: 10, hooks: [],
        daemons: [], blueprintsCollected: 0, hpIV: 0, attackIV: 0, defenseIV: 0,
        ...overrides
    };
}

function makeState(player: IBattleEntity[], enemy: IBattleEntity[]): IBattleState {
    return {
        sessionId: 'test', seed: '123', turn: 1, phase: 'ACTION', activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: player, enemyParty: enemy,
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

type PhaseCounts = Record<string, number>;

/**
 * Registers one hook listening on every phase these actions could plausibly touch
 * and counts each firing, so "fires nothing" is directly assertable.
 */
function registerCountingHook(id: string): PhaseCounts {
    const counts: PhaseCounts = {
        onPostDamage: 0, onHeal: 0, onStatusApplied: 0, onStatusRemoved: 0,
        onUnitFainted: 0, onTurnStart: 0, onTurnEnd: 0, onCardDraw: 0, onActionStart: 0
    };
    const count = (phase: string) => (context: any) => {
        counts[phase] += 1;
        return { state: context.state };
    };
    registerHook({
        id,
        priority: HookPriority.DEFENDER,
        onPostDamage: count('onPostDamage'),
        onHeal: count('onHeal'),
        onStatusApplied: count('onStatusApplied'),
        onStatusRemoved: count('onStatusRemoved'),
        onUnitFainted: count('onUnitFainted'),
        onTurnStart: count('onTurnStart'),
        onTurnEnd: count('onTurnEnd'),
        onCardDraw: count('onCardDraw'),
        onActionStart: count('onActionStart')
    });
    return counts;
}

let events: BattleEvent[] = [];
let unsubscribe: (() => void) | undefined;

beforeEach(() => {
    events = [];
    unsubscribe = globalBattleEventBus.subscribe(e => events.push(e));
});

afterEach(() => {
    unsubscribe?.();
});

const eventsOfType = (type: string) => events.filter(e => e.type === type);

describe('SET_VITALS', () => {

    it('sets HP, energy and tempHp in one action', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);
        const next = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: 40, energy: 3, tempHp: 7, sourceId: 'e1' }
        });

        expect(next.playerParty[0].currentHp).toBe(40);
        expect(next.playerParty[0].currentEnergy).toBe(3);
        expect(next.playerParty[0].tempHp).toBe(7);
    });

    it('clamps HP to [0, maxHp] and energy/tempHp to >= 0', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);

        const over = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: 999, energy: -5, tempHp: -3, sourceId: 'e1' }
        });
        expect(over.playerParty[0].currentHp).toBe(100);
        expect(over.playerParty[0].currentEnergy).toBe(0);
        expect(over.playerParty[0].tempHp).toBe(0);

        const under = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: -50, sourceId: 'e1' }
        });
        expect(under.playerParty[0].currentHp).toBe(0);
    });

    it('HP decrease fires damage-taken hooks and emits DAMAGE_TAKEN, but not heal hooks', () => {
        const counts = registerCountingHook('test_vitals_damage');
        const state = makeState(
            [makeEntity('p1', 'Hero', { hooks: ['test_vitals_damage'] })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: 60, sourceId: 'e1' }
        });

        expect(next.playerParty[0].currentHp).toBe(60);
        expect(counts.onPostDamage).toBe(1);
        expect(counts.onHeal).toBe(0);
        expect(counts.onUnitFainted).toBe(0);

        const damage = eventsOfType('DAMAGE_TAKEN');
        expect(damage).toHaveLength(1);
        expect((damage[0] as any).amount).toBe(40);
        expect((damage[0] as any).targetId).toBe('p1');
        expect(eventsOfType('HEAL')).toHaveLength(0);
    });

    it('the damage hook sees the caller-supplied source, not the target (retaliation targeting)', () => {
        const seen: Array<{ source?: string; target?: string }> = [];
        registerHook({
            id: 'test_vitals_source_attribution',
            priority: HookPriority.DEFENDER,
            onPostDamage: (context: any) => {
                seen.push({ source: context.source?.id, target: context.target?.id });
                return { state: context.state };
            }
        });
        const state = makeState(
            [makeEntity('p1', 'Hero', { hooks: ['test_vitals_source_attribution'] })],
            [makeEntity('e1', 'Villain')]
        );

        battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: 90, sourceId: 'e1' }
        });

        expect(seen).toEqual([{ source: 'e1', target: 'p1' }]);
    });

    it('HP increase fires heal hooks and emits HEAL, but not damage hooks', () => {
        const counts = registerCountingHook('test_vitals_heal');
        const state = makeState(
            [makeEntity('p1', 'Hero', { currentHp: 20, hooks: ['test_vitals_heal'] })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: 55, sourceId: 'e1' }
        });

        expect(next.playerParty[0].currentHp).toBe(55);
        expect(counts.onHeal).toBe(1);
        expect(counts.onPostDamage).toBe(0);

        const heals = eventsOfType('HEAL');
        expect(heals).toHaveLength(1);
        expect((heals[0] as any).amount).toBe(35);
        expect(eventsOfType('DAMAGE_TAKEN')).toHaveLength(0);
    });

    it('energy and tempHp changes fire nothing (no such trigger exists)', () => {
        const counts = registerCountingHook('test_vitals_no_trigger');
        const state = makeState(
            [makeEntity('p1', 'Hero', { hooks: ['test_vitals_no_trigger'] })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', energy: 2, tempHp: 9, sourceId: 'e1' }
        });

        expect(next.playerParty[0].currentEnergy).toBe(2);
        expect(next.playerParty[0].tempHp).toBe(9);
        expect(Object.values(counts).every(c => c === 0)).toBe(true);
        expect(events).toHaveLength(0);
    });

    it('an HP decrease to 0 runs full death processing (XP + onUnitFainted)', () => {
        const counts = registerCountingHook('test_vitals_lethal');
        const state = makeState(
            [makeEntity('p1', 'Hero', { hooks: ['test_vitals_lethal'] })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'e1', hp: 0, sourceId: 'p1' }
        });

        expect(next.enemyParty[0].currentHp).toBe(0);
        expect(counts.onUnitFainted).toBe(1);
        expect(next.playerParty[0].experience).toBeGreaterThan(0);
    });

    it('no-ops when the entity or the sourceId is not a real unit in the battle', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);

        expect(battleReducer(state, {
            type: 'SET_VITALS', payload: { entityId: 'ghost', hp: 1, sourceId: 'e1' }
        })).toBe(state);

        expect(battleReducer(state, {
            type: 'SET_VITALS', payload: { entityId: 'p1', hp: 1, sourceId: 'SYSTEM' }
        })).toBe(state);

        expect(events).toHaveLength(0);
    });
});

describe('REMOVE_STATUS', () => {

    const burn: StatusEffectInstance = { id: 's_burn', type: 'Burn', stacks: 3 };
    const poison: StatusEffectInstance = { id: 's_poison', type: 'Poison', stacks: 2 };

    it('removes only the named status and fires onStatusRemoved once', () => {
        const counts = registerCountingHook('test_remove_one');
        const state = makeState(
            [makeEntity('p1', 'Hero', {
                hooks: ['test_remove_one'],
                statusEffects: [burn, poison]
            })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'REMOVE_STATUS',
            payload: { entityId: 'p1', status: 'Burn' }
        });

        expect(next.playerParty[0].statusEffects.map(s => s.type)).toEqual(['Poison']);
        expect(counts.onStatusRemoved).toBe(1);

        const removedEvents = eventsOfType('STATUS_REMOVED');
        expect(removedEvents).toHaveLength(1);
        expect((removedEvents[0] as any).status).toBe('Burn');
        expect((removedEvents[0] as any).targetId).toBe('p1');
    });

    it('clears every status when no type is given, one event and one hook per instance', () => {
        const counts = registerCountingHook('test_remove_all');
        const state = makeState(
            [makeEntity('p1', 'Hero', {
                hooks: ['test_remove_all'],
                statusEffects: [burn, poison]
            })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'REMOVE_STATUS',
            payload: { entityId: 'p1' }
        });

        expect(next.playerParty[0].statusEffects).toHaveLength(0);
        expect(counts.onStatusRemoved).toBe(2);
        expect(eventsOfType('STATUS_REMOVED').map(e => (e as any).status).sort())
            .toEqual(['Burn', 'Poison']);
        expect(counts.onStatusApplied).toBe(0);
    });

    it('does not grant the Asleep/Stunned StableOS recovery that natural expiry does', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero', {
                statusEffects: [{ id: 's_sleep', type: 'Asleep', stacks: 1 }]
            })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'REMOVE_STATUS',
            payload: { entityId: 'p1', status: 'Asleep' }
        });

        expect(next.playerParty[0].statusEffects).toHaveLength(0);
    });

    it('is a no-op (no event, no hook) when there is nothing to remove', () => {
        const counts = registerCountingHook('test_remove_none');
        const state = makeState(
            [makeEntity('p1', 'Hero', { hooks: ['test_remove_none'], statusEffects: [poison] })],
            [makeEntity('e1', 'Villain')]
        );

        expect(battleReducer(state, {
            type: 'REMOVE_STATUS', payload: { entityId: 'p1', status: 'Burn' }
        })).toBe(state);
        expect(battleReducer(state, {
            type: 'REMOVE_STATUS', payload: { entityId: 'ghost' }
        })).toBe(state);

        expect(counts.onStatusRemoved).toBe(0);
        expect(events).toHaveLength(0);
    });
});

describe('ADD_CARD_TO_HAND', () => {

    it('adds to the requested side hand via handleGenerateCard', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);

        const afterPlayer = battleReducer(state, {
            type: 'ADD_CARD_TO_HAND',
            payload: { side: 'PLAYER', dataId: 'card_fireball' }
        });
        expect(afterPlayer.playerDeck.hand).toHaveLength(1);
        expect(afterPlayer.playerDeck.hand[0].dataId).toBe('card_fireball');
        // handleGenerateCard's token contract: zero cost, playable, fresh instance id.
        expect(afterPlayer.playerDeck.hand[0].currentCost).toBe(0);
        expect(afterPlayer.playerDeck.hand[0].isPlayable).toBe(true);
        expect(afterPlayer.playerDeck.hand[0].id).toBeTruthy();
        expect(afterPlayer.enemyDeck.hand).toHaveLength(0);

        const afterEnemy = battleReducer(state, {
            type: 'ADD_CARD_TO_HAND',
            payload: { side: 'ENEMY', dataId: 'card_fireball' }
        });
        expect(afterEnemy.enemyDeck.hand).toHaveLength(1);
        expect(afterEnemy.playerDeck.hand).toHaveLength(0);
    });

    it('inherits handleGenerateCard hand-size rejection instead of reimplementing it', () => {
        const full = Array.from({ length: 9 }, (_, i) => ({
            id: 'c' + i, dataId: 'card_fireball', currentCost: 1, isPlayable: true
        }));
        const base = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);
        const state: IBattleState = { ...base, playerDeck: { ...base.playerDeck, hand: full } };

        const next = battleReducer(state, {
            type: 'ADD_CARD_TO_HAND',
            payload: { side: 'PLAYER', dataId: 'card_fireball' }
        });

        expect(next.playerDeck.hand).toHaveLength(9);
        expect(next.logs.some(l => l.includes('Hand full'))).toBe(true);
    });

    it('fires no hooks and emits no events', () => {
        const counts = registerCountingHook('test_add_card');
        const state = makeState(
            [makeEntity('p1', 'Hero', { hooks: ['test_add_card'] })],
            [makeEntity('e1', 'Villain')]
        );

        battleReducer(state, {
            type: 'ADD_CARD_TO_HAND',
            payload: { side: 'PLAYER', dataId: 'card_fireball' }
        });

        expect(Object.values(counts).every(c => c === 0)).toBe(true);
        expect(events).toHaveLength(0);
    });
});

describe('SET_INTENT', () => {

    const move: IMove = {
        id: 'move_slam', name: 'Slam', intentType: 'Attack', priority: 1,
        actions: [{ type: 'ATTACK', target: 'TARGET', power: 10 } as any]
    };

    it('sets the telegraphed move and fires nothing', () => {
        const counts = registerCountingHook('test_set_intent');
        const state = makeState(
            [makeEntity('p1', 'Hero', { hooks: ['test_set_intent'] })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'SET_INTENT',
            payload: { entityId: 'e1', move }
        });

        expect(next.enemyParty[0].currentIntent).toEqual(move);
        expect(Object.values(counts).every(c => c === 0)).toBe(true);
        expect(events).toHaveLength(0);
    });

    it('clears the intent with null and no-ops on an unknown entity', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero')],
            [makeEntity('e1', 'Villain', { currentIntent: move })]
        );

        const cleared = battleReducer(state, {
            type: 'SET_INTENT',
            payload: { entityId: 'e1', move: null }
        });
        expect(cleared.enemyParty[0].currentIntent).toBeNull();

        expect(battleReducer(state, {
            type: 'SET_INTENT', payload: { entityId: 'ghost', move }
        })).toBe(state);
    });
});

describe('KILL_ENTITY', () => {

    it('runs full death processing: 0 HP, onUnitFainted, XP award and levelUpQueue', () => {
        const counts = registerCountingHook('test_kill');
        // Level 1 receiver sitting one point below the level-2 boundary, so the
        // knockout XP must both land and cascade into the level-up queue.
        const state = makeState(
            [makeEntity('p1', 'Hero', {
                level: 1, experience: getExpForLevel(2) - 1, hooks: ['test_kill']
            })],
            [makeEntity('e1', 'Villain', { level: 5 })]
        );

        const next = battleReducer(state, {
            type: 'KILL_ENTITY',
            payload: { entityId: 'e1', sourceId: 'p1' }
        });

        expect(next.enemyParty[0].currentHp).toBe(0);
        expect(counts.onUnitFainted).toBe(1);
        expect(next.playerParty[0].experience).toBeGreaterThanOrEqual(getExpForLevel(2));
        expect(next.playerParty[0].level).toBeGreaterThan(1);
        expect(next.levelUpQueue.length).toBeGreaterThan(0);
        expect(next.levelUpQueue[0].entityId).toBe('p1');
        expect(eventsOfType('LEVEL_UP').length).toBeGreaterThan(0);
    });

    it('credits the kill to the supplied source in the log', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);
        const next = battleReducer(state, {
            type: 'KILL_ENTITY',
            payload: { entityId: 'e1', sourceId: 'p1' }
        });
        expect(next.logs.some(l => l.includes('Villain') && l.includes('Hero'))).toBe(true);
    });

    it('does not re-run death processing on an already-defeated unit', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero')],
            [makeEntity('e1', 'Villain', { currentHp: 0 })]
        );

        expect(battleReducer(state, {
            type: 'KILL_ENTITY', payload: { entityId: 'e1', sourceId: 'p1' }
        })).toBe(state);
    });

    it('no-ops when the entity or the sourceId is not a real unit', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);

        expect(battleReducer(state, {
            type: 'KILL_ENTITY', payload: { entityId: 'ghost', sourceId: 'p1' }
        })).toBe(state);
        expect(battleReducer(state, {
            type: 'KILL_ENTITY', payload: { entityId: 'e1', sourceId: 'SYSTEM' }
        })).toBe(state);
    });
});

describe('Recursion safety: resolutionStackDepth terminates a hook cycle', () => {

    /**
     * The real version of SnapshotPattern.test.ts's placeholder. A hook that
     * re-dispatches the action which fired it is exactly the mid-resolution
     * injection these actions make possible, and it is a genuine cycle:
     * SET_VITALS (heal) -> onHeal -> SET_VITALS (heal) -> ...
     *
     * resolutionEngine's module-level resolutionStackDepth (cap MAX_RESOLUTION_DEPTH
     * = 12, incremented/decremented in try/finally) is what stops it. The context
     * triggerDepth cannot: every one of these contexts is rebuilt with
     * triggerDepth: 0.
     */
    it('a self-feeding SET_VITALS heal cascade stops at the depth cap instead of hanging', () => {
        let runs = 0;
        registerHook({
            id: 'test_heal_cycle',
            priority: HookPriority.DEFENDER,
            onHeal: (context: any) => {
                runs += 1;
                // Safety valve: if the guard ever regressed this fails the assertion
                // below rather than blowing the JS stack and killing the suite.
                if (runs > 100) return { state: context.state };
                const live = context.state.playerParty.find((e: IBattleEntity) => e.id === 'p1');
                if (!live || live.currentHp >= live.maxHp) return { state: context.state };
                return {
                    state: battleReducer(context.state, {
                        type: 'SET_VITALS',
                        payload: { entityId: 'p1', hp: live.currentHp + 1, sourceId: 'e1' }
                    } as BattleAction)
                };
            }
        });

        const state = makeState(
            [makeEntity('p1', 'Hero', { currentHp: 1, hooks: ['test_heal_cycle'] })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: 2, sourceId: 'e1' }
        });

        // 12 nested executeResolutionStack frames run the hook; the 13th entry is
        // refused by the guard, so the cascade is bounded and returns normally.
        expect(runs).toBe(12);
        expect(next.playerParty[0].currentHp).toBe(14);
        expect(next.playerParty[0].currentHp).toBeLessThan(next.playerParty[0].maxHp);
    });

    it('the depth counter unwinds, so a later action still fires its hooks', () => {
        const counts = registerCountingHook('test_after_cycle');
        const state = makeState(
            [makeEntity('p1', 'Hero', { currentHp: 50, hooks: ['test_after_cycle'] })],
            [makeEntity('e1', 'Villain')]
        );

        const next = battleReducer(state, {
            type: 'SET_VITALS',
            payload: { entityId: 'p1', hp: 40, sourceId: 'e1' }
        });

        expect(counts.onPostDamage).toBe(1);
        expect(next.playerParty[0].currentHp).toBe(40);
    });
});
