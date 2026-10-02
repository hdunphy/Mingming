/**
 * ROOT ROT RESHAPED — ticket 77 Track C's two built candidates, each checked for the thing that would
 * make its arm a lie: that it FIRES, that it fires at the geometry its name claims, and that it
 * announces itself (`proc: true`), so the report's procs/fight column is reading the right event.
 *
 * Stacks are counted rather than "something happened" — the ROOT ROT lesson (`rootRot.test.ts`):
 * a Driver that silently never fires reads as a boss that is weak.
 *
 * The knob is process-global; every test restores the shipped Driver in `finally`.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { battleReducer } from '../../engine/battleReducer';
import { effectHandlers } from '../../engine/effectHandlers';
import { DRIVER_ROOT_ROT, applyDriver, getDriver } from '../../engine/data/driverRegistry';
import { FIRMWARE_REGISTRY } from '../../engine/data/firmwareRegistry';
import { globalBattleEventBus, type BattleEvent } from '../../engine/events';
import type { IBattleState } from '../../engine/types';
import { matchupScenario } from './balanceScenarios';
import { buildScenarioState } from '../scenarios/buildScenarioState';
import { applyRegistryTweaks, rootRotCandidateHooks } from './experimentalTweaks';

// `getDriver` initialises the registry; reading `FIRMWARE_REGISTRY` before that captures `undefined`.
const shipped = getDriver(DRIVER_ROOT_ROT)!;
afterEach(() => {
    FIRMWARE_REGISTRY[DRIVER_ROOT_ROT] = shipped;
});

/** The ENEMY side runs the Driver, as Rootfall's boss does; the player is its target. */
const arena = (): IBattleState => {
    const setup = matchupScenario({
        player: 'fenrir', enemy: 'jormungandr',
        playerOS: 'fenrir_v1', enemyOS: 'jormungandr_v2', seed: 'root-rot-candidates',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed });
    return { ...base, enemyParty: base.enemyParty.map((e) => applyDriver(e, DRIVER_ROOT_ROT)) };
};

const poisonOn = (s: IBattleState, id: string): number =>
    [...s.playerParty, ...s.enemyParty].find((e) => e.id === id)!.statusEffects.find((x) => x.type === 'Poison')?.stacks ?? 0;

/** Poison from the enemy side onto the player's unit, as a card would apply it. */
const poisonPlayer = (s: IBattleState, stacks: number): IBattleState =>
    effectHandlers.APPLY_STATUS(s, {
        targetId: s.playerParty[0].id, status: 'Poison', stacks, sourceId: s.enemyParty[0].id,
    } as never) as IBattleState;

/** Count `DRIVER_PROC`s from the enemy side while `fn` runs. */
const procsDuring = (fn: () => void): number => {
    let procs = 0;
    const off = globalBattleEventBus.subscribe((e: BattleEvent) => {
        if (e.type === 'DRIVER_PROC' && !e.fromPlayer && e.driverId === DRIVER_ROOT_ROT) procs += 1;
    });
    try { fn(); } finally { off(); }
    return procs;
};

describe('root-rot-c1 CREEPING ROT', () => {
    it('every declared hook is proc-visible where it acts, and every COUNTER carries a target', () => {
        for (const hook of rootRotCandidateHooks('c1')) {
            for (const a of hook.do ?? []) if (a.type === 'COUNTER') expect(a.target, `${hook.id}: COUNTER needs a target`).toBeDefined();
        }
        expect(rootRotCandidateHooks('c1').find((h) => h.id === 'driver_root_rot_c1_creep')?.proc).toBe(true);
    });

    it('does NOT fire per application — a Poison card lands exactly what it says', () => {
        applyRegistryTweaks(['root-rot-c1']);
        const before = arena();
        const target = before.playerParty[0].id;
        const after = poisonPlayer(before, 3);
        expect(poisonOn(after, target), 'the +1-per-application shape is gone').toBe(3);
    });

    it('fires ONCE at the end of the enemy turn for the whole side, +1 on each Poisoned enemy', () => {
        applyRegistryTweaks(['root-rot-c1']);
        expect(getDriver(DRIVER_ROOT_ROT)!.hooks.map((h) => h.id)).toContain('driver_root_rot_c1_creep');

        // Enemy's turn, player poisoned, then the enemy ends its turn.
        let state: IBattleState = { ...arena(), activeSide: 'ENEMY' };
        const target = state.playerParty[0].id;
        state = poisonPlayer(state, 3);
        const logsBefore = state.logs.length;

        const procs = procsDuring(() => { state = battleReducer(state, { type: 'END_TURN' }); });

        // END_TURN also opens the PLAYER's turn, whose start-tick deals the Poison and decays it by
        // one. Without the Driver 3 ticks to 2; with it the +1 lands BEFORE the tick — 4 stacks of
        // damage, then 3 — so the candidate's stack is felt on the very next tick.
        expect(poisonOn(state, target), '3 +1 from CREEPING ROT, then the tick\'s -1').toBe(3);
        expect(state.logs.slice(logsBefore).some((l) => /Poison deals \d+ damage \(4 stacks\)/.test(l))).toBe(true);
        expect(procs, 'one proc for the side, not one per body').toBe(1);
    });

    it('lands nothing on a clean enemy — but still ANNOUNCES, which the report must read correctly', () => {
        applyRegistryTweaks(['root-rot-c1']);
        let state: IBattleState = { ...arena(), activeSide: 'ENEMY' };
        const target = state.playerParty[0].id;
        const procs = procsDuring(() => { state = battleReducer(state, { type: 'END_TURN' }); });
        expect(poisonOn(state, target)).toBe(0);
        // The `when` (source SELF, side flag) passes and the proc is announced before the action's
        // `targetHasStatus` filter finds no Poisoned enemy. So C1's procs/fight counts the SIDE'S
        // TURN-ENDS while it lives, not stacks landed — research/77 Track C says so where it prints it.
        expect(procs).toBe(1);
    });
});

describe('root-rot-c3 FESTERING', () => {
    it('is proc-visible', () => {
        expect(rootRotCandidateHooks('c3').find((h) => h.id === 'driver_root_rot_c3_fester')?.proc).toBe(true);
    });

    it('does NOT fire per application either', () => {
        applyRegistryTweaks(['root-rot-c3']);
        const before = arena();
        const after = poisonPlayer(before, 3);
        expect(poisonOn(after, before.playerParty[0].id)).toBe(3);
    });

    it('fires when an ATTACK hits a Poisoned target, and not when the target is clean', () => {
        applyRegistryTweaks(['root-rot-c3']);
        // A pure attack the enemy can cast: put one in its hand and play it at the poisoned player.
        const start: IBattleState = { ...arena(), activeSide: 'ENEMY' };
        const target = start.playerParty[0].id;
        const attacker = start.enemyParty[0].id;
        const withCard = battleReducer(start, { type: 'ADD_CARD_TO_HAND', payload: { side: 'ENEMY', dataId: 'water_slap' } });
        const card = withCard.enemyDeck.hand.find((c) => c.dataId === 'water_slap')!;
        const play = { type: 'PLAY_PROGRAM' as const, payload: { sourceId: attacker, targetId: target, programId: card.id } };

        // Clean target: the hit lands, no Poison appears.
        let clean = withCard;
        const cleanProcs = procsDuring(() => { clean = battleReducer(withCard, play); });
        expect(clean, 'the card must have resolved').not.toBe(withCard);
        expect(poisonOn(clean, target)).toBe(0);
        expect(cleanProcs).toBe(0);

        // Poisoned target: the same hit festers one stack.
        const poisoned = poisonPlayer(withCard, 2);
        let after = poisoned;
        const procs = procsDuring(() => { after = battleReducer(poisoned, play); });
        expect(after).not.toBe(poisoned);
        expect(poisonOn(after, target), '2 from the card + 1 from FESTERING').toBe(3);
        expect(procs).toBe(1);
    });
});
