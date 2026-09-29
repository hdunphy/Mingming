/**
 * TICKET 169f — the run log records which modifiers a run started with, and an old log without the
 * field still reads.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import battleReducer from './battleSlice';
import gameReducer from './gameSlice';
import runReducer, { startRun } from './runSlice';
import uiReducer from './uiSlice';
import { createRunLogMiddleware, currentRunLog, resetRunLogRecorder } from './runLogMiddleware';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { readRunLogs, RUN_LOG_KEY, RUN_LOG_VERSION } from '../../engine/run/runLog';
import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IMingmingState } from '../../engine/types';

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) { this.data.set(key, value); }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(createRunLogMiddleware(readRunLogs)),
    });
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
    resetRunLogRecorder();
    saveSettings(DEFAULT_SETTINGS);
});

afterEach(() => {
    resetSaveStorage();
});

const runStarted = () => currentRunLog()?.events.find((event) => event.kind === 'RUN_STARTED') as
    | { modifiers?: ReadonlyArray<string>; tier: number }
    | undefined;

describe('RUN_STARTED carries the modifiers', () => {
    it('lists the active modifier ids', () => {
        const store = makeStore();
        store.dispatch(startRun(createRun({
            seed: 'log-mods', offer: offerGyms('log-offer')[0], party: [KRAKEN], startedAt: 1,
            modifiers: ['junk_start', 'no_recruits'], tier: 2,
        })));
        expect(runStarted()?.modifiers).toEqual(['junk_start', 'no_recruits']);
        expect(runStarted()?.tier).toBe(2);
    });

    it('is an empty list for a run with none', () => {
        const store = makeStore();
        store.dispatch(startRun(createRun({
            seed: 'log-none', offer: offerGyms('log-offer')[0], party: [KRAKEN], startedAt: 1,
        })));
        expect(runStarted()?.modifiers).toEqual([]);
    });
});

describe('a log written before 169f', () => {
    it('still reads: a RUN_STARTED row without modifiers survives the round trip untouched', () => {
        const old = {
            version: RUN_LOG_VERSION,
            logs: [{
                runKey: 'old', seed: 's', startedAt: 1,
                events: [{ seq: 0, fightIndex: 0, deckSize: 8, scrap: 20, kind: 'RUN_STARTED', gymId: 'g', tier: 0, party: ['mm1'] }],
            }],
        };
        storage.write(RUN_LOG_KEY, JSON.stringify(old));
        const logs = readRunLogs();
        expect(logs).toHaveLength(1);
        expect(logs[0].events[0]).toMatchObject({ kind: 'RUN_STARTED', tier: 0 });
        expect((logs[0].events[0] as { modifiers?: unknown }).modifiers).toBeUndefined();
    });
});
