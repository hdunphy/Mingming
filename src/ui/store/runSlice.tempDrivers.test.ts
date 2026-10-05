/**
 * TICKET 168b — the run's temporary Drivers through the reducers: gained by `addTempDriver`, counted
 * down by every reducer that ends a fight (`resolveEncounter`, `advanceGauntlet`, `finishGauntlet`),
 * and never confused with the permanent list.
 */

import { describe, expect, it } from 'vitest';

import runReducer, {
    addTempDriver,
    advanceGauntlet,
    beginGauntlet,
    enterNode,
    finishGauntlet,
    resolveEncounter,
    startRun,
    type RunSliceState,
} from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { RunStateSchema } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import { standBeside } from '../../testing/standBeside';
import type { IRunState } from '../../engine/runTypes';

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});
const PARTY = [member('mm1', 'kraken', 'kraken_v1'), member('mm2', 'fenrir', 'fenrir_v1'), member('mm3', 'ratatoskr', 'ratatoskr_v1')];

function standingOn(kind: IRunState['nodes'][number]['kind']): RunSliceState {
    const run = createRun({ seed: 'temp-driver-reducer', offer: offerGyms('offer-seed')[0], party: PARTY, startedAt: 1_700_000_000_000 });
    const target = run.nodes.find((n) => n.kind === kind && n.id !== run.currentNodeId)!;
    // Travel is one-way (176b): stand beside the target first.
    return runReducer(runReducer(undefined, startRun(standBeside(run, target.id))), enterNode(target.id));
}

const temp = (state: RunSliceState) => state.run!.tempDrivers ?? [];

describe('addTempDriver', () => {
    it('adds the Driver to tempDrivers, not to drivers, and the run still saves', () => {
        const state = runReducer(standingOn('wild'), addTempDriver({ driverId: 'driver_frayed_signal', fights: 1 }));
        expect(temp(state)).toEqual([{ driverId: 'driver_frayed_signal', fightsLeft: 1 }]);
        expect(state.run!.drivers).not.toContain('driver_frayed_signal');
        expect(RunStateSchema.safeParse(state.run).success).toBe(true);
    });

    it('adds fights to one already held', () => {
        let state = runReducer(standingOn('wild'), addTempDriver({ driverId: 'driver_static_haze', fights: 1 }));
        state = runReducer(state, addTempDriver({ driverId: 'driver_static_haze', fights: 1 }));
        expect(temp(state)).toEqual([{ driverId: 'driver_static_haze', fightsLeft: 2 }]);
    });

    it('refuses an id that is not a temporary Driver, and a fight count under 1', () => {
        let state = runReducer(standingOn('wild'), addTempDriver({ driverId: 'driver_tenth_strike', fights: 1 }));
        state = runReducer(state, addTempDriver({ driverId: 'driver_static_haze', fights: 0 }));
        expect(temp(state)).toEqual([]);
    });
});

describe('the count-down', () => {
    it('resolveEncounter ends the Driver’s one fight', () => {
        let state = runReducer(standingOn('wild'), addTempDriver({ driverId: 'driver_frayed_signal', fights: 1 }));
        state = runReducer(state, resolveEncounter());
        expect(temp(state)).toEqual([]);
    });

    it('a two-fight Driver survives the first fight and ends with the second', () => {
        let state = runReducer(standingOn('wild'), addTempDriver({ driverId: 'driver_frayed_signal', fights: 2 }));
        state = runReducer(state, resolveEncounter());
        expect(temp(state)).toEqual([{ driverId: 'driver_frayed_signal', fightsLeft: 1 }]);
        state = runReducer(state, resolveEncounter());
        expect(temp(state)).toEqual([]);
    });

    it('advanceGauntlet and finishGauntlet count down too', () => {
        let state = runReducer(standingOn('gym'), beginGauntlet());
        state = runReducer(state, addTempDriver({ driverId: 'driver_static_haze', fights: 3 }));
        state = runReducer(state, advanceGauntlet([{ memberId: 'mm1', hp: 20 }]));
        expect(temp(state)).toEqual([{ driverId: 'driver_static_haze', fightsLeft: 2 }]);
        state = runReducer(state, advanceGauntlet([{ memberId: 'mm1', hp: 20 }]));
        expect(temp(state)).toEqual([{ driverId: 'driver_static_haze', fightsLeft: 1 }]);
        state = runReducer(state, finishGauntlet());
        expect(temp(state)).toEqual([]);
    });
});
