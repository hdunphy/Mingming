/**
 * The run slice and the second autosave arm — ticket 09.
 *
 * The claim being tested is ticket 23's headline requirement, which only becomes provable now that
 * a run exists: **an app close mid-run resumes at the same node with the same seed.** Everything
 * else here supports that one sentence.
 *
 * The other half is the blast radius. Two keys were Henry's ruling precisely so a run and a ranch
 * cannot take each other down, and that is only true if the two writes really are two writes — so
 * this file asserts that a run write leaves the ranch bytes untouched and vice versa, at the store
 * level rather than the SaveSystem level, because the subscription is where it could go wrong.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import runReducer, { clearRun, endRun, setRun, startRun } from './runSlice';
import gameReducer, { addBlueprint } from './gameSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { loadGameState, saveRanch, saveRun } from '../../engine/SaveSystem';
import { getActiveRanchKey, getActiveRunKey } from '../../engine/SaveSlots';
import { toRanchState } from '../../engine/save/ranchProjection';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import { createDefaultSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

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

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});

const PARTY = [member('mm1', 'kraken', 'kraken_v1')];

function makeRun(seed = 'run-seed-1'): IRunState {
    return createRun({ seed, offer: offerGyms('offer-seed')[0], party: PARTY, startedAt: 1_700_000_000_000 });
}

describe('runSlice', () => {
    it('starts, rehydrates and clears', () => {
        const run = makeRun();
        let state = runReducer(undefined, { type: '@@init' });
        expect(state.run).toBeNull();

        state = runReducer(state, startRun(run));
        expect(state.run?.seed).toBe('run-seed-1');

        state = runReducer(state, clearRun());
        expect(state.run).toBeNull();

        state = runReducer(state, setRun(run));
        expect(state.run).toEqual(run);
    });

    it('endRun marks the outcome but does NOT throw the run away', () => {
        // Ticket 19 owns the run summary, and a summary has to read the corpse — what was banked,
        // how many fights, how it ended. Clearing here would delete the thing the summary reports.
        const state = runReducer({ run: makeRun() }, endRun('defeat'));
        expect(state.run).not.toBeNull();
        expect(state.run?.phase).toBe('ended');
        expect(state.run?.outcome).toBe('defeat');
    });

    it('endRun on no run is a no-op rather than a crash', () => {
        expect(runReducer({ run: null }, endRun('victory')).run).toBeNull();
    });
});

describe('an app close mid-run resumes at the same node with the same seed', () => {
    it('round-trips a run through storage', () => {
        const run = makeRun();
        // Walk somewhere that is not the entry, so "resumes at the same node" means something.
        const target = run.nodes.find((n) => n.id !== run.currentNodeId)!;
        const walked: IRunState = {
            ...run,
            currentNodeId: target.id,
            fightsResolved: 3,
            scrap: 42,
            nodes: run.nodes.map((n) => (n.id === target.id ? { ...n, visited: n.visited + 1 } : n)),
        };

        saveRanch(toRanchState({ ...createDefaultSave(), roster: PARTY }));
        expect(saveRun(walked).success).toBe(true);

        const loaded = loadGameState();
        expect(loaded.discarded).toBeUndefined();
        expect(loaded.run?.seed).toBe(run.seed);
        expect(loaded.run?.currentNodeId).toBe(target.id);
        expect(loaded.run?.fightsResolved).toBe(3);
        expect(loaded.run?.scrap).toBe(42);
        expect(loaded.run?.deck).toHaveLength(8);
    });

    it('the graph is not stored twice — the same seed regenerates the same region', () => {
        // The whole reason a run is one seed plus node state: the region is derivable, so a save is
        // small and a replay is exact.
        expect(makeRun('same').nodes).toEqual(makeRun('same').nodes);
        expect(makeRun('a').nodes).not.toEqual(makeRun('b').nodes);
    });
});

describe('the two autosave arms are genuinely independent', () => {
    function makeStore() {
        return configureStore({
            reducer: { game: gameReducer, run: runReducer },
            middleware: (getDefault) => getDefault({ serializableCheck: false }),
        });
    }

    /**
     * `store.ts` installs the real subscription, but importing it here would build the app's own
     * singleton store and drag `battleSlice` in with it. This mirrors the same two arms against a
     * local store — the thing under test is the *independence*, not the wiring.
     */
    function installAutosave(store: ReturnType<typeof makeStore>): void {
        let prevGame = store.getState().game;
        let prevRun = store.getState().run.run;
        store.subscribe(() => {
            const state = store.getState();
            if (state.game !== prevGame) { saveRanch(toRanchState(state.game)); prevGame = state.game; }
            if (state.run.run !== prevRun) { saveRun(state.run.run); prevRun = state.run.run; }
        });
    }

    it('a run write does not touch the ranch key', () => {
        const store = makeStore();
        installAutosave(store);
        store.dispatch(addBlueprint('kraken'));
        const ranchBytes = storage.read(getActiveRanchKey());

        store.dispatch(startRun(makeRun()));

        expect(storage.read(getActiveRunKey())).not.toBeNull();
        expect(storage.read(getActiveRanchKey())).toBe(ranchBytes);
    });

    it('a ranch write does not touch the run key', () => {
        const store = makeStore();
        installAutosave(store);
        store.dispatch(startRun(makeRun()));
        const runBytes = storage.read(getActiveRunKey());

        store.dispatch(addBlueprint('fenrir'));

        expect(storage.read(getActiveRunKey())).toBe(runBytes);
    });

    it('clearing the run REMOVES its key rather than writing a null envelope', () => {
        // One representation for "not in a run": absence. The same branch a fresh player takes.
        const store = makeStore();
        installAutosave(store);
        store.dispatch(startRun(makeRun()));
        expect(storage.read(getActiveRunKey())).not.toBeNull();

        store.dispatch(clearRun());

        expect(storage.read(getActiveRunKey())).toBeNull();
    });
});
