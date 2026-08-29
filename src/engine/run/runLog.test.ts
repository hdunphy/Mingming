/**
 * The run log's pure half — ticket 59.
 *
 * The middleware test drives a whole run through a real store; this one holds down the three things
 * that are easy to get wrong and impossible to notice: the cap, the round trip, and the three
 * reader functions the debug panel's Done-when is written against.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    RUN_LOG_EVENT_CAP,
    RUN_LOG_KEY,
    RUN_LOG_RUNS,
    appendRunEvent,
    cardFlow,
    clearRunLogs,
    emptyRunLog,
    latestRunLog,
    readRunLogs,
    runCurves,
    runLogKeyFor,
    scrapByReason,
    serializeRunLogs,
    writeRunLog,
    type IRunLog,
    type RunEventInput,
} from './runLog';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../save/storage';

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) { this.data.set(key, value); }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
});

afterEach(() => {
    resetSaveStorage();
});

/** Append with an auto-incrementing stamp, the way the recorder does. */
function build(inputs: ReadonlyArray<RunEventInput & { deckSize?: number; scrap?: number }>): IRunLog {
    let log = emptyRunLog('seed-a', 1000);
    inputs.forEach((input, i) => {
        const { deckSize = 8, scrap = 20, ...rest } = input as RunEventInput & { deckSize?: number; scrap?: number };
        log = appendRunEvent(log, rest as RunEventInput, {
            seq: i + 1, fightIndex: 0, deckSize, scrap,
        });
    });
    return log;
}

describe('appendRunEvent', () => {
    it('mints nothing and trusts the stamp, so ordering survives a JSON round trip', () => {
        const log = build([{ kind: 'REROLLED', price: 10 }]);
        expect(log.events).toHaveLength(1);
        expect(log.events[0].seq).toBe(1);
    });

    it('DROPS past the cap and counts what it dropped, rather than evicting the oldest', () => {
        /*
         * The direction matters and is the header's argument: the questions this log answers are
         * about how a run DEVELOPS, so a head-truncated transcript is useful and a tail-truncated
         * one is not. `droppedEvents` is what stops the truncation from being silent — a capped log
         * that looked complete would answer "when did the deck get big" confidently and wrongly.
         */
        let log = emptyRunLog('seed-a', 1000);
        for (let i = 0; i < RUN_LOG_EVENT_CAP + 25; i++) {
            log = appendRunEvent(log, { kind: 'REROLLED', price: 10 }, {
                seq: i + 1, fightIndex: 0, deckSize: 8, scrap: 20,
            });
        }
        expect(log.events).toHaveLength(RUN_LOG_EVENT_CAP);
        expect(log.droppedEvents).toBe(25);
        // The FIRST row is still row 1 — the run's opening survived, which is the whole point.
        expect(log.events[0].seq).toBe(1);
    });
});

describe('storage', () => {
    it('round-trips a log through the adapter and never touches localStorage', () => {
        const log = build([{ kind: 'CARD_BOUGHT', dataId: 'hydro_blast', price: 25 }]);
        expect(writeRunLog(log)).toBe(true);
        expect(storage.keys()).toEqual([RUN_LOG_KEY]);

        const back = readRunLogs();
        expect(back).toHaveLength(1);
        expect(back[0].events[0]).toMatchObject({ kind: 'CARD_BOUGHT', dataId: 'hydro_blast', price: 25 });
    });

    it('REPLACES by runKey, so a growing run rewrites its own transcript', () => {
        // The property the recorder depends on to be safe to call on every event: without it a run
        // that logged 200 events would leave 200 near-identical transcripts and evict every other
        // run from the store.
        const first = build([{ kind: 'REROLLED', price: 10 }]);
        writeRunLog(first);
        writeRunLog(build([{ kind: 'REROLLED', price: 10 }, { kind: 'REROLLED', price: 10 }]));

        const logs = readRunLogs();
        expect(logs).toHaveLength(1);
        expect(logs[0].events).toHaveLength(2);
    });

    it(`keeps the last ${RUN_LOG_RUNS} runs and drops the oldest`, () => {
        for (let i = 0; i < RUN_LOG_RUNS + 2; i++) {
            writeRunLog({ ...emptyRunLog(`seed-${i}`, 1000 + i) });
        }
        const logs = readRunLogs();
        expect(logs).toHaveLength(RUN_LOG_RUNS);
        expect(logs[logs.length - 1].runKey).toBe(runLogKeyFor(`seed-${RUN_LOG_RUNS + 1}`, 1000 + RUN_LOG_RUNS + 1));
        expect(latestRunLog()?.runKey).toBe(logs[logs.length - 1].runKey);
    });

    it('reads absent, unparseable and version-mismatched stores all as no logs', () => {
        expect(readRunLogs()).toEqual([]);
        storage.write(RUN_LOG_KEY, 'not json at all');
        expect(readRunLogs()).toEqual([]);
        storage.write(RUN_LOG_KEY, JSON.stringify({ version: 99, logs: [] }));
        expect(readRunLogs()).toEqual([]);
    });

    it('keeps a row whose kind this build has never heard of', () => {
        // The schema is loose on purpose (see its comment): a strict per-kind union would be a
        // second declaration of `IRunEvent`, and its drift would silently delete rows written by a
        // newer build. An unknown kind must survive and be visibly unknown.
        storage.write(RUN_LOG_KEY, JSON.stringify({
            version: 1,
            logs: [{
                runKey: 'x@1', seed: 'x', startedAt: 1, droppedEvents: 0,
                events: [{ seq: 1, fightIndex: 0, deckSize: 8, scrap: 0, kind: 'SOMETHING_FROM_THE_FUTURE', extra: 7 }],
            }],
        }));
        const logs = readRunLogs();
        expect(logs[0].events[0].kind).toBe('SOMETHING_FROM_THE_FUTURE');
    });

    it('a failed write costs the log and never throws at the caller', () => {
        // Instrumentation may not be able to break the game. A full quota is the realistic case.
        setSaveStorage({
            read: () => null,
            write: () => { throw new Error('quota'); },
            remove: () => {},
            keys: () => [],
        });
        expect(writeRunLog(emptyRunLog('seed', 1))).toBe(false);
    });

    it('clears', () => {
        writeRunLog(build([{ kind: 'REROLLED', price: 10 }]));
        clearRunLogs();
        expect(readRunLogs()).toEqual([]);
    });

    it('serializes for export with an INJECTED clock', () => {
        // Same rule as `runTelemetry`'s `endedAt`: no engine module reads `Date.now()`, because a
        // module that reads the clock cannot be tested deterministically.
        writeRunLog(build([{ kind: 'REROLLED', price: 10 }]));
        const parsed = JSON.parse(serializeRunLogs(4242));
        expect(parsed.exportedAt).toBe(4242);
        expect(parsed.logs).toHaveLength(1);
    });
});

describe('the three questions the panel has to answer', () => {
    const log = build([
        { kind: 'RUN_STARTED', gymId: 'g', tier: 0, party: ['mm1'], deckSize: 8, scrap: 20 },
        { kind: 'SCRAP', delta: 15, reason: 'addRunScrap', deckSize: 8, scrap: 35 },
        { kind: 'CARD_PICKED', dataId: 'hydro_blast', offered: ['a', 'b', 'c'], deckSize: 9, scrap: 35 },
        { kind: 'CARD_SKIPPED', offered: ['d', 'e', 'f'], deckSize: 9, scrap: 35 },
        { kind: 'CARD_BOUGHT', dataId: 'whirlpool', price: 25, deckSize: 10, scrap: 10 },
        { kind: 'SCRAP', delta: -25, reason: 'buyMarketCard', deckSize: 10, scrap: 10 },
        { kind: 'CARD_REMOVED', dataId: 'water_slap', price: 20, deckSize: 9, scrap: 0 },
        { kind: 'SCRAP', delta: -10, reason: 'buyMarketCard', deckSize: 9, scrap: 0 },
    ]);

    it('how did the deck grow — every row is a sample, so the curve needs no joining', () => {
        const curve = runCurves(log).map((point) => point.deckSize);
        expect(curve).toEqual([8, 8, 9, 9, 10, 10, 9, 9]);
    });

    it('where did the scrap go — totalled by cause, biggest sink first', () => {
        expect(scrapByReason(log)).toEqual([
            { reason: 'buyMarketCard', total: -35 },
            { reason: 'addRunScrap', total: 15 },
        ]);
    });

    it('what did he skip — taken, declined, bought and removed, apart', () => {
        // Declined is the one the store cannot see on its own (`BattleArena` reports it), and it is
        // the number the whole deck-dilution question turns on.
        expect(cardFlow(log)).toEqual({
            picked: ['hydro_blast'],
            skipped: 1,
            bought: ['whirlpool'],
            removed: ['water_slap'],
        });
    });
});
