/**
 * THE RUN LOG IS NOT REWRITTEN ON EVERY DISPATCH.
 *
 * `writeRunLog` reads, validates, re-serialises and rewrites every stored run, and in the desktop
 * build each of those is a synchronous IPC call onto the disk. The middleware used to queue one
 * after EVERY dispatch of a run (clicking a party member counted), so the game got slower as the
 * log grew: about 1.6 ms for a first run and about 50 ms at the event cap in a CPU-only
 * measurement, before any disk time, on every click.
 *
 * These pin the new contract: a click writes nothing; real rows coalesce into one trailing write;
 * and the moments that must not lose a row (a fight closing, a run ending, an export, the window
 * going away) write at once.
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

import battleReducer, { selectCard, selectSource, setBattleState, startBattle } from './battleSlice';
import gameReducer from './gameSlice';
import runReducer, { addRunScrap, startRun } from './runSlice';
import uiReducer from './uiSlice';
import { createRunLogMiddleware, currentRunLog, flushRunLogNow, resetRunLogRecorder } from './runLogMiddleware';
import type { FlushScheduler } from './TrailingFlush';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { RUN_LOG_KEY, readRunLogs } from '../../engine/run/runLog';
import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IBattleSetup } from '../../engine/data/battleFactories';
import type { IMingmingState } from '../../engine/types';

/** Counts writes to the run-log key, which is the thing that costs. */
class CountingStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    runLogWrites = 0;
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) {
        if (key === RUN_LOG_KEY) this.runLogWrites += 1;
        this.data.set(key, value);
    }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

class ManualScheduler implements FlushScheduler {
    private tasks = new Map<number, () => void>();
    private next = 1;
    schedule(run: () => void): () => void {
        const id = this.next++;
        this.tasks.set(id, run);
        return () => { this.tasks.delete(id); };
    }
    get waiting(): number { return this.tasks.size; }
    runDue(): void {
        const due = [...this.tasks.values()];
        this.tasks.clear();
        for (const run of due) run();
    }
}

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const SETUP: IBattleSetup = { party: [KRAKEN], deck: ['water_slap'], drivers: [], persistedHp: {} };

let storage: CountingStorage;
let scheduler: ManualScheduler;
let clock: number;

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false })
            .concat(createRunLogMiddleware(readRunLogs, () => clock, scheduler)),
    });
}

const makeRun = () => createRun({ seed: 'flush-seed', offer: offerGyms('flush-offer')[0], party: [KRAKEN], startedAt: 7000 });

/** Let any microtask the OLD implementation used run, so a regression cannot hide behind timing. */
const settle = () => Promise.resolve().then(() => Promise.resolve());

beforeEach(() => {
    storage = new CountingStorage();
    scheduler = new ManualScheduler();
    clock = 1_000;
    setSaveStorage(storage);
    resetRunLogRecorder();
    saveSettings(DEFAULT_SETTINGS);
});

afterEach(() => {
    resetRunLogRecorder();
    resetSaveStorage();
});

describe('the run log write is coalesced', () => {
    it('writes NOTHING for a click: selecting a party member or a card is not a log event', async () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        flushRunLogNow();
        await settle();
        const before = storage.runLogWrites;

        for (let i = 0; i < 40; i += 1) {
            clock += 700;                                   // time passes between clicks
            store.dispatch(selectSource('mm1'));
            store.dispatch(selectCard(i % 2 ? 'card_0' : 'card_1'));
            await settle();
        }

        expect(storage.runLogWrites - before).toBe(0);
        expect(scheduler.waiting).toBe(0);
    });

    it('keeps active time in memory for a click, and persists it with the next flush', async () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        flushRunLogNow();
        const start = currentRunLog()!.activeMs;

        clock += 5_000;
        store.dispatch(selectSource('mm1'));
        await settle();

        expect(currentRunLog()!.activeMs).toBe(start + 5_000);
        // Not written yet...
        expect(readRunLogs()[0].activeMs).toBe(start);
        // ...and written by the next flush.
        store.dispatch(addRunScrap(1));
        flushRunLogNow();
        expect(readRunLogs()[0].activeMs).toBe(start + 5_000);
    });

    it('folds every row recorded inside one window into a single trailing write', async () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        flushRunLogNow();
        const before = storage.runLogWrites;

        for (let i = 0; i < 12; i += 1) store.dispatch(addRunScrap(3));   // a SCRAP row each
        await settle();
        expect(storage.runLogWrites - before).toBe(0);                    // nothing yet
        expect(scheduler.waiting).toBe(1);                                // one write is queued

        scheduler.runDue();
        expect(storage.runLogWrites - before).toBe(1);
        const stored = readRunLogs()[0];
        expect(stored.events).toHaveLength(currentRunLog()!.events.length);
    });

    it('flushRunLogNow persists what is waiting and cancels the queued write', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        flushRunLogNow();
        store.dispatch(addRunScrap(9));
        const rows = currentRunLog()!.events.length;
        expect(readRunLogs()[0].events).not.toHaveLength(rows);

        flushRunLogNow();
        expect(readRunLogs()[0].events).toHaveLength(rows);
        expect(scheduler.waiting).toBe(0);

        const writes = storage.runLogWrites;
        flushRunLogNow();                                                  // nothing pending
        scheduler.runDue();
        expect(storage.runLogWrites).toBe(writes);
    });

    it('writes at once when a fight closes, so a fight is never lost to a crash', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));
        store.dispatch(setBattleState(null));                              // the arena clears the board

        const kindsInMemory = currentRunLog()!.events.map((event) => event.kind);
        expect(kindsInMemory).toContain('FIGHT_ENDED');
        // No timer was turned: the fight's close is what wrote it.
        expect(readRunLogs()[0].events.map((event) => event.kind)).toEqual(kindsInMemory);
    });
});
