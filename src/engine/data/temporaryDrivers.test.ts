/**
 * TICKET 168b — Frayed Signal and Static Haze, the two Drivers an event hands out for ONE fight.
 *
 * What would fail silently: a Driver that fires every turn instead of once (a 25% loss per turn is
 * a different game), one that leaks into an offer (a penalty presented as a reward), and one that
 * lingers after its fight (a "next fight only" penalty that is really permanent).
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from '../battleReducer';
import { createBattleState, type IBattleSetup } from './battleFactories';
import {
    DRIVER_FRAYED_SIGNAL,
    DRIVER_IDS,
    DRIVER_STATIC_HAZE,
    PLAYER_DRIVER_IDS,
    TEMPORARY_DRIVER_IDS,
    describeDriver,
    getDriver,
    isTemporaryDriver,
    playerDriverOptions,
} from './driverRegistry';
import { driverStakePool } from '../run/driverStakes';
import { buildBattleSetup } from '../run/battleSetup';
import { createRun } from '../run/createRun';
import { offerGyms } from '../run/gyms';
import { afterFight, tempDriverIds, withTempDriver } from '../run/tempDrivers';
import type { IBattleState, IMingmingState } from '../types';
import type { IRanchState, IRunState } from '../runTypes';

const member = (id: string, definitionId: string): IMingmingState => ({
    id, definitionId, blueprintsCollected: 0, hpIV: 15, attackIV: 15, defenseIV: 15,
});

/** A 3v3: three members on the player's side, three enemies, no card deck to muddy the turns. */
function threeVThree(drivers: ReadonlyArray<string>): IBattleState {
    const setup: IBattleSetup = {
        party: [member('p1', 'kraken'), member('p2', 'fenrir'), member('p3', 'skoll')],
        deck: [],
        drivers: [...drivers],
        persistedHp: {},
        encounter: null,
    };
    return createBattleState(setup, ['fenrir', 'skoll', 'kraken'], undefined, {
        seed: 'temporary-driver-test',
        enemyMode: 'CARDS',
    });
}

const round = (from: IBattleState): IBattleState =>
    battleReducer(battleReducer(from, { type: 'END_TURN' }), { type: 'END_TURN' });

const logged = (state: IBattleState, text: string): number =>
    state.logs.filter((line) => line.includes(text)).length;

const weakened = (state: IBattleState): number[] =>
    state.playerParty.map((m) => m.statusEffects.find((s) => s.type === 'Weakened')?.stacks ?? 0);

describe('FRAYED SIGNAL', () => {
    it('takes 25% of each member’s max HP at the start of the first turn, as the engine rounds it', () => {
        const control = threeVThree([]);
        const state = threeVThree([DRIVER_FRAYED_SIGNAL]);
        expect(state.playerParty).toHaveLength(3);
        state.playerParty.forEach((unit, i) => {
            const max = control.playerParty[i].maxHp;
            expect(control.playerParty[i].currentHp).toBe(max);
            // HookFactory: floor(maxHp * 25%), never less than 1.
            expect(unit.currentHp).toBe(max - Math.max(1, Math.floor(max * 0.25)));
        });
    });

    it('fires once per member for the fight, not every turn', () => {
        let state = threeVThree([DRIVER_FRAYED_SIGNAL]);
        expect(logged(state, 'FRAYED SIGNAL')).toBe(3);
        state = round(state);
        state = round(state);
        state = round(state);
        expect(state.turn).toBeGreaterThanOrEqual(3);
        expect(logged(state, 'FRAYED SIGNAL')).toBe(3);
    });

    it('does nothing to a party that does not carry it', () => {
        const state = round(threeVThree([]));
        expect(logged(state, 'FRAYED SIGNAL')).toBe(0);
    });
});

describe('STATIC HAZE', () => {
    it('gives every member 2 Weakened at the start of the first turn, once', () => {
        let state = threeVThree([DRIVER_STATIC_HAZE]);
        expect(weakened(state)).toEqual([2, 2, 2]);
        expect(logged(state, 'STATIC HAZE')).toBe(3);
        state = round(round(round(state)));
        expect(logged(state, 'STATIC HAZE')).toBe(3);
    });
});

describe('the temporary Drivers stay out of every offer', () => {
    it('are named by describeDriver and exist in hooks.json', () => {
        expect(TEMPORARY_DRIVER_IDS).toEqual([DRIVER_FRAYED_SIGNAL, DRIVER_STATIC_HAZE]);
        for (const id of TEMPORARY_DRIVER_IDS) {
            expect(getDriver(id), `${id} missing from hooks.json`).toBeDefined();
            expect(describeDriver(id).name).not.toBe(id);
            expect(describeDriver(id).description.length).toBeGreaterThan(0);
            expect(isTemporaryDriver(id)).toBe(true);
        }
        expect(isTemporaryDriver('driver_tenth_strike')).toBe(false);
    });

    it('are in neither PLAYER_DRIVER_IDS, DRIVER_IDS, playerDriverOptions() nor the elite stake pool', () => {
        for (const id of TEMPORARY_DRIVER_IDS) {
            expect(PLAYER_DRIVER_IDS).not.toContain(id);
            expect(DRIVER_IDS).not.toContain(id);
            expect(playerDriverOptions().map((option) => option.id)).not.toContain(id);
            const biomes = createRun({ seed: 'stake', offer: offerGyms('event-offer')[0], party: [member('mm1', 'kraken')], startedAt: 1 }).biomes;
            expect(driverStakePool(biomes)).not.toContain(id);
        }
    });
});

describe('the run’s temporary Drivers', () => {
    const KRAKEN = member('mm1', 'kraken');
    const run = (): IRunState => createRun({ seed: 'temp-run', offer: offerGyms('event-offer')[0], party: [KRAKEN], startedAt: 1 });
    const ranch = (): IRanchState => ({
        roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }],
    } as unknown as IRanchState);

    it('starts every run with none', () => {
        expect(tempDriverIds(run())).toEqual([]);
    });

    it('adds fights to a Driver already held instead of doubling it up, and refuses under 1 fight', () => {
        const once = withTempDriver(undefined, DRIVER_FRAYED_SIGNAL, 1);
        expect(once).toEqual([{ driverId: DRIVER_FRAYED_SIGNAL, fightsLeft: 1 }]);
        expect(withTempDriver(once, DRIVER_FRAYED_SIGNAL, 2)).toEqual([{ driverId: DRIVER_FRAYED_SIGNAL, fightsLeft: 3 }]);
        expect(withTempDriver(once, DRIVER_STATIC_HAZE, 0)).toEqual(once);
    });

    it('counts down after a fight and drops a Driver that reaches 0', () => {
        const held = [
            { driverId: DRIVER_FRAYED_SIGNAL, fightsLeft: 1 },
            { driverId: DRIVER_STATIC_HAZE, fightsLeft: 2 },
        ];
        expect(afterFight(held)).toEqual([{ driverId: DRIVER_STATIC_HAZE, fightsLeft: 1 }]);
        expect(afterFight(afterFight(held))).toEqual([]);
    });

    it('is in the next fight’s setup and gone from the one after', () => {
        const withHaze: IRunState = { ...run(), tempDrivers: withTempDriver(undefined, DRIVER_STATIC_HAZE, 1) };
        const next = buildBattleSetup(ranch(), withHaze);
        expect(next.drivers).toContain(DRIVER_STATIC_HAZE);
        // ...and it is in the battle the setup builds.
        const state = createBattleState(next, ['fenrir'], undefined, { seed: 'next-fight', enemyMode: 'CARDS' });
        expect(state.activeDrivers).toContain(DRIVER_STATIC_HAZE);

        const after: IRunState = { ...withHaze, tempDrivers: afterFight(withHaze.tempDrivers) };
        expect(buildBattleSetup(ranch(), after).drivers).not.toContain(DRIVER_STATIC_HAZE);
    });
});
