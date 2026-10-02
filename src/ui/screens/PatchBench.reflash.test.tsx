// @vitest-environment jsdom
/**
 * TICKET 168f — the patch bench offers a reflashed body the patches its NEW firmware ranks, not the
 * ranch OS it was flashed away from. A patch is fitted to a firmware, so an offer built from the
 * wrong one would hand the player a rider for hooks the body no longer runs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { PatchBench } from './PatchBench';
import runReducer from '../store/runSlice';
import { rawFirmwareHooks } from '../../engine/data/firmwareRegistry';
import { getPatch } from '../../engine/data/patchRegistry';
import { gatePatchChoices } from '../../engine/data/patchRanking';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PARTY: Array<IMingmingState & IRanchMember> = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];
const RANCH: IRanchState = {
    roster: PARTY,
    blueprints: {},
    codex: { seen: [], played: [], species: [], assembled: [], os: [] },
    codexMilestones: [],
    gymsCleared: [],
    highestTierCleared: 0,
    tierClears: {},
    seenTips: [],
};
const runWith = (over: Partial<IRunState>): IRunState => ({
    ...createRun({ seed: 'patch-reflash', offer: offerGyms('offer-seed')[0], party: PARTY, startedAt: 1 }),
    ...over,
});

describe('168f — PatchBench on a reflashed body', () => {
    let host: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
    });
    afterEach(() => {
        act(() => { root.unmount(); });
        host.remove();
    });

    const shownNames = (run: IRunState): string => {
        const store = configureStore({ reducer: { run: runReducer }, preloadedState: { run: { run } } });
        act(() => {
            root.render(<Provider store={store}><PatchBench run={run} ranch={RANCH} venue="gate" benchKey="patch:n:1" /></Provider>);
        });
        return host.textContent ?? '';
    };
    const namesFor = (osId: string): string[] =>
        gatePatchChoices(rawFirmwareHooks(osId), []).map((id) => getPatch(id)!.name);

    it('offers the two patches the new firmware ranks, and not the old one’s pair', () => {
        const flashed = shownNames(runWith({ osOverrides: { mm1: 'kraken_v2' } }));
        for (const name of namesFor('kraken_v2')) expect(flashed).toContain(name);
        const old = namesFor('kraken_v1').filter((name) => !namesFor('kraken_v2').includes(name));
        // The two firmwares must actually rank differently or this test proves nothing.
        expect(old.length).toBeGreaterThan(0);
        for (const name of old) expect(flashed).not.toContain(name);
    });

    it('control: with no override it offers the ranch firmware’s pair', () => {
        const plain = shownNames(runWith({}));
        for (const name of namesFor('kraken_v1')) expect(plain).toContain(name);
    });
});
