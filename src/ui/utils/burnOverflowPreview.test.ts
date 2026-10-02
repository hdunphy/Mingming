/**
 * TICKET 184b — a Burn overflow reads as an overflow, never as a negative Burn number.
 *
 * Henry, 2026-10-01: *"When burn overflows it says -2 burn or -3 burn which is confusing."* Ruled:
 * `OVERFLOW · 2 BURN` (the pile went off; this is what is left).
 *
 * Burn caps at 4; past the cap it detonates for 14% of max HP and the cap comes off the pile. The
 * hover preview used to DIFF the pile, so the cards that add the most Burn showed the biggest loss:
 *
 *   | before | card adds | after | chip before 184b |
 *   |   4    |     2     |   2   |    -2 BURN       |
 *   |   4    |     1     |   1   |    -3 BURN       |
 *   |   2    |  2 + 2    |   2   |  (nothing)       |
 */

import { describe, it, expect } from 'vitest';
import { computeDamagePreview } from './damagePreview';
import { nextOverflowRemaining, overflowText, statusChipText, withOverflows } from './statusOverflow';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import { globalBattleEventBus, type BattleEvent } from '../../engine/events';
import { battleReducer } from '../../engine/battleReducer';
import type { IBattleState, ProgramEntity, StatusEffectInstance } from '../../engine/types';

const burn = (stacks: number): StatusEffectInstance =>
    ({ id: 's-burn', type: 'Burn', stacks } as StatusEffectInstance);

const inHand = (dataId: string): ProgramEntity =>
    ({ id: 'c1', dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

function stateWith(dataId: string, burnStacks: number): IBattleState {
    // molten_core applies its second 2 Burn only while the caster holds Sharp - so she holds one.
    const casterStatuses = [{ id: 's-sharp', type: 'Sharp', stacks: 1 } as StatusEffectInstance];
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'huldra', name: 'Huldra', cardDraw: 3, statusEffects: casterStatuses })],
        enemyParty: [createSparseEntity({
            id: 'e1', definitionId: 'kraken', name: 'Target',
            statusEffects: burnStacks > 0 ? [burn(burnStacks)] : [],
        })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [],
            hand: [inHand(dataId)], discard: [], exhaust: [],
        },
    });
}

const previewOf = (dataId: string, burnStacks: number) =>
    computeDamagePreview(stateWith(dataId, burnStacks), 'p1', 'c1', 'e1');

const burnChip = (dataId: string, burnStacks: number) => {
    const change = previewOf(dataId, burnStacks).statusChanges.find((c) => c.status === 'Burn');
    return change ? statusChipText(change) : undefined;
};

describe('184b - the hover preview', () => {
    it('4 Burn + 2 (scald) reads OVERFLOW · 2 BURN, not -2 BURN', () => {
        expect(burnChip('scald', 4)).toBe('OVERFLOW · 2 BURN');
    });

    it('4 Burn + 1 (ember_jab) reads OVERFLOW · 1 BURN, not -3 BURN', () => {
        expect(burnChip('ember_jab', 4)).toBe('OVERFLOW · 1 BURN');
    });

    it('2 Burn + 4 (molten_core, 2 + 2) reads OVERFLOW · 2 BURN instead of nothing', () => {
        expect(burnChip('molten_core', 2)).toBe('OVERFLOW · 2 BURN');
    });

    it('below the cap nothing changes: 2 Burn + 2 reads +2 BURN', () => {
        expect(burnChip('scald', 2)).toBe('+2 BURN');
    });

    it('a card that adds Burn never shows a negative Burn chip', () => {
        for (const card of ['scald', 'ember_jab', 'molten_core', 'inferno', 'cinder_gust']) {
            for (let before = 0; before <= 4; before++) {
                const change = previewOf(card, before).statusChanges.find((c) => c.status === 'Burn');
                if (change && change.overflow === undefined) expect(change.delta, `${card} on ${before}`).toBeGreaterThan(0);
            }
        }
    });

    it('the damage number includes the detonation — on an attack card', () => {
        const below = previewOf('ember_jab', 0).damage;
        const over = previewOf('ember_jab', 4).damage;
        expect(over - below).toBe(14); // 14% of a 100 max HP frame
    });

    it('the damage number includes the detonation — on a status-only card too', () => {
        expect(previewOf('scald', 2).damage).toBe(0);
        const over = previewOf('scald', 4);
        expect(over.damage).toBe(14);
        expect(over.hpDamage).toBe(14);
    });
});

describe('184b - the engine marks the detonation once', () => {
    it('STATUS_APPLIED carries the pile left behind, and only when the pile went off', () => {
        const seen: BattleEvent[] = [];
        const off = globalBattleEventBus.subscribe((e) => { seen.push(e); });
        battleReducer(stateWith('scald', 4), { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' } });
        battleReducer(stateWith('scald', 1), { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' } });
        off();
        const burns = seen.filter((e): e is Extract<BattleEvent, { type: 'STATUS_APPLIED' }> =>
            e.type === 'STATUS_APPLIED' && e.status === 'Burn');
        expect(burns.map((e) => e.overflowRemaining)).toEqual([2, undefined]);
    });

    it('the detonation damage record names the status and the pile left', () => {
        const after = battleReducer(stateWith('scald', 4), { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' } });
        const record = (after.damageLedger ?? []).find((hit) => hit.overflow);
        expect(record?.overflow).toEqual({ status: 'Burn', detonations: 1, remaining: 2 });
        expect(record?.raw).toBe(14);
    });
});

describe('184b - the words', () => {
    it('is the ruled wording', () => {
        expect(overflowText('Burn', 2)).toBe('OVERFLOW · 2 BURN');
        expect(statusChipText({ status: 'Poison', delta: 2 })).toBe('+2 POISON');
        expect(statusChipText({ status: 'Strengthened', delta: -1 })).toBe('-1 STRENGTHENED');
    });

    it('withOverflows puts the overflow first and drops its plain diff', () => {
        const merged = withOverflows([{ status: 'Burn', delta: -2 }, { status: 'Dazed', delta: 1 }], new Set(['Burn']), { Burn: 2, Dazed: 1 }, { Burn: 4 });
        expect(merged).toEqual([{ status: 'Burn', delta: -2, overflow: 2 }, { status: 'Dazed', delta: 1 }]);
    });

    it('a float merging several applications reports the pile after the last detonation', () => {
        let left = nextOverflowRemaining(undefined, 2, undefined);
        expect(left).toBeUndefined();
        left = nextOverflowRemaining(left, 2, 2);
        expect(left).toBe(2);
        left = nextOverflowRemaining(left, 1, undefined);
        expect(left).toBe(3);
    });
});
