/**
 * Ticket 164e — Replays evaluate card action conditionals.
 * Reprogram, Echo macro, and VALHALLA free cast of equilibrium fire exactly one branch at 90% and 30% HP.
 */
import { describe, expect, it } from 'vitest';
import { battleReducer } from './battleReducer';
import { resolveProgramFree } from './actions/ActionExecutors';
import { GetProgramData } from './data/programRegistry';
import type { IBattleEntity, IBattleState, ProgramEntity } from './types';

function makeUnit(id: string, name: string, currentHp: number, maxHp: number = 100): IBattleEntity {
    return {
        id,
        name,
        currentHp,
        maxHp,
        tempHp: 0,
        attack: 10,
        defense: 10,
        maxEnergy: 5,
        currentEnergy: 5,
        cardDraw: 3,
        statusEffects: [],
        definitionId: 'fenrir',
        hooks: [],
        speed: 10,
        primaryElement: 'Nature',
        daemons: [],
        blueprintsCollected: 0,
        hpIV: 0,
        attackIV: 0,
        defenseIV: 0,
    };
}

function makeCard(id: string, dataId: string): ProgramEntity {
    return {
        id,
        dataId,
        currentCost: 0,
        isPlayable: true,
    };
}

function makeBattleState(caster: IBattleEntity, hand: ProgramEntity[] = []): IBattleState {
    const enemy = makeUnit('e1', 'Target Enemy', 100, 100);
    return {
        sessionId: 'test-replay',
        seed: 'test-seed-164e',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeDrivers: [],
        playerParty: [caster],
        enemyParty: [enemy],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['equilibrium'],
            drawpile: [],
            hand,
            discard: [makeCard('eq_discard', 'equilibrium')],
            exhaust: [],
        },
        enemyDeck: {
            ownerId: 'ENEMY',
            deck: [],
            drawpile: [],
            hand: [],
            discard: [],
            exhaust: [],
        },
        logs: [],
        osLogs: [],
        procs: [],
        lastProgramPlayed: 'equilibrium',
        lastProgramBySide: { PLAYER: 'equilibrium', ENEMY: null },
        cardsPlayedThisTurn: 1,
        cardsDrawnThisTurn: 0,
        counters: {},
    };
}

describe('Ticket 164e — Replays fire only matching branch of conditional card', () => {
    describe('Reprogram', () => {
        it('at 90% HP: grants 3 Strength and does not heal', () => {
            const caster = makeUnit('p1', 'Caster', 90, 100);
            const state = makeBattleState(caster, [makeCard('rp', 'reprogram')]);

            const after = battleReducer(state, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: 'p1', targetId: 'p1', programId: 'rp' },
            });

            const p1 = after.playerParty[0];
            const strength = p1.statusEffects.find(s => s.type === 'Strengthened');
            expect(strength?.stacks, 'Gains Strengthened at 90% HP').toBe(3);
            expect(p1.currentHp, 'Does not heal at 90% HP').toBe(90);
        });

        it('at 30% HP: heals and does not grant Strength', () => {
            const caster = makeUnit('p1', 'Caster', 30, 100);
            const state = makeBattleState(caster, [makeCard('rp', 'reprogram')]);

            const after = battleReducer(state, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: 'p1', targetId: 'p1', programId: 'rp' },
            });

            const p1 = after.playerParty[0];
            const strength = p1.statusEffects.find(s => s.type === 'Strengthened');
            expect(strength, 'Does not gain Strengthened at 30% HP').toBeUndefined();
            expect(p1.currentHp, 'Heals at 30% HP').toBeGreaterThan(30);
        });
    });

    describe('Echo macro', () => {
        it('at 90% HP: grants 3 Strength and does not heal', () => {
            const caster = makeUnit('p1', 'Caster', 90, 100);
            const state = makeBattleState(caster);

            const after = battleReducer(state, {
                type: 'FIRE_MACRO',
                payload: { macroId: 'echo', sourceId: 'p1', targetId: 'e1' },
            });

            const p1 = after.playerParty[0];
            const strength = p1.statusEffects.find(s => s.type === 'Strengthened');
            expect(strength?.stacks, 'Gains Strengthened at 90% HP').toBe(3);
            expect(p1.currentHp, 'Does not heal at 90% HP').toBe(90);
        });

        it('at 30% HP: heals and does not grant Strength', () => {
            const caster = makeUnit('p1', 'Caster', 30, 100);
            const state = makeBattleState(caster);

            const after = battleReducer(state, {
                type: 'FIRE_MACRO',
                payload: { macroId: 'echo', sourceId: 'p1', targetId: 'e1' },
            });

            const p1 = after.playerParty[0];
            const strength = p1.statusEffects.find(s => s.type === 'Strengthened');
            expect(strength, 'Does not gain Strengthened at 30% HP').toBeUndefined();
            expect(p1.currentHp, 'Heals at 30% HP').toBeGreaterThan(30);
        });
    });

    describe('resolveProgramFree (VALHALLA)', () => {
        it('at 90% HP: grants 3 Strength and does not heal', () => {
            const caster = makeUnit('p1', 'Caster', 90, 100);
            const state = makeBattleState(caster);
            const programData = GetProgramData('equilibrium');

            const after = resolveProgramFree(
                state,
                'p1',
                'inst-eq',
                programData,
                { source: caster, state, triggerDepth: 0 } as never
            );

            const p1 = after.playerParty[0];
            const strength = p1.statusEffects.find(s => s.type === 'Strengthened');
            expect(strength?.stacks, 'Gains Strengthened at 90% HP').toBe(3);
            expect(p1.currentHp, 'Does not heal at 90% HP').toBe(90);
        });

        it('at 30% HP: heals and does not grant Strength', () => {
            const caster = makeUnit('p1', 'Caster', 30, 100);
            const state = makeBattleState(caster);
            const programData = GetProgramData('equilibrium');

            const after = resolveProgramFree(
                state,
                'p1',
                'inst-eq',
                programData,
                { source: caster, state, triggerDepth: 0 } as never
            );

            const p1 = after.playerParty[0];
            const strength = p1.statusEffects.find(s => s.type === 'Strengthened');
            expect(strength, 'Does not gain Strengthened at 30% HP').toBeUndefined();
            expect(p1.currentHp, 'Heals at 30% HP').toBeGreaterThan(30);
        });
    });
});
