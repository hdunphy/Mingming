/**
 * TICKET 182c — HOW THE INTRO ENDS, and what it does not count as.
 *
 * Win, lose or abandon, the intro ends the same way: the run is marked ended, the ranch's
 * `introDone` becomes true on the way out, and nothing the ladder counts moves - not `runsCompleted`
 * (the first real run still gets the first-run blueprint bonus), not `gymsCleared`, not `tierClears`.
 * Its run log carries `mode: "intro"`.
 */
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import battleReducer from './battleSlice';
import gameReducer, { createEmptyRanch, loadSave, resetSave, setIntroDone } from './gameSlice';
import runReducer, { beginGauntlet, endIntroRun, endRun, endRunAction, enterNode, setRun, startRun } from './runSlice';
import uiReducer from './uiSlice';
import { createRunLogMiddleware, currentRunLog, resetRunLogRecorder } from './runLogMiddleware';
import { teardownRun } from './runTeardown';
import { createIntroRun } from '../../engine/run/intro/createIntroRun';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { readRunLogs, emptyRunLog, writeRunLog } from '../../engine/run/runLog';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IMingmingState } from '../../engine/types';
import type { IRunState, RunOutcome } from '../../engine/runTypes';

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

const intro = (): IRunState => createIntroRun({ seed: 'intro-end', starter: KRAKEN, startedAt: 7000 });
const ordinary = (): IRunState => createRun({
    seed: 'ordinary-end', offer: offerGyms('ordinary-offer')[0], party: [KRAKEN], startedAt: 7000,
});

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false })
            .concat(createRunLogMiddleware(readRunLogs)),
    });
}

beforeEach(() => { setSaveStorage(new MemoryStorage()); resetRunLogRecorder(); });
afterEach(() => resetSaveStorage());

describe('182c the ranch field', () => {
    it('a new save has not done the intro; a reset save has not either', () => {
        expect(createEmptyRanch().introDone).toBe(false);
        const store = makeStore();
        store.dispatch(setIntroDone(true));
        expect(store.getState().game.introDone).toBe(true);
        store.dispatch(resetSave());
        expect(store.getState().game.introDone).toBe(false);
    });

    it('a loaded ranch keeps what it says', () => {
        const store = makeStore();
        store.dispatch(loadSave({ ...createEmptyRanch(), introDone: true }));
        expect(store.getState().game.introDone).toBe(true);
    });
});

describe('182c ending the run', () => {
    it.each<RunOutcome>(['victory', 'defeat', 'abandoned'])('an intro %s ends the run and is NOT counted as a finished run', (outcome) => {
        const store = makeStore();
        store.dispatch(startRun(intro()));
        store.dispatch(endRunAction(store.getState().run.run, outcome));
        expect(store.getState().run.run).toMatchObject({ phase: 'ended', outcome });
        expect(store.getState().game.runsCompleted).toBe(0);
    });

    it('an ordinary run still counts, exactly as before', () => {
        const store = makeStore();
        store.dispatch(startRun(ordinary()));
        store.dispatch(endRunAction(store.getState().run.run, 'defeat'));
        expect(store.getState().game.runsCompleted).toBe(1);
    });

    it('chooses the action in one place', () => {
        expect(endRunAction(intro(), 'victory')).toEqual(endIntroRun('victory'));
        expect(endRunAction(ordinary(), 'victory')).toEqual(endRun('victory'));
        // No run (a debug battle) is an ordinary one.
        expect(endRunAction(null, 'victory')).toEqual(endRun('victory'));
    });

    it('the intro gate is one fight, not three', () => {
        const store = makeStore();
        store.dispatch(startRun(intro()));
        for (const id of ['b0l1n0', 'b0l2n0', 'b0l3n1', 'b0l4n0']) store.dispatch(enterNode(id));
        store.dispatch(beginGauntlet());
        expect(store.getState().run.run?.gauntlet?.totalFights).toBe(1);
    });
});

describe('182c teardown', () => {
    const ended = (run: IRunState, outcome: RunOutcome): IRunState => ({ ...run, phase: 'ended', outcome });

    it.each<RunOutcome>(['victory', 'defeat', 'abandoned'])('an intro %s sets introDone and unlocks nothing', (outcome) => {
        const store = makeStore();
        store.dispatch(startRun(ended(intro(), outcome)));
        teardownRun({ run: store.getState().run.run!, dispatch: store.dispatch });
        const ranch = store.getState().game;
        expect(ranch.introDone).toBe(true);
        expect(ranch.gymsCleared).toEqual([]);
        expect(ranch.tierClears).toEqual({});
        expect(ranch.highestTierCleared).toBe(0);
        expect(store.getState().run.run).toBeNull();
    });

    it('an ordinary victory still clears the gym and leaves introDone alone', () => {
        const store = makeStore();
        const run = ended(ordinary(), 'victory');
        store.dispatch(startRun(run));
        teardownRun({ run, dispatch: store.dispatch });
        expect(store.getState().game.gymsCleared).toContain(run.gymId);
        expect(store.getState().game.introDone).toBe(false);
    });
});

describe('182c the run log', () => {
    it('says mode "intro" on the intro and nothing on an ordinary run', () => {
        const store = makeStore();
        store.dispatch(startRun(intro()));
        expect(currentRunLog()?.mode).toBe('intro');
        resetRunLogRecorder();
        store.dispatch(startRun(ordinary()));
        expect(currentRunLog()?.mode).toBeUndefined();
    });

    it('closes the intro transcript with RUN_ENDED and keeps the mode through storage', () => {
        const store = makeStore();
        store.dispatch(startRun(intro()));
        store.dispatch(endRunAction(store.getState().run.run, 'defeat'));
        const log = readRunLogs()[0];
        expect(log.mode).toBe('intro');
        expect(log.events[log.events.length - 1]).toMatchObject({ kind: 'RUN_ENDED', outcome: 'defeat' });
    });

    it('a resumed intro run keeps its mode', () => {
        const store = makeStore();
        store.dispatch(startRun(intro()));
        resetRunLogRecorder();
        store.dispatch(setRun(store.getState().run.run));
        expect(currentRunLog()?.mode).toBe('intro');
    });

    it('emptyRunLog only writes the field for the intro', () => {
        expect(emptyRunLog('s', 1)).not.toHaveProperty('mode');
        expect(emptyRunLog('s', 1, 'normal')).not.toHaveProperty('mode');
        expect(emptyRunLog('s', 1, 'intro').mode).toBe('intro');
        writeRunLog(emptyRunLog('s', 1, 'intro'));
        expect(readRunLogs()[0].mode).toBe('intro');
    });
});
