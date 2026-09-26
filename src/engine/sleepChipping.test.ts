/**
 * Ticket 164b — Attacks chip and wake Asleep; statuses and non-attacks do not.
 */
import { describe, expect, it } from 'vitest';
import { battleReducer } from './battleReducer';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { globalBattleEventBus, type BattleEvent } from './events';
import { getStatusBehavior } from './StatusBehaviors';
import type { IBattleEntity, IBattleState, StatusType } from './types';

function createSleepArena(asleepStacks = 3): IBattleState {
    const setup = matchupScenario({
        player: 'fenrir', enemy: 'control',
        playerOS: 'fenrir_v1', enemyOS: 'control_v1',
        seed: 'sleep-seed',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    return {
        ...base,
        activeSide: 'PLAYER',
        playerParty: base.playerParty.map((e, i) =>
            i === 0 ? { ...e, currentEnergy: 10 } : e),
        enemyParty: base.enemyParty.map((e, i) =>
            i === 0 ? {
                ...e,
                currentHp: 500,
                maxHp: 500,
                statusEffects: [{ id: 's_asleep', type: 'Asleep' as StatusType, stacks: asleepStacks }],
            } : e),
        playerDeck: {
            ...base.playerDeck,
            hand: [
                { id: 'c1', dataId: 'water_slap', currentCost: 0, isPlayable: true },
                { id: 'c2', dataId: 'water_slap', currentCost: 0, isPlayable: true },
                { id: 'c3', dataId: 'water_slap', currentCost: 0, isPlayable: true },
                { id: 'multi', dataId: 'pebble_flurry', currentCost: 0, isPlayable: true },
            ],
        },
    } as IBattleState;
}

describe('Ticket 164b — real attacks chip and wake Asleep', () => {
    it('chips 1 stack per attack card through PLAY_PROGRAM, and wakes on the 3rd hit emitting STATUS_REMOVED', () => {
        let state = createSleepArena(3);
        const player = state.playerParty[0];
        const enemy = state.enemyParty[0];

        const events: BattleEvent[] = [];
        const unsub = globalBattleEventBus.subscribe(e => events.push(e));

        try {
            // First attack
            state = battleReducer(state, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: player.id, targetId: enemy.id, programId: 'c1' },
            });
            let asleep = state.enemyParty[0].statusEffects.find(s => s.type === 'Asleep');
            expect(asleep?.stacks, 'first attack leaves 2 stacks').toBe(2);

            // Second attack
            state = battleReducer(state, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: player.id, targetId: enemy.id, programId: 'c2' },
            });
            asleep = state.enemyParty[0].statusEffects.find(s => s.type === 'Asleep');
            expect(asleep?.stacks, 'second attack leaves 1 stack').toBe(1);

            // Third attack wakes
            state = battleReducer(state, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: player.id, targetId: enemy.id, programId: 'c3' },
            });
            asleep = state.enemyParty[0].statusEffects.find(s => s.type === 'Asleep');
            expect(asleep, 'third attack wakes the sleeper').toBeUndefined();

            // Waking grants StableOS
            const stable = state.enemyParty[0].statusEffects.find(s => s.type === 'StableOS');
            expect(stable, 'waking grants StableOS').toBeDefined();

            // Emitted STATUS_REMOVED
            const removedEvents = events.filter(e => e.type === 'STATUS_REMOVED' && (e as { status?: string }).status === 'Asleep');
            expect(removedEvents.length, 'emits STATUS_REMOVED when waking').toBeGreaterThan(0);
        } finally {
            unsub();
        }
    });

    it('a multi-hit card chips Asleep once per card play, not per hit', () => {
        let state = createSleepArena(3);
        const player = state.playerParty[0];
        const enemy = state.enemyParty[0];

        // Play pebble_flurry (2 hits)
        state = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: player.id, targetId: enemy.id, programId: 'multi' },
        });

        const asleep = state.enemyParty[0].statusEffects.find(s => s.type === 'Asleep');
        expect(asleep?.stacks, 'multi-hit attack chips exactly once per play').toBe(2);
    });

    it('TRIGGER_STATUS detonation and Burn ticks do not chip Asleep', () => {
        // Burn tick via StatusBehavior
        const burnBehavior = getStatusBehavior('Burn');
        const sleeper: IBattleEntity = {
            id: 'e1', name: 'Sleeper', maxHp: 100, currentHp: 100, defense: 10,
            statusEffects: [
                { id: 's_asleep', type: 'Asleep', stacks: 3 },
                { id: 's_burn', type: 'Burn', stacks: 2 },
            ],
        } as unknown as IBattleEntity;

        const burnResult = burnBehavior.endTurn(sleeper.statusEffects[1], sleeper);
        expect(burnResult.damage).toBeGreaterThan(0);
        // Sleeper's Asleep is still 3 because DoT endTurn didn't touch it
        const asleepEffect = sleeper.statusEffects.find(s => s.type === 'Asleep');
        expect(asleepEffect?.stacks).toBe(3);

        // TRIGGER_STATUS via battleReducer
        const state = createSleepArena(3);
        const player = state.playerParty[0];
        const enemy = state.enemyParty[0];
        // Give enemy Poison so TRIGGER_STATUS can detonate it
        const withPoison: IBattleState = {
            ...state,
            enemyParty: [{
                ...enemy,
                statusEffects: [
                    ...enemy.statusEffects,
                    { id: 's_poison', type: 'Poison', stacks: 5 },
                ],
            }],
            playerDeck: {
                ...state.playerDeck,
                hand: [
                    // wither_feast triggers status
                    { id: 'wither', dataId: 'wither_feast', currentCost: 0, isPlayable: true },
                ],
            },
        };

        const afterDetonate = battleReducer(withPoison, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: player.id, targetId: enemy.id, programId: 'wither' },
        });

        const asleepAfterDetonate = afterDetonate.enemyParty[0].statusEffects.find(s => s.type === 'Asleep');
        expect(asleepAfterDetonate?.stacks, 'TRIGGER_STATUS detonation must not chip Asleep').toBe(3);
    });
});
