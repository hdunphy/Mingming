// @vitest-environment jsdom
/**
 * AUTO-SAVE, AT THE MOMENT A RUN ENDS.
 *
 * Henry, 2026-08-24: *"Having to export at the right time doesn't work. I often forget."* The whole
 * feature is an effect firing once on a screen, so `renderToStaticMarkup` — which every other
 * `RunSummary` test uses, and which runs no effects — is structurally blind to it. This is the
 * jsdom + `createRoot` harness instead (ticket 58).
 *
 * Three things have to hold, and the second is the one with teeth:
 *   1. it writes when the setting is on;
 *   2. it writes **once**, though this component legitimately mounts more than once per run;
 *   3. it writes nothing when the setting is off.
 *
 * (2) is not fussiness. StrictMode double-invokes effects, and the run save is not removed until
 * teardown — so closing the app on this screen and reopening lands here again for the same run. A
 * duplicate download every time, plus the browser's "allow multiple downloads" prompt, is exactly
 * the kind of noise that gets a tester to switch the feature off.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';

import RunSummary from './RunSummary';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { emptyRunLog, writeRunLog } from '../../engine/run/runLog';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IRanchMember, IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) { this.data.set(key, value); }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

const STARTED_AT = 1_700_000_000_000;

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const ROSTER: IRanchMember[] = [{
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10,
}];

const RUN: IRunState = {
    ...createRun({
        seed: 'auto-save-seed',
        offer: offerGyms('auto-save-offer')[0],
        party: [MEMBER],
        startedAt: STARTED_AT,
    }),
    phase: 'ended',
    outcome: 'victory',
};

let host: HTMLDivElement;
let root: Root;
/** Download names the page asked the browser for. */
let saved: string[];
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    setSaveStorage(new MemoryStorage());
    // The run must already have a transcript — the recorder wrote it during the run.
    writeRunLog(emptyRunLog(RUN.seed, RUN.startedAt));

    saved = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:test';
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        saved.push(this.getAttribute('download') ?? '');
    });

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    clickSpy.mockRestore();
    resetSaveStorage();
});

function makeStore() {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: { game: { ...createEmptyRanch(), roster: ROSTER }, run: { run: RUN } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

async function showSummary(): Promise<void> {
    await act(async () => {
        root.render(
            <Provider store={makeStore()}>
                <RunSummary run={RUN} endedAt={STARTED_AT + 60_000} />
            </Provider>,
        );
    });
}

describe('auto-saving the run log when a run ends', () => {
    it('writes nothing when the setting is off — which is the default', () => {
        expect(DEFAULT_SETTINGS.autoSaveRunLog).toBe(false);
    });

    it('stays silent for an ordinary player', async () => {
        await showSummary();
        expect(saved).toEqual([]);
    });

    it('writes the run to a file the moment the summary appears, with the setting on', async () => {
        saveSettings({ ...DEFAULT_SETTINGS, autoSaveRunLog: true });
        await showSummary();

        expect(saved).toHaveLength(1);
        // The name has to identify the run without being opened: outcome and seed, date first so a
        // folder of them sorts into the order they were played.
        expect(saved[0]).toMatch(/^mingming-run-\d{4}-\d{2}-\d{2}T\d{4}-victory-auto-save-seed\.json$/);
    });

    it('writes ONCE, though the screen mounts again for the same run', async () => {
        saveSettings({ ...DEFAULT_SETTINGS, autoSaveRunLog: true });
        await showSummary();
        expect(saved).toHaveLength(1);

        // A reload on the summary screen: the run save is not removed until teardown, so the same
        // run legitimately lands here a second time. `recordRunEnd` returning false is what stops
        // the second download.
        await act(async () => { root.unmount(); });
        root = createRoot(host);
        await showSummary();

        expect(saved).toHaveLength(1);
    });
});
