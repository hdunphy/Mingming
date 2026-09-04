/**
 * THE DAMAGE LEDGER — the three numbers, held apart.
 *
 * Henry, 2026-08-24, on why this exists at all: *"we had so many bugs last time… it's really
 * important to know the exact damage."* `previewParity.test.ts` proves the card face agrees with
 * the engine across the whole registry; this file proves the engine is recording the right thing in
 * the two states where the old HP-delta measurement was *guaranteed* to be wrong — a lethal blow
 * and a shielded target. A parity suite that agrees on two wrong numbers still passes.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from './battleReducer';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import type { IBattleEntity, IBattleState, StatusType } from './types';

const CARD = 'ledger_card';
/** `water_slap` is the None-element neutral: no STAB, no matchup, so the arithmetic stays legible. */
const NEUTRAL = 'water_slap';

function arena(): IBattleState {
    const setup = matchupScenario({
        player: 'fenrir', enemy: 'control',
        playerOS: 'fenrir_v1', enemyOS: 'control_v1',
        seed: 'ledger-seed',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    return {
        ...base,
        activeSide: 'PLAYER',
        playerParty: base.playerParty.map((e, i) =>
            i === 0 ? { ...e, currentEnergy: Math.max(e.maxEnergy, 4) } : e),
        playerDeck: {
            ...base.playerDeck,
            hand: [{ id: CARD, dataId: NEUTRAL, currentCost: 0, isPlayable: true }],
        },
    } as IBattleState;
}

const withStatus = (e: IBattleEntity, type: StatusType, stacks: number): IBattleEntity => ({
    ...e,
    statusEffects: [
        ...e.statusEffects.filter(s => s.type !== type),
        { type, stacks, duration: -1 } as unknown as IBattleEntity['statusEffects'][number],
    ],
});

function play(state: IBattleState): IBattleState {
    const me = state.playerParty[0];
    const them = state.enemyParty[0];
    return battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: me.id, targetId: them.id, programId: CARD },
    });
}

const hitsOn = (state: IBattleState, id: string) =>
    (state.damageLedger ?? []).filter(h => h.targetId === id);

describe('the damage ledger', () => {
    it('records what the card HIT for, not what the HP bar could absorb', () => {
        // The reported bug, reduced: *"if my target only has 5 HP left, all my cards show 5."*
        const base = arena();
        const full = play(base);
        const raw = hitsOn(full, base.enemyParty[0].id).reduce((n, h) => n + h.raw, 0);
        // `water_slap` is a weak neutral on purpose; all this needs is a hit big enough to overkill
        // a 1 HP target, so the two numbers can disagree.
        expect(raw).toBeGreaterThan(1);

        const nearlyDead: IBattleState = {
            ...base,
            enemyParty: base.enemyParty.map((e, i) => i === 0 ? { ...e, currentHp: 1 } : e),
        };
        const after = play(nearlyDead);
        const hits = hitsOn(after, base.enemyParty[0].id);

        // Same card, same caster, same everything but the target's remaining HP.
        expect(hits.reduce((n, h) => n + h.raw, 0)).toBe(raw);
        // HP cannot go below zero, so `applied` is capped — and that cap is exactly why it is a
        // separate field instead of the only one. This is the number the card face used to show.
        expect(hits.reduce((n, h) => n + h.applied, 0)).toBe(1);
        expect(after.enemyParty[0].currentHp).toBe(0);
    });

    it('separates what a shield ate from what reached HP', () => {
        const base = arena();
        const shielded: IBattleState = {
            ...base,
            enemyParty: base.enemyParty.map((e, i) => i === 0 ? withStatus(e, 'BarkShield', 40) : e),
        };
        const after = play(shielded);
        const hits = hitsOn(after, base.enemyParty[0].id);
        expect(hits.length).toBeGreaterThan(0);

        const raw = hits.reduce((n, h) => n + h.raw, 0);
        const absorbed = hits.reduce((n, h) => n + h.absorbed, 0);
        const applied = hits.reduce((n, h) => n + h.applied, 0);

        // The shield actually did something — otherwise the rest of this test is vacuous.
        expect(absorbed).toBeGreaterThan(0);
        // The identity the whole record rests on. Overkill is the slack, and there is none here
        // because the target is at full HP.
        expect(absorbed + applied).toBe(raw);
        expect(base.enemyParty[0].currentHp - after.enemyParty[0].currentHp).toBe(applied);
    });

    it('holds THIS action only — a second play does not inherit the first play\'s hits', () => {
        // The ledger is per-action (`IDamageRecord`), which is what lets the preview read it
        // directly instead of diffing lengths. A ledger that accumulated would make every preview
        // after the first one wrong, and wrong in a way that grows.
        const base = arena();
        const twoInHand: IBattleState = {
            ...base,
            playerDeck: {
                ...base.playerDeck,
                hand: [
                    { id: CARD, dataId: NEUTRAL, currentCost: 0, isPlayable: true },
                    { id: 'second', dataId: NEUTRAL, currentCost: 0, isPlayable: true },
                ],
            },
        };
        const once = play(twoInHand);
        const firstCount = (once.damageLedger ?? []).length;
        expect(firstCount).toBeGreaterThan(0);

        const twice = battleReducer(once, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: once.playerParty[0].id, targetId: once.enemyParty[0].id, programId: 'second' },
        });
        expect((twice.damageLedger ?? []).length).toBe(firstCount);
    });

    it('a refused play leaves the state untouched by identity', () => {
        // `damagePreview.simulatePlay` detects a refusal with `after === state`. Clearing the
        // ledger above the refusal guards would have quietly broken that, and the preview would
        // have started reporting numbers for plays that cannot happen.
        const base = arena();
        const refused = battleReducer(base, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: base.playerParty[0].id, targetId: base.enemyParty[0].id, programId: 'not_in_hand' },
        });
        expect(refused).toBe(base);
    });
});
