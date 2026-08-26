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

import runReducer, {
    addDriver,
    addRunCards,
    addRunScrap,
    clearRun,
    endRun,
    enterNode,
    recordBankedBlueprint,
    removeRunCard,
    resolveEncounter,
    setRun,
    spendRunScrap,
    startRun,
    type RunSliceState,
} from './runSlice';
import { bankedBlueprintsFrom } from '../../engine/run/runSummary';
import gameReducer, { addBlueprint, createEmptyRanch } from './gameSlice';
import { STARTING_SCRAP, createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { loadGameState, saveRanch, saveRun } from '../../engine/SaveSystem';
import { getActiveRanchKey, getActiveRunKey } from '../../engine/SaveSlots';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRegionNode, IRunCard, IRunState, NodeKind } from '../../engine/runTypes';

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

/** The same individual as an `IRanchMember` — the roster's shape since ticket 11. */
const RANCH_PARTY: IRanchMember[] = PARTY.map(({ id, definitionId, attackIV, defenseIV, hpIV }) => ({
    id, definitionId, activeOS: 'kraken_v1', attackIV, defenseIV, hpIV,
}));

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

    // --- The blueprint ledger (ticket 19) ---

    it('recordBankedBlueprint writes a receipt into modifiers, keeping duplicates', () => {
        // A receipt, not a payment: ticket 12 already credited the ranch when the blueprint dropped.
        // This is the only record of WHICH blueprints came from this run, and duplicates are
        // meaningful because a blueprint is consumable currency (`addBlueprint` stacks the count).
        let state: RunSliceState = { run: makeRun() };
        state = runReducer(state, recordBankedBlueprint('kraken'));
        state = runReducer(state, recordBankedBlueprint('kraken'));

        expect(bankedBlueprintsFrom(state.run!.modifiers)).toEqual(['kraken', 'kraken']);
    });

    it('recordBankedBlueprint sits beside an existing modifier, and no-ops outside a run', () => {
        // `modifiers` already carries ticket 15's map-reveals; a ledger entry must join them rather
        // than replace them, and a debug battle with no run has nothing to write a ledger into.
        const withReveal: RunSliceState = { run: { ...makeRun(), modifiers: ['reveal:biome:0'] } };
        const state = runReducer(withReveal, recordBankedBlueprint('fenrir'));
        expect(state.run!.modifiers).toEqual(['reveal:biome:0', 'banked:blueprint:fenrir']);

        expect(runReducer({ run: null }, recordBankedBlueprint('fenrir')).run).toBeNull();
    });
});

// ---------------------------------------------------------------------------------------------
// The run-scoped economy (ticket 11)
// ---------------------------------------------------------------------------------------------
//
// These assertions came from `gameSlice.test.ts`, where they were written against `addScrap`,
// `spendScrap` and the card-inventory reducers. The behaviour they pin is unchanged — add, spend
// only what you can afford, never go negative — but the field moved: scrap and cards are
// `IRunState`, because `economy-session.md`'s anti-mudflation rule says a run may not fund the
// next one.

describe('run-scoped scrap', () => {
    // `makeRun` is a real `createRun`, so these balances are no longer counted from zero: since
    // Henry's 2026-08-24 grant a run OPENS holding `STARTING_SCRAP`. Every total below is therefore
    // written as an offset from that constant rather than as a literal — what these four tests are
    // about is the reducer's arithmetic (add, spend only what you can afford, reject junk), not the
    // opening balance, which `createRun.test.ts` pins as a ruled number in its own right.

    it('adds scrap', () => {
        const state = runReducer({ run: makeRun() }, addRunScrap(50));
        expect(state.run?.scrap).toBe(STARTING_SCRAP + 50);
    });

    it('spends scrap if sufficient', () => {
        let state = runReducer({ run: makeRun() }, addRunScrap(100));
        state = runReducer(state, spendRunScrap(30));
        expect(state.run?.scrap).toBe(STARTING_SCRAP + 70);
    });

    it('does not spend scrap if insufficient', () => {
        // Still genuinely insufficient with the opening grant counted in: 20 + 10 = 30, and 50 is
        // more than 30. The whole 50 is refused rather than partially drawn.
        let state = runReducer({ run: makeRun() }, addRunScrap(10));
        state = runReducer(state, spendRunScrap(50));
        expect(state.run?.scrap).toBe(STARTING_SCRAP + 10);
    });

    it('refuses a negative or fractional amount rather than writing an unsavable run', () => {
        // `RunStateSchema` types `scrap` as a non-negative int, so a fractional credit would fail
        // the run's own autosave — silently, on the next dispatch. A refused credit leaves the
        // balance exactly as the run opened, which is now the grant rather than zero.
        let state = runReducer({ run: makeRun() }, addRunScrap(-5));
        expect(state.run?.scrap).toBe(STARTING_SCRAP);
        state = runReducer(state, addRunScrap(2.5));
        expect(state.run?.scrap).toBe(STARTING_SCRAP);
    });

    it('is a no-op with no run in progress', () => {
        expect(runReducer({ run: null }, addRunScrap(10)).run).toBeNull();
        expect(runReducer({ run: null }, spendRunScrap(10)).run).toBeNull();
    });
});

describe('the run deck', () => {
    const card = (instanceId: string, dataId = 'flamethrower'): IRunCard => ({
        instanceId, dataId, ownerId: null,
    });

    it('adds cards to the shared deck', () => {
        const before = makeRun();
        const state = runReducer({ run: before }, addRunCards([card('c1'), card('c2')]));
        expect(state.run?.deck).toHaveLength(before.deck.length + 2);
        expect(state.run?.deck.slice(-2).map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    });

    it('removes a card by instance id', () => {
        let state = runReducer({ run: makeRun() }, addRunCards([card('c1'), card('c2')]));
        const before = state.run!.deck.length;
        state = runReducer(state, removeRunCard('c1'));
        expect(state.run?.deck).toHaveLength(before - 1);
        expect(state.run?.deck.some((c) => c.instanceId === 'c1')).toBe(false);
    });

    it('removing an id that is not in the deck changes nothing', () => {
        const start = { run: makeRun() };
        const state = runReducer(start, removeRunCard('ghost'));
        expect(state.run).toBe(start.run);
    });

    it('carries the dataId directly — there is no inventory to resolve against', () => {
        // The whole reason `IRunCard` exists: the old `activeDeck.cards` held `cardInventory`
        // instance ids, and a deck entry naming a card the inventory had lost resolved to nothing.
        const state = runReducer({ run: makeRun() }, addRunCards([card('c1', 'ink_stream')]));
        expect(state.run?.deck.at(-1)?.dataId).toBe('ink_stream');
    });
});

// ---------------------------------------------------------------------------------------------
// Travel and the node trigger (ticket 11, part 2)
// ---------------------------------------------------------------------------------------------
//
// Ticket 07, RULED: "Entering a node triggers it again, always... contents are rolled at node entry
// from the node's seed + visit count so re-entry re-rolls honestly." `enterNode` is where that is
// either true or quietly not — the failure mode is a reducer that moves the player and forgets one
// of the other two halves, which looks exactly like working software until the second visit.

describe('entering a node', () => {
    const nodeOfKind = (run: IRunState, kind: NodeKind): IRegionNode =>
        run.nodes.find((n) => n.kind === kind && n.id !== run.currentNodeId)!;

    it('walks, counts the visit, and puts the run into an encounter on a fight node', () => {
        const run = makeRun();
        const target = nodeOfKind(run, 'wild');

        const state = runReducer({ run }, enterNode(target.id));

        expect(state.run?.currentNodeId).toBe(target.id);
        expect(state.run?.nodes.find((n) => n.id === target.id)?.visited).toBe(target.visited + 1);
        expect(state.run?.phase).toBe('encounter');
    });

    it('counts every entry, so a re-entry rolls from a higher count', () => {
        const run = makeRun();
        const target = nodeOfKind(run, 'wild');
        const other = run.nodes.find((n) => n.id !== target.id && n.id !== run.currentNodeId)!;

        let state = runReducer({ run }, enterNode(target.id));
        state = runReducer(state, enterNode(other.id));
        state = runReducer(state, enterNode(target.id));

        // Two entries, two counts. `encounterSeed` reads this number, which is the whole reason
        // `visited` is a count and not a flag.
        expect(state.run?.nodes.find((n) => n.id === target.id)?.visited).toBe(target.visited + 2);
    });

    it('leaves the phase on the map for a marketplace or a workshop', () => {
        // Tickets 13, 14 and 30 own the three non-fight kinds. Entering still counts as a visit —
        // the node fired, it just has nothing to do yet — and the run must not sit in
        // `phase: 'encounter'` waiting for a battle nobody is going to start.
        const run = makeRun();
        for (const kind of ['marketplace', 'workshop'] as NodeKind[]) {
            const target = nodeOfKind(run, kind);
            const state = runReducer({ run }, enterNode(target.id));
            expect(state.run?.phase).toBe('map');
            expect(state.run?.nodes.find((n) => n.id === target.id)?.visited).toBe(target.visited + 1);
        }
    });

    it('touches nothing else about the run', () => {
        const run = makeRun();
        const target = nodeOfKind(run, 'wild');
        const state = runReducer({ run }, enterNode(target.id));

        expect(state.run?.deck).toEqual(run.deck);
        expect(state.run?.scrap).toBe(run.scrap);
        expect(state.run?.fightsResolved).toBe(run.fightsResolved);
        // Only the destination's count moved.
        const changed = state.run!.nodes.filter((n, i) => n.visited !== run.nodes[i].visited);
        expect(changed.map((n) => n.id)).toEqual([target.id]);
    });

    it('is a no-op for an id that names no node, and with no run at all', () => {
        const start = { run: makeRun() };
        expect(runReducer(start, enterNode('nowhere')).run).toBe(start.run);
        expect(runReducer({ run: null }, enterNode('b0l0n0')).run).toBeNull();
    });
});

describe('resolving an encounter', () => {
    const firstWild = (run: IRunState): IRegionNode =>
        run.nodes.find((n) => n.kind === 'wild' && n.id !== run.currentNodeId)!;

    it('returns to the map and counts the fight', () => {
        const run = makeRun();
        let state = runReducer({ run }, enterNode(firstWild(run).id));
        state = runReducer(state, resolveEncounter());

        expect(state.run?.phase).toBe('map');
        expect(state.run?.fightsResolved).toBe(1);
    });

    it('counts a farmed re-fight too', () => {
        // "Wilds re-fight (full rewards — farming is fine)", so this counts fights, not nodes —
        // ticket 25 reads it to find out whether the 35-45 minute run holds.
        const run = makeRun();
        const target = firstWild(run);
        let state: RunSliceState = { run };
        for (let i = 0; i < 3; i += 1) {
            state = runReducer(state, enterNode(target.id));
            state = runReducer(state, resolveEncounter());
        }
        expect(state.run?.fightsResolved).toBe(3);
    });

    it('is a no-op with no run in progress', () => {
        expect(runReducer({ run: null }, resolveEncounter()).run).toBeNull();
    });
});

describe('drivers', () => {
    it('adds a driver', () => {
        const state = runReducer({ run: makeRun() }, addDriver('relic_a'));
        expect(state.run?.drivers).toEqual(['relic_a']);
    });

    it('dedupes — a driver is a passive, not currency', () => {
        // `createBattleState` applies the list once per entry, so a duplicate would silently
        // double the bonus.
        let state = runReducer({ run: makeRun() }, addDriver('relic_a'));
        state = runReducer(state, addDriver('relic_a'));
        expect(state.run?.drivers).toEqual(['relic_a']);
    });

    it('is a no-op with no run in progress', () => {
        expect(runReducer({ run: null }, addDriver('relic_a')).run).toBeNull();
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

        saveRanch({ ...createEmptyRanch(), roster: RANCH_PARTY });
        expect(saveRun(walked).success).toBe(true);

        const loaded = loadGameState();
        expect(loaded.discarded).toBeUndefined();
        expect(loaded.run?.seed).toBe(run.seed);
        expect(loaded.run?.currentNodeId).toBe(target.id);
        expect(loaded.run?.fightsResolved).toBe(3);
        expect(loaded.run?.scrap).toBe(42);
        // Ticket 60's opening six for the solo party `makeRun` fields (4 kit + 2 generics), every
        // card back out of storage — a deck that round-trips short is the failure mode here.
        expect(loaded.run?.deck).toHaveLength(6);
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
            if (state.game !== prevGame) { saveRanch(state.game); prevGame = state.game; }
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
