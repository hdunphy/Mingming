/**
 * TICKET 194c — Bark Shield is a fractional percent, and two readers used to show it.
 *
 * Henry, 2026-10-04: *"Removing barkshield still shows a large number in the preview like
 * 4.00000001."* The preview chip printed the raw delta, and Bark Smash's consume logged and counted
 * `47.863247863247864` stacks while `BARKSHIELD_STACKS` floors the same pile.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { statusDiff } from '../ui/utils/damagePreview';
import { statusChipText } from '../ui/utils/statusOverflow';
import type { IBattleState, ProgramEntity, StatusEffectInstance } from './types';

const barkSmash: ProgramEntity =
    { id: 'bs', dataId: 'bark_smash', currentCost: 0, isPlayable: true } as ProgramEntity;

const bark = (stacks: number): StatusEffectInstance =>
    ({ id: 's-bark', type: 'BarkShield', stacks } as StatusEffectInstance);

function stateHolding(stacks: number): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', name: 'Huldra', statusEffects: [bark(stacks)] })],
        enemyParty: [createSparseEntity({ id: 'e1', name: 'Target', currentHp: 100000, maxHp: 100000 })],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [barkSmash], discard: [], exhaust: [] },
    });
}

const smash = (s: IBattleState): IBattleState =>
    battleReducer(s, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'bs' } } as never);

describe('194c — the preview chip', () => {
    it('a Bark Shield of 4.00000001 removed shows -4 BARKSHIELD', () => {
        const [change] = statusDiff({ BarkShield: 4.00000001 }, {});
        expect(statusChipText(change)).toBe('-4 BARKSHIELD');
    });

    it('a delta that rounds to nothing (0.04) shows no chip', () => {
        expect(statusDiff({ BarkShield: 10.04 }, { BarkShield: 10 })).toEqual([]);
    });

    it('the chip text rounds on its own too, for any caller that builds a change by hand', () => {
        expect(statusChipText({ status: 'BarkShield', delta: 7.36000000001 })).toBe('+7.4 BARKSHIELD');
        expect(statusChipText({ status: 'Poison', delta: 2 })).toBe('+2 POISON');
    });
});

describe("194c — Bark Smash's count", () => {
    it('consuming 47.86 stacks counts 47, and the log line says 47', () => {
        const after = smash(stateHolding(47.863247863247864));
        expect(after.lastStatusConsumed).toBe(47);
        expect(after.logs.some((line) => line.includes('consumed (47 stacks)'))).toBe(true);
        expect(after.logs.some((line) => line.includes('47.86'))).toBe(false);
        expect(after.playerParty[0].statusEffects.some((s) => s.type === 'BarkShield')).toBe(false);
    });

    it('a decay that left 3.9999999999 still counts 4', () => {
        expect(smash(stateHolding(3.9999999999)).lastStatusConsumed).toBe(4);
    });

    it('a sliver under one stack is removed and counts 0', () => {
        const after = smash(stateHolding(0.4));
        expect(after.lastStatusConsumed).toBe(0);
        expect(after.playerParty[0].statusEffects.some((s) => s.type === 'BarkShield')).toBe(false);
    });
});
