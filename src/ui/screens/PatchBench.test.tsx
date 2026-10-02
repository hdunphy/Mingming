// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { PatchBench } from './PatchBench';
import { describePatchOn } from '../../engine/data/patchText';
import { getPatch } from '../../engine/data/patchRegistry';
import runReducer from '../store/runSlice';
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
    { id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
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

function makeRun(): IRunState {
    const run = createRun({
        seed: 'patch-bench-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    return { ...run, partyIds: ['mm1', 'mm2'], scrap: 100 };
}

describe('166e — PatchBench at the gate', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        host.remove();
    });

    it('at the gate: fit one patch -> the rows are replaced by the "offers one" line', () => {
        const run = makeRun();
        const store = configureStore({
            reducer: { run: runReducer },
            preloadedState: { run: { run } },
        });

        const benchKey = 'patch:node_gate:1';

        const App = () => {
            const currentRun = store.getState().run.run!;
            return (
                <Provider store={store}>
                    <PatchBench run={currentRun} ranch={RANCH} venue="gate" benchKey={benchKey} />
                </Provider>
            );
        };

        act(() => {
            root.render(<App />);
        });

        const buttons = Array.from(host.querySelectorAll('button.rs-row'));
        expect(buttons.length).toBeGreaterThan(0);
        expect(host.textContent).not.toContain('Patch fitted — the gate offers one.');

        act(() => {
            (buttons[0] as HTMLButtonElement).click();
        });

        act(() => {
            root.render(<App />);
        });

        expect(host.textContent).toContain('Patch fitted — the gate offers one.');
        expect(host.querySelectorAll('button.rs-row').length).toBe(0);
    });

    it('184d: each row says what the patch does on THAT body, not the generic sentence', () => {
        const run = makeRun();
        const store = configureStore({ reducer: { run: runReducer }, preloadedState: { run: { run } } });
        act(() => {
            root.render(<Provider store={store}><PatchBench run={run} ranch={RANCH} venue="shop" /></Provider>);
        });
        const text = host.textContent ?? '';
        expect(text).toContain(describePatchOn('kraken_v1', 'amplifier'));
        expect(text).toContain(describePatchOn('fenrir_v1', 'amplifier'));
        expect(text).not.toContain(getPatch('amplifier')!.text);
    });
});
