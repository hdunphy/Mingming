/**
 * TICKET 185d — Core Overclock (shown in game as Megingjord) pays flat power per Strength.
 *
 * Henry's Rootfall run: Sköll's 8-power Desperate Strike+ hit for 1,465 and her Ragnarok Edge for
 * 3,986. The daemon multiplied the WHOLE hit by (1 + 0.3 × Strength), on top of Strength already
 * adding +1 power a stack, so Strength counted twice and damage grew with Strength squared.
 *
 * Ruled: it becomes flat power on the power side, the same place Strength itself lands.
 *
 *   core_overclock   +1 power for every 2 Strength  (floor)
 *   core_overclock+  +1 power for every Strength
 *
 * Still uncapped (no arbitrary caps), still on every hit of a multi-hit card, and — being plain
 * power — it goes through the same dials as any other power: Sharp, Dazed and STAB reach it the way
 * they reach the card's printed number, and no more.
 *
 * How the tests measure it: a real attack with the daemon installed and N Strength is compared,
 * hit for hit, with a REFERENCE attack of the same element and cost whose printed power is
 * `printed + expected bonus`, played by an identical caster with the same N Strength and NO
 * daemon. Equal damage means the daemon is worth exactly that much power and nothing more.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { ProgramRegistry } from './data/programRegistry';
import { initDaemonHooks } from './data/daemonHooks';
import type { IBattleEntity, IBattleState, ProgramData, StatusEffectInstance } from './types';

initDaemonHooks();

const FRAME = 1_000_000;
const REF_PREFIX = 'ref_overclock_';

const status = (type: string, stacks: number): StatusEffectInstance => ({ id: `s_${type}`, type, stacks } as StatusEffectInstance);

function caster(opts: { strength: number; daemon?: string; extra?: StatusEffectInstance[] }): IBattleEntity {
    return createSparseEntity({
        id: 'p1', name: 'Caster', currentHp: FRAME, maxHp: FRAME, currentEnergy: 9, maxEnergy: 9,
        primaryElement: 'Fire',
        statusEffects: [
            ...(opts.strength > 0 ? [status('Strengthened', opts.strength)] : []),
            ...(opts.extra ?? []),
        ] as never,
        daemons: opts.daemon ? [{ id: 'd1', dataId: opts.daemon, currentCost: 2, isPlayable: false }] : [],
    });
}

/** The damage one cast of `dataId` does to a fresh enemy. */
function castDamage(c: IBattleEntity, dataId: string): number {
    const state: IBattleState = createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [c],
        enemyParty: [createSparseEntity({ id: 'e1', name: 'Foe', currentHp: FRAME, maxHp: FRAME, primaryElement: 'Water' })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: [{ id: 'h1', dataId, currentCost: 0, isPlayable: true }],
        },
    });
    const after = battleReducer(state, {
        type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' },
    } as never);
    return FRAME - after.enemyParty[0].currentHp;
}

/** A single-hit Fire attack printing `power`, registered under an id that carries the number. */
function reference(power: number, hits = 1): string {
    const id = `${REF_PREFIX}${power}_${hits}`;
    ProgramRegistry[id] = {
        id, name: 'Reference', description: `${power} power.`,
        element: 'Fire', target: 'Single', category: 'Attack', rarity: 'Rare', baseCost: 0,
        constraints: ProgramRegistry.fury_strike.constraints,
        actions: Array.from({ length: hits }, () => ({ type: 'ATTACK', power, target: 'TARGET' })),
    } as unknown as ProgramData;
    return id;
}

afterEach(() => { for (const id of Object.keys(ProgramRegistry)) if (id.startsWith(REF_PREFIX)) delete ProgramRegistry[id]; });

const printed = (id: string): number => ProgramRegistry[id].actions.find(a => a.type === 'ATTACK')!.power as number;

describe('185d — the printed text and data', () => {
    it('both cards say what they do', () => {
        expect(ProgramRegistry.core_overclock.description).toBe('Daemon (exhaust): +1 power for every 2 Strength you hold.');
        expect(ProgramRegistry['core_overclock+'].description).toBe('Daemon (exhaust): +1 power for every Strength you hold.');
    });
});

describe('185d — the bonus at 0, 1, 2, 3, 6 and 21 Strength', () => {
    const STRENGTHS = [0, 1, 2, 3, 6, 21];
    const BASE_BONUS = [0, 0, 1, 1, 3, 10];
    const PLUS_BONUS = [0, 1, 2, 3, 6, 21];
    const CARD = 'fury_strike';

    it.each(STRENGTHS.map((s, i) => [s, BASE_BONUS[i]]))('core_overclock at %i Strength is +%i power', (strength, bonus) => {
        const withDaemon = castDamage(caster({ strength, daemon: 'core_overclock' }), CARD);
        const plainReference = castDamage(caster({ strength }), reference(printed(CARD) + bonus));
        expect(withDaemon).toBe(plainReference);
    });

    it.each(STRENGTHS.map((s, i) => [s, PLUS_BONUS[i]]))('core_overclock+ at %i Strength is +%i power', (strength, bonus) => {
        const withDaemon = castDamage(caster({ strength, daemon: 'core_overclock+' }), CARD);
        const plainReference = castDamage(caster({ strength }), reference(printed(CARD) + bonus));
        expect(withDaemon).toBe(plainReference);
    });

    it('is a real nerf: Fury Strike at 21 Strength is 1.46× the plain hit with the + daemon, where it was 7.3×', () => {
        // Fury Strike (25 power) at 21 Strength: 46 with no daemon, 67 with the + daemon.
        const none = castDamage(caster({ strength: 21 }), CARD);
        const plus = castDamage(caster({ strength: 21, daemon: 'core_overclock+' }), CARD);
        expect(plus / none).toBeGreaterThan(1.4);
        expect(plus / none).toBeLessThan(1.5);
    });

    it('is still uncapped', () => {
        const at100 = castDamage(caster({ strength: 100, daemon: 'core_overclock+' }), CARD);
        const at200 = castDamage(caster({ strength: 200, daemon: 'core_overclock+' }), CARD);
        expect(at200).toBeGreaterThan(at100);
        const plainRef = castDamage(caster({ strength: 200 }), reference(printed(CARD) + 200));
        expect(at200).toBe(plainRef);
    });
});

describe('185d — it is plain power', () => {
    it('lands on every hit of a multi-hit card, the way Strength does (Pack Tactics+)', () => {
        const strength = 8;
        const card = 'pack_tactics+';
        const hits = ProgramRegistry[card].actions.filter(a => a.type === 'ATTACK');
        expect(hits.length).toBeGreaterThan(1);
        const each = hits[0].power as number;
        const withDaemon = castDamage(caster({ strength, daemon: 'core_overclock+' }), card);
        const ref = castDamage(caster({ strength }), reference(each + strength, hits.length));
        expect(withDaemon).toBe(ref);
    });

    it('goes through Sharp and Dazed exactly like printed power does', () => {
        const extra = [status('Sharp', 4), status('Dazed', 3)];
        const withDaemon = castDamage(caster({ strength: 6, daemon: 'core_overclock', extra }), 'fury_strike');
        const ref = castDamage(caster({ strength: 6, extra }), reference(printed('fury_strike') + 3));
        expect(withDaemon).toBe(ref);
    });

    it('is the same on a STAB attack and a non-STAB attack: the bonus is power, not a multiplier', () => {
        // fury_strike is Fire from a Fire body (STAB). The same card from a Water body is not.
        const strength = 12;
        const bonus = 6;
        for (const primaryElement of ['Fire', 'Water'] as const) {
            const mk = (daemon?: string): IBattleEntity => ({ ...caster({ strength, daemon }), primaryElement });
            const withDaemon = castDamage(mk('core_overclock'), 'fury_strike');
            const ref = castDamage(mk(), reference(printed('fury_strike') + bonus));
            expect(withDaemon, primaryElement).toBe(ref);
        }
    });
});

describe('185d — the daemon is the same card to play', () => {
    it('playing core_overclock installs it and the next attack feels it', () => {
        const start = createSparseBattleState({
            activeSide: 'PLAYER', phase: 'ACTION',
            playerParty: [caster({ strength: 10 })],
            enemyParty: [createSparseEntity({ id: 'e1', name: 'Foe', currentHp: FRAME, maxHp: FRAME, primaryElement: 'Water' })],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [
                    { id: 'h1', dataId: 'core_overclock', currentCost: 0, isPlayable: true },
                    { id: 'h2', dataId: 'fury_strike', currentCost: 0, isPlayable: true },
                ],
            },
        });
        const installed = battleReducer(start, {
            type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'p1', programId: 'h1' },
        } as never);
        expect(installed.playerParty[0].daemons.map(d => d.dataId)).toContain('core_overclock');
        const hit = battleReducer(installed, {
            type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h2' },
        } as never);
        const dealt = FRAME - hit.enemyParty[0].currentHp;
        expect(dealt).toBe(castDamage(caster({ strength: 10 }), reference(printed('fury_strike') + 5)));
    });
});
