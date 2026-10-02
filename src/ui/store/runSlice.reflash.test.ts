/**
 * TICKET 168f — the `reflashMember` reducer: what it accepts and what it refuses.
 *
 * A refusal returns the run untouched, byte for byte, like every ineligible dispatch in the slice.
 */

import { describe, expect, it } from 'vitest';

import runReducer, { fitPatch, reflashEngine, reflashMember, type RunSliceState } from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
    { id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];
const makeRun = (): IRunState => createRun({ seed: 'reflash-reducer', offer: offerGyms('offer')[0], party: PARTY, startedAt: 1 });
const stateOf = (run: IRunState): RunSliceState => ({ run });

describe('reflashMember', () => {
    it('records the OS for that body and touches nothing else', () => {
        const run = makeRun();
        const after = runReducer(stateOf(run), reflashMember({ memberId: 'mm1', osId: 'kraken_v2' })).run!;
        expect(after.osOverrides).toEqual({ mm1: 'kraken_v2' });
        expect({ ...after, osOverrides: undefined }).toEqual({ ...run, osOverrides: undefined });
    });

    it('can flip a body again, and keeps other bodies’ overrides', () => {
        let state = stateOf(makeRun());
        state = runReducer(state, reflashMember({ memberId: 'mm1', osId: 'kraken_v2' }));
        state = runReducer(state, reflashMember({ memberId: 'mm2', osId: 'fenrir_v2' }));
        state = runReducer(state, reflashMember({ memberId: 'mm1', osId: 'kraken_v1' }));
        expect(state.run!.osOverrides).toEqual({ mm1: 'kraken_v1', mm2: 'fenrir_v2' });
    });

    it('refuses a patched body, byte for byte', () => {
        const patched = runReducer(stateOf(makeRun()), fitPatch({ memberId: 'mm1', patchId: 'amplifier' })).run!;
        expect(patched.patches?.mm1).toEqual(['amplifier']);
        expect(runReducer(stateOf(patched), reflashMember({ memberId: 'mm1', osId: 'kraken_v2' })).run).toEqual(patched);
        // ...and the body next to it, which has no patch, is still allowed.
        expect(runReducer(stateOf(patched), reflashMember({ memberId: 'mm2', osId: 'fenrir_v2' })).run!.osOverrides).toEqual({ mm2: 'fenrir_v2' });
    });

    it('refuses a member who is not in the party', () => {
        const run = makeRun();
        expect(runReducer(stateOf(run), reflashMember({ memberId: 'stranger', osId: 'kraken_v2' })).run).toEqual(run);
    });

    it('refuses an OS that no species has', () => {
        const run = makeRun();
        expect(runReducer(stateOf(run), reflashMember({ memberId: 'mm1', osId: 'not_an_os' })).run).toEqual(run);
    });

    it('does nothing without a run', () => {
        expect(runReducer({ run: null }, reflashMember({ memberId: 'mm1', osId: 'kraken_v2' })).run).toBeNull();
    });
});

describe('the workshop’s permanent reflash after an event reflash (168f follow-up)', () => {
    const workshop = { memberId: 'mm1', retireIds: [] as string[], cards: [], price: 0 };

    it('clears that body’s override, so the run follows the ranch OS the workshop just wrote', () => {
        let state = stateOf(makeRun());
        state = runReducer(state, reflashMember({ memberId: 'mm1', osId: 'kraken_v2' }));
        state = runReducer(state, reflashMember({ memberId: 'mm2', osId: 'fenrir_v2' }));
        const after = runReducer(state, reflashEngine(workshop)).run!;
        expect(after.osOverrides).toEqual({ mm2: 'fenrir_v2' });
    });

    it('leaves a run with no override for that body exactly as it was', () => {
        const run = makeRun();
        expect('osOverrides' in runReducer(stateOf(run), reflashEngine(workshop)).run!).toBe('osOverrides' in run);
    });
});
