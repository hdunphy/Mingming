/**
 * Ticket 36. The wipe clears all four things, and clears them in the order that makes it stick.
 *
 * This is the test that could not exist while the wipe lived in an `onClick` — the whole reason
 * `wipeSave` takes `dispatch` as a parameter (`debug/saveSlots.ts`'s precedent). It runs against the
 * real store shape and the real storage adapter, swapped for an in-memory one.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getActiveRanchKey, getActiveRunKey } from '../../engine/SaveSlots';
import { saveRanch, saveRun } from '../../engine/SaveSystem';
import { RUN_TELEMETRY_KEY, recordRunEnd, runTelemetryEntryFor } from '../../engine/run/runTelemetry';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRanchState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { wipeSave } from './wipeSave';

class MemoryStorage implements ISaveStorage {
    readonly map = new Map<string, string>();
    read(key: string): string | null { return this.map.get(key) ?? null; }
    write(key: string, value: string): void { this.map.set(key, value); }
    remove(key: string): void { this.map.delete(key); }
    keys(): string[] { return [...this.map.keys()]; }
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
});

afterEach(() => resetSaveStorage());

const MEMBER: IMingmingState = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: 'kraken_v1',
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

const RANCH: IRanchState = {
    ...createEmptyRanch(),
    roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }],
    blueprints: { kraken: 4 },
    codex: { seen: ['hydro_blast'], played: [] , species: [], assembled: [], os: [] },
    gymsCleared: ['gym_emberfall'],
    seenTips: ['battle:energy'],
};

function loadedStore() {
    const run = createRun({
        seed: 'wipe-seed',
        offer: offerGyms('wipe-offer')[0],
        party: [MEMBER],
        startedAt: 1_700_000_000_000,
    });
    saveRanch(RANCH);
    saveRun(run);
    recordRunEnd(runTelemetryEntryFor({ ...run, outcome: 'defeat' }, run.startedAt + 60_000));

    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: { game: RANCH, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

describe('wipeSave', () => {
    it('empties the store and removes the stored bytes', () => {
        const store = loadedStore();
        expect(storage.read(getActiveRanchKey())).not.toBeNull();

        wipeSave(store.dispatch);

        expect(store.getState().game).toEqual(createEmptyRanch());
        expect(store.getState().run.run).toBeNull();
        expect(storage.read(getActiveRanchKey())).toBeNull();
        expect(storage.read(getActiveRunKey())).toBeNull();
    });

    it('takes the run history with it', () => {
        // A player wiping their save does not expect their run clock to survive it.
        const store = loadedStore();
        expect(storage.read(RUN_TELEMETRY_KEY)).not.toBeNull();
        wipeSave(store.dispatch);
        expect(storage.read(RUN_TELEMETRY_KEY)).toBeNull();
    });

    it('leaves settings and audio alone — they were never part of the save', () => {
        const store = loadedStore();
        storage.write('mingming_audio', JSON.stringify({ volume: 0.3, muted: true }));
        storage.write('mingming_settings', JSON.stringify({ reducedMotion: 'on', textScale: 1.15 }));

        wipeSave(store.dispatch);

        expect(storage.read('mingming_audio')).not.toBeNull();
        expect(storage.read('mingming_settings')).not.toBeNull();
    });

    it('clears the run BEFORE the ranch, so nothing is mid-fight over a vanished roster', () => {
        const seen: string[] = [];
        wipeSave((action) => seen.push(action.type));
        expect(seen).toEqual(['run/clearRun', 'game/resetSave']);
    });

    it('reports what it cleared', () => {
        const store = loadedStore();
        expect(wipeSave(store.dispatch).steps).toEqual(['run', 'ranch', 'stored save', 'run history']);
    });
});
