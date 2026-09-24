/**
 * TICKET 162e — EMBER_FUSE (skoll_v2) fires PER HIT.
 *
 * *"Each of Sköll's hits on a Burning target applies 1 more Burn."*
 *
 * 162a shipped it on `onActionStart`, which is dispatched once before the action loop, so it paid
 * once per CARD. That was the literal reading of the old sentence and it was PINNED here rather
 * than assumed, with a note saying a move to per-hit would be a ruling. Henry ruled it on
 * 2026-09-24, so the trigger is `onPostDamage` — inside the loop, once per swing — and this file
 * now pins the opposite number. The old test is what made the change a one-line question instead
 * of an archaeology session.
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
     * ONCE PER HIT — Henry, 2026-09-24, and the reason the trigger moved.
     *
     * `onActionStart` fires before the action loop and therefore once per CARD; `onPostDamage`
     * fires inside it, after each swing resolves. Post- rather than pre-: a Burn added BEFORE the
     * swing would be on the board when that swing's own damage is calculated, so a Burn-scaling
     * attack would read the stack EMBER_FUSE had just given it. Each hit reads the board it landed
     * into, and the stack it adds is there for the next one.
     *
     * Pack Tactics is 23 power three times, so on a target holding 1 Burn it procs three times and
     * the pile reaches the cap of 4 exactly.
     */
    const osProcs = (dataId: string, targetBurn: number): number => {
        const withOS = play({ casterOS: 'skoll_v2', dataId, casterId: 'p1', targetBurn });
        const without = play({ dataId, casterId: 'p1', targetBurn });
        return burnOn(withOS.enemyParty[0]) - burnOn(without.enemyParty[0]);
    };

    it('fires once per HIT: three from pack_tactics, one from brand', () => {
        expect(GetProgramData('pack_tactics').actions.filter(a => a.type === 'ATTACK')).toHaveLength(3);
        expect(osProcs('pack_tactics', 1)).toBe(3);

        // Brand is one swing plus a Burn rider of its own. One swing, one proc — and the rider is
        // a STATUS action, which `isAttack` excludes, so it does not pay the OS a second time.
        expect(GetProgramData('brand').actions.filter(a => a.type === 'ATTACK')).toHaveLength(1);
        expect(osProcs('brand', 1)).toBe(1);
    });

    it('pays flare_burst twice, where it used to pay once', () => {
        expect(GetProgramData('flare_burst').actions.filter(a => a.type === 'ATTACK')).toHaveLength(2);
        expect(osProcs('flare_burst', 1)).toBe(2);
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
