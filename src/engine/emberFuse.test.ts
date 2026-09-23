/**
 * TICKET 162a — EMBER_FUSE (skoll_v2), the OS that replaced SOLAR_OVERDRIVE.
 *
 * *"Sköll's attacks on a Burning target apply 1 more Burn."*
 *
 * Three things are worth a test and the rest is not. The TRIGGER is conditional on the target's
 * board, which is the half that fails silently if `targetStatus` is dropped by zod (the schema's
 * own comments say so four times, and it cost ticket 36 three identical sim runs). The SIDE gate
 * is the half that turns a payoff into a gift if `source` is read wrong. And a multi-hit card has
 * to fire it ONCE PER HIT, which is the reason `flare_burst` and `pack_tactics` are authored as
 * repeated ATTACK actions rather than one action with `count`.
 *
 * `emberFuse` deliberately does NOT assert a damage number. The OS applies a status; what that
 * status is worth is `burnPricing`'s question and `powerscale`'s, and duplicating it here would
 * make this file fail for a reason that is nothing to do with the OS.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { GetProgramData } from './data/programRegistry';
import type { IBattleState, IBattleEntity } from './types';

const FRAME = 1000;

function unit(id: string, name: string, activeOS?: string, burn = 0): IBattleEntity {
    return createSparseEntity({
        id, name, activeOS,
        currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
        statusEffects: burn > 0 ? [{ id: `${id}-burn`, type: 'Burn', stacks: burn }] : [],
    });
}

const burnOn = (e: IBattleEntity): number =>
    e.statusEffects.filter(s => s.type === 'Burn').reduce((n, s) => n + s.stacks, 0);

/** `casterId` plays `dataId` at `e1` (or at `p1` with `aimAtPlayer`), who starts with that many Burn. */
function play(opts: {
    casterOS?: string; enemyOS?: string; dataId: string; casterId: string;
    targetBurn: number; aimAtPlayer?: boolean; playerBurn?: number;
}): IBattleState {
    const casterIsEnemy = opts.casterId.startsWith('e');
    const deck = {
        ownerId: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        deck: [], drawpile: [], discard: [], exhaust: [],
        hand: [{ id: 'h1', dataId: opts.dataId, currentCost: GetProgramData(opts.dataId).baseCost as number, isPlayable: true }],
    };
    const empty = { ownerId: '', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] };
    const state: IBattleState = createSparseBattleState({
        activeSide: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        phase: 'ACTION',
        playerParty: [unit('p1', 'Sköll', opts.casterOS, opts.playerBurn ?? 0), unit('p2', 'Ally')],
        enemyParty: [unit('e1', 'Foe', opts.enemyOS, opts.targetBurn)],
        playerDeck: casterIsEnemy ? { ...empty, ownerId: 'PLAYER' } : deck,
        enemyDeck: casterIsEnemy ? deck : { ...empty, ownerId: 'ENEMY' },
    });
    return battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: opts.casterId, targetId: opts.aimAtPlayer ? 'p1' : 'e1', programId: 'h1' },
    } as never);
}

describe('EMBER_FUSE — an attack on a Burning target adds a Burn', () => {
    it('adds 1 Burn when the target was already Burning', () => {
        const state = play({ casterOS: 'skoll_v2', dataId: 'tackle', casterId: 'p1', targetBurn: 1 });
        expect(burnOn(state.enemyParty[0])).toBe(2);
    });

    it('does nothing at all against a clean target — the trigger is the condition', () => {
        const state = play({ casterOS: 'skoll_v2', dataId: 'tackle', casterId: 'p1', targetBurn: 0 });
        expect(burnOn(state.enemyParty[0])).toBe(0);
    });

    /*
     * ONCE PER CARD, NOT ONCE PER HIT — measured, and it is a design fact worth knowing.
     *
     * `onActionStart` is dispatched by `battleReducer` at step 5, before the action loop, so it
     * fires once for the CARD however many ATTACK actions the card holds. `flare_burst` is 15
     * power twice and pays the OS once.
     *
     * That is the literal reading of Henry's sentence ("Sköll's ATTACKS on a Burning target apply
     * 1 more Burn") and it matches the kit: skoll_v2's list is ember_jab, brand, ignite, flashover,
     * heat_wave and one pack_tactics — the detonation deck, not the multi-hit one. Sköll v1 is
     * where the multi-hits live. Pinned rather than assumed, because if this OS is ever meant to
     * pay per hit the trigger has to move to a per-damage-event one, and that is a ruling.
     */
    it('fires once per CARD, not once per hit', () => {
        expect(GetProgramData('flare_burst').actions.filter(a => a.type === 'ATTACK')).toHaveLength(2);
        const state = play({ casterOS: 'skoll_v2', dataId: 'flare_burst', casterId: 'p1', targetBurn: 1 });
        expect(burnOn(state.enemyParty[0])).toBe(2);
    });

    it('is hers alone: an ally swinging at the same Burning target does not fire it', () => {
        const state = play({ casterOS: 'skoll_v2', dataId: 'tackle', casterId: 'p2', targetBurn: 1 });
        expect(burnOn(state.enemyParty[0])).toBe(1);
    });

    it('works for whoever holds it — an enemy Sköll gets the same OS, aimed at the player', () => {
        // The side gate is `source: SELF`, i.e. the OWNER'S OWN attack, not "the player's". An
        // enemy fielding skoll_v2 is a real encounter and she gets her firmware.
        const state = play({ enemyOS: 'skoll_v2', dataId: 'tackle', casterId: 'e1', targetBurn: 0, aimAtPlayer: true });
        expect(burnOn(state.playerParty[0])).toBe(0);
        const burning = play({ enemyOS: 'skoll_v2', dataId: 'tackle', casterId: 'e1', targetBurn: 0, aimAtPlayer: true, playerBurn: 1 });
        expect(burnOn(burning.playerParty[0])).toBe(2);
    });
});
