/**
 * RUN TEARDOWN — ticket 19. **The one path all three endings take, and the bug it must never let
 * back in.**
 *
 * Ticket 11 found that bug: the defeat path called `deleteSave()`, which deleted the *ranch* —
 * assembled individuals with unrepeatable stat rolls, blueprint counts, the codex. The wipe is long
 * gone, but "a defeat leaves the ranch alone" is not a property that stays true by itself: teardown
 * is now the one place all three endings write the ranch, so it is the one place a future ticket
 * could reintroduce it. The roster-and-blueprints assertion below is deliberately explicit rather
 * than implied by a snapshot, because a test whose failure message names the roster is a test that
 * explains what went wrong.
 *
 * Everything else here is the same shape: victory unlocks, the other two do not, the codex only
 * grows, and the storage keys end up the way ticket 06's split says they must.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import gameReducer, { addBlueprint, addToRoster, recordCodexSeen } from './gameSlice';
import runReducer, { endRun, startRun } from './runSlice';
import { teardownRun } from './runTeardown';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { getActiveRanchKey, getActiveRunKey } from '../../engine/SaveSlots';
import { saveRanch, saveRun } from '../../engine/SaveSystem';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IRanchMember, IRunCard, IRunState, RunOutcome } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

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

const RANCH_MEMBER: IRanchMember = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: 'kraken_v1',
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

function makeRun(over: Partial<IRunState> = {}): IRunState {
    return {
        ...createRun({
            seed: 'teardown-seed',
            offer: offerGyms('offer-seed')[0],
            party: [MEMBER],
            startedAt: STARTED_AT,
        }),
        ...over,
    };
}

function makeStore() {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

/**
 * The two autosave arms from `store.ts`, mirrored against a local store — importing the real one
 * would build the app's singleton and drag `battleSlice` in with it. The thing under test is what
 * teardown leaves in storage, and that is a property of the two arms being independent, which this
 * reproduces exactly. (Same helper `runSlice.test.ts` uses, for the same reason.)
 */
function installAutosave(store: ReturnType<typeof makeStore>): void {
    let prevGame = store.getState().game;
    let prevRun = store.getState().run.run;
    store.subscribe(() => {
        const state = store.getState();
        if (state.game !== prevGame) { saveRanch(state.game); prevGame = state.game; }
        if (state.run.run !== prevRun) { saveRun(state.run.run); prevRun = state.run.run; }
    });
}

/** A store standing at the ranch with one individual and one blueprint, mid-run, about to end it. */
function inRun(outcome: RunOutcome, over: Partial<IRunState> = {}) {
    const store = makeStore();
    store.dispatch(addToRoster(RANCH_MEMBER));
    store.dispatch(addBlueprint('fenrir'));
    store.dispatch(startRun(makeRun(over)));
    store.dispatch(endRun(outcome));
    return store;
}

describe('teardownRun — all three endings land on the ranch with the run cleared', () => {
    for (const outcome of ['victory', 'defeat', 'abandoned'] as const) {
        it(`clears the run after a ${outcome}`, () => {
            const store = inRun(outcome);
            // The summary reads the corpse first — `endRun` marks and keeps, `clearRun` throws away.
            expect(store.getState().run.run?.phase).toBe('ended');
            expect(store.getState().run.run?.outcome).toBe(outcome);

            teardownRun({ run: store.getState().run.run!, dispatch: store.dispatch });

            expect(store.getState().run.run).toBeNull();
        });
    }
});

describe('teardownRun — the ranch survives a defeat', () => {
    it('leaves the roster and the blueprints exactly as they were', () => {
        // THE TICKET 11 BUG, PINNED. The defeat path used to call `deleteSave()`, which deleted the
        // ranch: individuals with unrepeatable stat rolls and the only persistent currency in the
        // game. This is the assertion that keeps it fixed.
        const store = inRun('defeat');
        const before = store.getState().game;

        teardownRun({ run: store.getState().run.run!, dispatch: store.dispatch });

        const after = store.getState().game;
        expect(after.roster).toEqual(before.roster);
        expect(after.roster).toHaveLength(1);
        expect(after.roster[0].id).toBe('mm1');
        expect(after.blueprints).toEqual({ fenrir: 1 });
    });

    it('leaves the ranch save key written and removes only the run key', () => {
        // Ticket 06's split, at the one moment it matters most: the disposable half goes, the
        // irreplaceable half stays. `saveRun(null)` REMOVES rather than writing a null envelope, so
        // the next load takes the "no run" branch by absence.
        const store = makeStore();
        installAutosave(store);
        store.dispatch(addToRoster(RANCH_MEMBER));
        store.dispatch(startRun(makeRun()));
        store.dispatch(endRun('defeat'));
        expect(storage.read(getActiveRunKey())).not.toBeNull();

        teardownRun({ run: store.getState().run.run!, dispatch: store.dispatch });

        expect(storage.read(getActiveRunKey())).toBeNull();
        expect(storage.read(getActiveRanchKey())).not.toBeNull();
        expect(JSON.parse(storage.read(getActiveRanchKey())!).ranch.roster).toHaveLength(1);
    });
});

describe('teardownRun — the unlock is victory-only', () => {
    it('marks the gym and records the tier on a victory', () => {
        const store = inRun('victory', { tier: 2 });
        const run = store.getState().run.run!;

        teardownRun({ run, dispatch: store.dispatch });

        expect(store.getState().game.gymsCleared).toEqual([run.gymId]);
        expect(store.getState().game.highestTierCleared).toBe(2);
    });

    for (const outcome of ['defeat', 'abandoned'] as const) {
        it(`unlocks nothing on a ${outcome}`, () => {
            // You do not unlock a tier by walking away from it, and a lost run must not either.
            const store = inRun(outcome, { tier: 2 });

            teardownRun({ run: store.getState().run.run!, dispatch: store.dispatch });

            expect(store.getState().game.gymsCleared).toEqual([]);
            expect(store.getState().game.highestTierCleared).toBe(0);
        });
    }

    it('is safe to run twice — the reducers it uses are idempotent', () => {
        // The crash-safety argument in `runTeardown.ts`: ranch writes land before `clearRun`, so a
        // crash in between leaves a summary the player can leave again. That is only recoverable if
        // the second pass is a no-op.
        const store = inRun('victory', { tier: 1 });
        const run = store.getState().run.run!;

        teardownRun({ run, dispatch: store.dispatch });
        teardownRun({ run, dispatch: store.dispatch });

        expect(store.getState().game.gymsCleared).toEqual([run.gymId]);
        expect(store.getState().game.highestTierCleared).toBe(1);
        const codex = store.getState().game.codex.seen;
        expect(new Set(codex).size).toBe(codex.length);
    });
});

describe('teardownRun — the codex merge', () => {
    it('writes the run’s cards into codex.seen on every outcome', () => {
        // Nothing wrote `IRanchState.codex` before this ticket. A lost run still saw its cards, and
        // the codex has zero power attached (`economy-session.md`), so there is nothing to withhold.
        const store = inRun('defeat');
        const run = store.getState().run.run!;

        teardownRun({ run, dispatch: store.dispatch });

        const seen = store.getState().game.codex.seen;
        for (const card of run.deck) expect(seen).toContain(card.dataId);
    });

    it('dedupes against what the ranch already holds, and only ever adds', () => {
        const store = inRun('defeat');
        const run = store.getState().run.run!;
        // Something already in the codex from an earlier run, plus something this run never held.
        store.dispatch(recordCodexSeen([run.deck[0].dataId, 'from_a_previous_run']));
        const before = store.getState().game.codex.seen.length;

        teardownRun({ run, dispatch: store.dispatch });

        const seen = store.getState().game.codex.seen;
        expect(seen.filter((id) => id === run.deck[0].dataId)).toHaveLength(1);
        expect(seen).toContain('from_a_previous_run');
        expect(seen.length).toBeGreaterThanOrEqual(before);
        expect(new Set(seen).size).toBe(seen.length);
    });

    it('leaves codex.played alone — the seen/played split is ticket 31’s', () => {
        // `played` means "actually cast", which needs an in-battle hook this ticket is not the place
        // for. Writing the deck into `played` would be a claim the game cannot support.
        const store = inRun('victory');
        teardownRun({ run: store.getState().run.run!, dispatch: store.dispatch });
        expect(store.getState().game.codex.played).toEqual([]);
    });

    it('records a card the run bought, not only the kit it started with', () => {
        const bought: IRunCard = { instanceId: 'bought-1', dataId: 'bought_card', ownerId: null };
        const store = inRun('abandoned');
        const run = store.getState().run.run!;
        const withBuy: IRunState = { ...run, deck: [...run.deck, bought] };

        teardownRun({ run: withBuy, dispatch: store.dispatch });

        expect(store.getState().game.codex.seen).toContain('bought_card');
    });
});
