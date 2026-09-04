/**
 * THE RUN LOG, DRIVEN THROUGH A REAL STORE — ticket 59's Done-when.
 *
 * *"A full run produces a log containing every event class"* is not a claim any unit test on the
 * pure helpers can make, because the whole design bet is that **the middleware derives rows from
 * what changed rather than from call sites announcing themselves**. What that bet risks is a row
 * class that nothing ever emits — the log looks healthy, the panel renders, and the answer to
 * "where did the scrap go" is quietly missing a sink. So this drives the actual actions through the
 * actual middleware and asserts the transcript that comes out.
 *
 * The store is assembled here rather than imported from `store.ts`: that module is a singleton with
 * an autosave subscription attached at import, and a test that shared it would be writing the
 * suite's fixtures into whatever storage the previous test left installed.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import battleReducer, { setBattleState, startBattle } from './battleSlice';
import gameReducer, { swapOS } from './gameSlice';
import runReducer, {
    addRunScrap,
    buyMacro,
    buyMarketCard,
    consumeMacro,
    endRun,
    enterNode,
    grantMacro,
    recruitIntoParty,
    sellRunCard,
    setRun,
    startRun,
} from './runSlice';
import uiReducer from './uiSlice';
import { createRunLogMiddleware, currentRunLog, logRunEvent, resetRunLogRecorder } from './runLogMiddleware';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { readRunLogs, type IRunEvent } from '../../engine/run/runLog';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IBattleSetup } from '../../engine/data/battleFactories';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

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

const SETUP: IBattleSetup = { party: [KRAKEN], deck: ['water_slap'], drivers: [], persistedHp: {} };

function makeRun(): IRunState {
    return createRun({
        seed: 'run-log-seed',
        offer: offerGyms('run-log-offer')[0],
        party: [KRAKEN],
        startedAt: 5000,
    });
}

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false })
            .concat(createRunLogMiddleware(readRunLogs)),
    });
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
    resetRunLogRecorder();
});

afterEach(() => {
    resetSaveStorage();
});

/** Every row's kind, in order. */
const kinds = (): string[] => (currentRunLog()?.events ?? []).map((event) => event.kind);
const rowsOf = <K extends IRunEvent['kind']>(kind: K): IRunEvent[] =>
    (currentRunLog()?.events ?? []).filter((event) => event.kind === kind);

/** Walk a run through everything the log claims to cover. */
function playARun(store: ReturnType<typeof makeStore>): IRunState {
    const run = makeRun();
    store.dispatch(startRun(run));

    const next = run.nodes.find((node) => node.id !== run.currentNodeId)!;
    store.dispatch(enterNode(next.id));

    store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));
    store.dispatch(setBattleState(null));

    // Enough to afford everything below. A refused purchase moves no scrap and so logs no SCRAP
    // row, which would make this fixture quietly test less than it looks like it does.
    store.dispatch(addRunScrap(200));
    store.dispatch(buyMarketCard({
        card: { instanceId: 'bought_1', dataId: 'hydro_blast', ownerId: null }, price: 25,
    }));

    const sold = store.getState().run.run!.deck[0];
    store.dispatch(sellRunCard({ instanceId: sold.instanceId, price: 5 }));

    store.dispatch(recruitIntoParty({
        memberId: 'mm2',
        cards: [{ instanceId: 'r1', dataId: 'nettle_sting', ownerId: 'mm2' }],
        price: 25,
    }));

    store.dispatch(grantMacro('surge'));
    store.dispatch(consumeMacro(0));
    store.dispatch(buyMacro({ macroId: 'mend', price: 32 }));

    store.dispatch(swapOS({ id: 'mm1', targetOS: 'kraken_v2' }));

    store.dispatch(logRunEvent({ kind: 'CARD_PICKED', dataId: 'whirlpool', offered: ['a', 'b', 'c'] }));
    store.dispatch(logRunEvent({ kind: 'CARD_SKIPPED', offered: ['d', 'e', 'f'] }));

    store.dispatch(endRun('victory'));
    return run;
}

describe('the run log middleware, over a whole run', () => {
    it('records every event class the ticket asked for', () => {
        playARun(makeStore());
        const seen = new Set(kinds());
        // The list from ticket 59's deliverable 1, minus nothing. A class missing here means the
        // derivation for it never fires, which is invisible in the panel.
        for (const kind of [
            'RUN_STARTED', 'NODE_ENTERED', 'FIGHT_STARTED', 'FIGHT_ENDED', 'SCRAP',
            'CARD_PICKED', 'CARD_SKIPPED', 'CARD_BOUGHT', 'CARD_REMOVED', 'RECRUITED',
            'REFLASHED', 'MACRO_BOUGHT', 'MACRO_FIRED', 'RUN_ENDED',
        ]) {
            expect(seen, `missing ${kind}`).toContain(kind);
        }
    });

    it('derives a SCRAP row from the state delta, naming the action that caused it', () => {
        /*
         * The property the whole design rests on. Nothing dispatches a scrap event; the middleware
         * notices `run.scrap` moved. That is what makes a sink added next month logged before
         * anyone remembers this file exists.
         */
        playARun(makeStore());
        const scrap = rowsOf('SCRAP') as Array<IRunEvent & { delta: number; reason: string }>;
        const paid = (reason: string): number[] =>
            scrap.filter((row) => row.reason === reason).map((row) => row.delta);

        expect(paid('addRunScrap')).toEqual([200]);
        expect(paid('buyMarketCard')).toEqual([-25]);
        // A SALE PAYS, and the SIGN is the assertion. This line read
        // `paid('removeRunCardForScrap')).toEqual([-20])` while the market's only card verb charged
        // to delete a card; Henry deleted paid removal and repealed the sell ban on 2026-08-26, so
        // the same middleware derivation now has to produce a positive delta from a positive
        // balance change — a sink logged as income, or income logged as a sink, is exactly the kind
        // of error a derived log can make and a hand-written one cannot.
        expect(paid('sellRunCard')).toEqual([5]);
        expect(paid('recruitIntoParty')).toEqual([-25]);
        expect(paid('buyMacro')).toEqual([-32]);
    });

    it('reads each payload by its OWN field names, not by a guess at them', () => {
        // `game/swapOS` takes `{ id, targetOS }`. Reading `{ memberId, osId }` off it — which is
        // what this file caught before it shipped — yields a row saying a reflash happened and
        // refusing to say to whom, which is worse than no row at all.
        playARun(makeStore());
        const reflash = rowsOf('REFLASHED')[0] as IRunEvent & { memberId: string; osId: string };
        expect(reflash.memberId).toBe('mm1');
        expect(reflash.osId).toBe('kraken_v2');

        const recruited = rowsOf('RECRUITED')[0] as IRunEvent & { definitionId: string; cards: string[] };
        expect(recruited.cards).toEqual(['nettle_sting']);

        const bought = rowsOf('CARD_BOUGHT')[0] as IRunEvent & { dataId: string; price: number };
        expect(bought).toMatchObject({ dataId: 'hydro_blast', price: 25 });
    });

    it('stamps deck size and scrap on EVERY row, so both curves need no joining', () => {
        playARun(makeStore());
        const events = currentRunLog()!.events;
        expect(events.length).toBeGreaterThan(10);
        for (const event of events) {
            expect(typeof event.deckSize).toBe('number');
            expect(typeof event.scrap).toBe('number');
            expect(event.seq).toBeGreaterThan(0);
        }
        // And the deck really moves across the run — a stamp that never changed would satisfy the
        // loop above and answer nothing.
        const sizes = new Set(events.map((event) => event.deckSize));
        expect(sizes.size).toBeGreaterThan(1);
    });

    it('closes a fight from the battle it is losing, not from the run', () => {
        // FIGHT_ENDED reads the PRE-dispatch board, because by the time `battle` is null the turn
        // count and the party's HP are gone. A row that read post-state would report an empty fight.
        playARun(makeStore());
        const ended = rowsOf('FIGHT_ENDED')[0] as IRunEvent & { partyHp: Record<string, number>; turns: number };
        expect(ended).toBeTruthy();
        expect(Object.keys(ended.partyHp)).toContain('mm1');
        expect(ended.turns).toBeGreaterThan(0);
    });

    it('survives a reload — it RESUMES the transcript rather than starting a second one', async () => {
        /*
         * `setRun` fires on every boot with a run in progress. Starting fresh there would split one
         * run's transcript across as many logs as the player had sessions — and because
         * `writeRunLog` replaces by runKey, the earlier half would be overwritten, not merely
         * separated. The reload is simulated the honest way: a second store over the same storage.
         */
        const first = makeStore();
        const run = makeRun();
        first.dispatch(startRun(run));
        first.dispatch(addRunScrap(10));
        await Promise.resolve();          // let the coalesced write land
        const before = currentRunLog()!.events.length;
        expect(before).toBeGreaterThan(0);

        resetRunLogRecorder();
        const second = makeStore();
        second.dispatch(setRun(first.getState().run.run!));
        second.dispatch(addRunScrap(5));

        const after = currentRunLog()!;
        expect(after.runKey).toBe(`${run.seed}@${run.startedAt}`);
        expect(after.events.length).toBeGreaterThan(before);
        // One RUN_STARTED, not two — the resumed transcript keeps the original opening row.
        expect(after.events.filter((event) => event.kind === 'RUN_STARTED')).toHaveLength(1);
        // And seq did not restart, so the rows still sort into one order.
        expect(after.events[after.events.length - 1].seq).toBe(after.events.length);
    });

    it('writes through to storage, and writes the ended run immediately', () => {
        // Every other write is coalesced onto a microtask; RUN_ENDED is not, because the next thing
        // that happens may be teardown, a reload, or the player closing the game.
        playARun(makeStore());
        const stored = readRunLogs();
        expect(stored).toHaveLength(1);
        expect(stored[0].events.some((event) => event.kind === 'RUN_ENDED')).toBe(true);
    });

    it('never lets a logging failure break a dispatch', () => {
        // Instrumentation may not cost the player a purchase. A full quota is the realistic case.
        setSaveStorage({
            read: () => null,
            write: () => { throw new Error('quota'); },
            remove: () => {},
            keys: () => [],
        });
        const store = makeStore();
        expect(() => playARun(store)).not.toThrow();
        // The game state is exactly what it would have been with no logging at all.
        expect(store.getState().run.run?.outcome).toBe('victory');
    });

    it('is actually WIRED INTO the production store, not just wired correctly in this file', async () => {
        /*
         * Every other case here builds its own store, which is right — they test the middleware.
         * But that leaves the failure this whole ticket is most exposed to completely uncovered:
         * a middleware that works perfectly and is not in the chain. The log would be empty, the
         * panel would say "no runs recorded yet", and nothing would look broken.
         *
         * Imported dynamically so the memory storage installed in `beforeEach` is in place before
         * `store.ts` attaches its autosave subscription at module scope.
         */
        const { store } = await import('./store');
        store.dispatch(startRun(makeRun()));
        expect(currentRunLog()?.events.some((event) => event.kind === 'RUN_STARTED')).toBe(true);
    });

    it('logs nothing at all before a run exists', () => {
        const store = makeStore();
        store.dispatch(addRunScrap(10));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));
        expect(currentRunLog()).toBeNull();
        expect(readRunLogs()).toEqual([]);
    });
});
