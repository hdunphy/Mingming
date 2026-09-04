/**
 * The run clock's local log — ticket 19.
 *
 * Three properties matter and each has a failure worth naming:
 *
 *  1. **It round-trips through `ISaveStorage`.** If it ever reached for `localStorage` directly it
 *     would break ticket 42's file-backend swap silently — the code would still work in a browser
 *     and would write nothing at all in the packaged desktop build. The fake below is the same
 *     `ISaveStorage` shape ticket 42 implements, so a test that passes here is a test that passes
 *     against a file backend.
 *  2. **It is bounded.** An append-only log in a store that shares its quota with the ranch is a
 *     leak whose failure mode is "the player's ranch stops saving".
 *  3. **It is idempotent per run.** The summary records on mount, and an ended run survives an app
 *     close — so without a run identity the window would fill with duplicates of one run.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRun } from './createRun';
import { offerGyms } from './gyms';
import {
    RUN_TELEMETRY_KEY,
    RUN_TELEMETRY_LIMIT,
    clearRunTelemetry,
    readRunTelemetry,
    recordRunEnd,
    runTelemetryEntryFor,
    runTelemetryKeyFor,
} from './runTelemetry';
import { getActiveRanchKey, getActiveRunKey } from '../SaveSlots';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../save/storage';
import type { IRunState } from '../runTypes';
import type { IMingmingState } from '../types';

class MemoryStorage implements ISaveStorage {
    readonly map = new Map<string, string>();
    /** Set to make every write throw — a full quota, which telemetry must swallow. */
    failWrites = false;
    read(key: string): string | null { return this.map.get(key) ?? null; }
    write(key: string, value: string): void {
        if (this.failWrites) throw new Error('QuotaExceededError');
        this.map.set(key, value);
    }
    remove(key: string): void { this.map.delete(key); }
    keys(): string[] { return [...this.map.keys()]; }
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
});

afterEach(() => resetSaveStorage());

const STARTED_AT = 1_700_000_000_000;

const MEMBER: IMingmingState = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: 'kraken_v1',
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

function makeRun(seed = 'telemetry-seed', over: Partial<IRunState> = {}): IRunState {
    return {
        ...createRun({ seed, offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: STARTED_AT }),
        ...over,
    };
}

describe('runTelemetryEntryFor', () => {
    it('records outcome, duration, fights, deck size, biome, gym and tier', () => {
        const run = makeRun('t1', { phase: 'ended', outcome: 'victory', fightsResolved: 11 });
        const entry = runTelemetryEntryFor(run, STARTED_AT + 40 * 60_000);

        expect(entry).toMatchObject({
            outcome: 'victory',
            durationMs: 40 * 60_000,
            fightsResolved: 11,
            deckSize: run.deck.length,
            biomeReached: 1,
            gymId: run.gymId,
            tier: run.tier,
        });
        expect(entry.runKey).toBe(runTelemetryKeyFor(run));
    });

    it('files a run that never got an outcome as abandoned rather than as null', () => {
        // A nullable outcome is a column every reader has to special-case, and in every path that
        // exists a run reaching the log without an outcome is one the player walked out of.
        expect(runTelemetryEntryFor(makeRun(), STARTED_AT).outcome).toBe('abandoned');
    });
});

describe('the log', () => {
    it('round-trips through the ISaveStorage adapter under its own key', () => {
        const run = makeRun('t1', { phase: 'ended', outcome: 'defeat' });
        expect(recordRunEnd(runTelemetryEntryFor(run, STARTED_AT + 60_000))).toBe(true);

        // The KEY is the assertion, not just the read-back: it must be its own key and never a save
        // slot's, because `IRanchState` is ratified and has nowhere to put this.
        expect(storage.keys()).toContain(RUN_TELEMETRY_KEY);
        expect(storage.keys()).not.toContain(getActiveRanchKey());

        const entries = readRunTelemetry();
        expect(entries).toHaveLength(1);
        expect(entries[0].outcome).toBe('defeat');
        expect(entries[0].durationMs).toBe(60_000);
    });

    it('never writes the ranch or run save keys', () => {
        recordRunEnd(runTelemetryEntryFor(makeRun('t1'), STARTED_AT));
        expect(storage.read(getActiveRanchKey())).toBeNull();
        expect(storage.read(getActiveRunKey())).toBeNull();
    });

    it('refuses a second entry for the same run', () => {
        // The summary records on mount, and a run left at `phase: 'ended'` comes back to that screen
        // after an app close — the run save is not removed until teardown. Without this the window
        // would fill with duplicates of one run.
        const run = makeRun('t1', { phase: 'ended', outcome: 'victory' });
        expect(recordRunEnd(runTelemetryEntryFor(run, STARTED_AT + 1000))).toBe(true);
        expect(recordRunEnd(runTelemetryEntryFor(run, STARTED_AT + 9999))).toBe(false);
        expect(readRunTelemetry()).toHaveLength(1);
    });

    it('is bounded, dropping the oldest run rather than growing forever', () => {
        for (let i = 0; i < RUN_TELEMETRY_LIMIT + 5; i++) {
            recordRunEnd(runTelemetryEntryFor(makeRun(`run-${i}`, { phase: 'ended', outcome: 'defeat' }), STARTED_AT));
        }
        const entries = readRunTelemetry();
        expect(entries).toHaveLength(RUN_TELEMETRY_LIMIT);
        // The window keeps the MOST RECENT runs — a playtest question is always about the runs just
        // played, so trimming the other end would answer the wrong question.
        expect(entries[entries.length - 1].runKey).toContain('run-54');
        expect(entries.some((e) => e.runKey.startsWith('run-0@'))).toBe(false);
    });

    it('reads unparseable, unknown-version and absent bytes all as "no telemetry"', () => {
        expect(readRunTelemetry()).toEqual([]);

        storage.write(RUN_TELEMETRY_KEY, 'not json at all');
        expect(readRunTelemetry()).toEqual([]);

        storage.write(RUN_TELEMETRY_KEY, JSON.stringify({ version: 999, entries: [] }));
        expect(readRunTelemetry()).toEqual([]);
    });

    it('swallows a failed write — a full quota costs a data point, never the summary screen', () => {
        storage.failWrites = true;
        expect(() => recordRunEnd(runTelemetryEntryFor(makeRun('t1'), STARTED_AT))).not.toThrow();
        expect(recordRunEnd(runTelemetryEntryFor(makeRun('t2'), STARTED_AT))).toBe(false);
    });

    it('clears', () => {
        recordRunEnd(runTelemetryEntryFor(makeRun('t1'), STARTED_AT));
        clearRunTelemetry();
        expect(readRunTelemetry()).toEqual([]);
    });
});
