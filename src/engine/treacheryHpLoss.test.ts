/**
 * TICKET 185b — TREACHERY_KERNEL (skoll_v1) pays only when an ally LOSES HP to an enemy.
 *
 * Henry (2026-10-02): *"if an ally gets damaged by an enemy."* The hook used to be an
 * `onPostDamage` with `source: OPPONENT, target: ALLY`, and `onPostDamage` runs after every enemy
 * action that resolves on your side, damage or not. Two things paid Sköll that should not have:
 * a hit Bark Shield soaked completely, and an enemy card that only applied a status (Corrosive
 * Bolt, ROOT ROT's Poison). The gym fight's 21 Strength in one enemy turn came from those.
 *
 * Every test drives the real reducer with real card data. The numbers are not the point; whether
 * the Strength arrives at all is.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { GetProgramData } from './data/programRegistry';
import type { IBattleState, IBattleEntity, StatusEffectInstance } from './types';

const FRAME = 1000;

function unit(id: string, name: string, extra: Partial<IBattleEntity> = {}): IBattleEntity {
    return createSparseEntity({
        id, name, currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5, ...extra,
    });
}

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.filter(s => s.type === type).reduce((n, s) => n + s.stacks, 0);

const status = (type: string, n: number): StatusEffectInstance => ({ id: `s_${type}`, type, stacks: n } as StatusEffectInstance);

interface Board {
    /** What each player body carries, in order. Index 0 is Sköll herself. */
    skoll?: Partial<IBattleEntity>;
    ally?: Partial<IBattleEntity>;
}

/** Sköll (p1) and an ally (p2) on the player side; one enemy (e1). */
function board(opts: Board = {}): IBattleState {
    return createSparseBattleState({
        activeSide: 'ENEMY',
        phase: 'ACTION',
        playerParty: [
            unit('p1', 'Skoll', { activeOS: 'skoll_v1', ...(opts.skoll ?? {}) }),
            unit('p2', 'Ally', opts.ally ?? {}),
        ],
        enemyParty: [unit('e1', 'Foe')],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
    });
}

/** The enemy plays `dataId` at `targetId`. */
function enemyPlays(state: IBattleState, dataId: string, targetId: string): IBattleState {
    const withCard: IBattleState = {
        ...state,
        enemyDeck: {
            ...state.enemyDeck,
            hand: [{ id: 'h1', dataId, currentCost: GetProgramData(dataId).baseCost as number, isPlayable: true }],
        },
    };
    return battleReducer(withCard, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'e1', targetId, programId: 'h1' },
    } as never);
}

const skollStrength = (s: IBattleState): number => stacks(s.playerParty[0], 'Strengthened');

describe('185b — TREACHERY pays on a hit that costs HP', () => {
    it('+1 when an enemy hits an ally', () => {
        const state = enemyPlays(board(), 'tackle', 'p2');
        expect(state.playerParty[1].currentHp).toBeLessThan(FRAME);
        expect(skollStrength(state)).toBe(1);
    });

    it('+1 when an enemy hits Sköll herself (ALLY includes the owner)', () => {
        const state = enemyPlays(board(), 'tackle', 'p1');
        expect(state.playerParty[0].currentHp).toBeLessThan(FRAME);
        expect(skollStrength(state)).toBe(1);
    });

    it('+2 with AMPLIFIER', () => {
        const state = enemyPlays(board({ skoll: { patches: ['amplifier'] } }), 'tackle', 'p2');
        expect(skollStrength(state)).toBe(2);
    });

    it('a hit Bark Shield only PARTLY absorbs still pays +1', () => {
        // 1% of 1,000 is a 10 HP shield, and a Tackle lands for far more than that.
        const state = enemyPlays(board({ ally: { statusEffects: [status('BarkShield', 1)] } }), 'tackle', 'p2');
        expect(state.playerParty[1].currentHp).toBeLessThan(FRAME);
        expect(skollStrength(state)).toBe(1);
    });
});

describe('185b — TREACHERY does not pay when nothing was lost', () => {
    it('a hit Bark Shield absorbs completely pays nothing', () => {
        // 100% of max HP is a 1,000 HP shield.
        const state = enemyPlays(board({ ally: { statusEffects: [status('BarkShield', 100)] } }), 'tackle', 'p2');
        expect(state.playerParty[1].currentHp).toBe(FRAME);
        expect(state.logs.join('\n')).toMatch(/Bark Shield absorbed/);
        expect(skollStrength(state)).toBe(0);
    });

    it('a fully soaked hit on Sköll herself pays nothing either', () => {
        const state = enemyPlays(board({ skoll: { statusEffects: [status('BarkShield', 100)] } }), 'tackle', 'p1');
        expect(state.playerParty[0].currentHp).toBe(FRAME);
        expect(skollStrength(state)).toBe(0);
    });

    it('an enemy card that only applies a status pays nothing (Corrosive Bolt)', () => {
        const state = enemyPlays(board(), 'corrosive_bolt', 'p2');
        expect(stacks(state.playerParty[1], 'Poison')).toBeGreaterThan(0);
        expect(state.playerParty[1].currentHp).toBe(FRAME);
        expect(skollStrength(state)).toBe(0);
    });

    it('a Burn tick on an ally pays nothing', () => {
        const burning = board({ ally: { statusEffects: [status('Burn', 2)] } });
        // Burn and Poison tick at the START of their owner's turn, so the enemy ending theirs is
        // what makes the tick happen.
        const after = battleReducer(burning, { type: 'END_TURN' } as never);
        expect(after.playerParty[1].currentHp).toBeLessThan(FRAME);
        expect(skollStrength(after)).toBe(0);
    });

    it('a Poison tick on an ally pays nothing', () => {
        const poisoned = board({ ally: { statusEffects: [status('Poison', 3)] } });
        // Burn and Poison tick at the START of their owner's turn, so the enemy ending theirs is
        // what makes the tick happen.
        const after = battleReducer(poisoned, { type: 'END_TURN' } as never);
        expect(after.playerParty[1].currentHp).toBeLessThan(FRAME);
        expect(skollStrength(after)).toBe(0);
    });

    it('her own side\'s attack on an ally pays nothing (the source must be an enemy)', () => {
        const state = board();
        const playerTurn: IBattleState = {
            ...state,
            activeSide: 'PLAYER',
            playerDeck: {
                ...state.playerDeck,
                hand: [{ id: 'h1', dataId: 'tackle', currentCost: 0, isPlayable: true }],
            },
        };
        const after = battleReducer(playerTurn, {
            type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'p2', programId: 'h1' },
        } as never);
        expect(after.playerParty[1].currentHp).toBeLessThan(FRAME);
        expect(skollStrength(after)).toBe(0);
    });
});

describe('185b — the enemy\'s INTENT path has the same rule', () => {
    const intentHit = (state: IBattleState, targetId: string): IBattleState => {
        const withIntent: IBattleState = {
            ...state,
            enemyParty: [{
                ...state.enemyParty[0],
                currentIntent: {
                    id: 'swipe', name: 'Swipe', intentType: 'Attack', priority: 5,
                    actions: [{ type: 'ATTACK', power: 12, target: 'TARGET' }],
                },
                forcedTargetId: targetId,
            } as IBattleEntity],
        };
        return battleReducer(withIntent, { type: 'EXECUTE_INTENT', payload: { sourceId: 'e1' } } as never);
    };

    it('an intent that lands pays +1, and one a Bark Shield swallows pays nothing', () => {
        const landed = intentHit(board(), 'p2');
        expect(landed.playerParty[1].currentHp).toBeLessThan(FRAME);
        expect(skollStrength(landed)).toBeGreaterThanOrEqual(1);

        const soaked = intentHit(board({ ally: { statusEffects: [status('BarkShield', 100)] } }), 'p2');
        expect(soaked.playerParty[1].currentHp).toBe(FRAME);
        expect(skollStrength(soaked)).toBe(0);
    });
});
