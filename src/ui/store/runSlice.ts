/**
 * The run in progress — ticket 09 (steam-release map).
 *
 * # WHY THIS IS A SEPARATE SLICE
 *
 * Ticket 06 drew the line and ticket 23 built the storage for it: the **ranch** persists and a
 * **run** does not. They are written to two different storage keys precisely so a corrupt run costs
 * a run and never a blueprint, and `SaveSystem.saveRun` is already there waiting for something to
 * call it. A single slice holding both would have made that split a lie at the one layer that
 * matters — the autosave subscription, which has to be able to write one key without the other.
 *
 * So: `state.game` is the ranch and everything the pre-roguelike battle path still needs;
 * `state.run` is this, `IRunState | null`. Null is the normal state — you are at the ranch.
 *
 * # WHAT TICKET 11 ADDED
 *
 * The run-scoped economy. `scrap`, the deck and the drivers used to be fields on the pre-roguelike
 * `IPlayerSave` with reducers on the game slice (`addScrap`, `addCardsToInventory`, `addRelic`, …).
 * Ticket 06 rules all three run-scoped — "if a field is in `IRunState`, it cannot inflate the next
 * run" — so they moved here with the fields. The reducers keep the game slice's
 * **silent-no-op-on-invalid** convention: a reducer has no error channel, and the screens check
 * affordability before dispatching.
 *
 * # WHAT TICKET 11 PART 2 ADDED
 *
 * Travel that actually fires: `enterNode` and `resolveEncounter`. They are reducers rather than a
 * spread inside `RunScreen`'s click handler for the reason this file's header already gives — a
 * component that edits `IRunState` in place is a component that owns the save shape — and because
 * the entry rule is the one piece of ticket 07 that has to be provably right: `enterNode` is where
 * "entering a node triggers it again, always" either happens or quietly does not.
 *
 * # WHAT IS DELIBERATELY NOT HERE YET
 *
 * Rewards beyond the economy reducers, and the gauntlet: tickets 13 through 19. **Gauntlet progress
 * in particular is untouched** — `IRunState.gauntlet` is carried and persisted, but nothing here
 * advances it, because ticket 18 owns the gauntlet refit and half-moving it would leave two
 * partial implementations to reconcile. Every later ticket adds reducers here rather than reaching
 * into `IRunState` from a component.
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import { isFightNode } from '../../engine/run/encounter';
import type { IRegionNode, IRunCard, IRunState, RunOutcome } from '../../engine/runTypes';

export interface RunSliceState {
    /** Null means no run in progress — the player is at the ranch. */
    run: IRunState | null;
}

const initialState: RunSliceState = { run: null };

const runSlice = createSlice({
    name: 'run',
    initialState,
    reducers: {
        // Every reducer here REPLACES rather than mutates. `IRunState` is deeply readonly by
        // design — it is the ratified save shape and nothing should be editing it in place — and
        // immer's draft type refuses a readonly array assignment, which is the type system telling
        // the truth rather than getting in the way. Later tickets that need to change one field
        // should spread, not reach in.

        /** Begin a run. `engine/run/createRun.ts` builds the state; this only installs it. */
        startRun: (_state, action: PayloadAction<IRunState>): RunSliceState => ({ run: action.payload }),

        /**
         * Rehydrate from storage, or clear. Distinct from `startRun` only in intent — this is what
         * `App`'s load effect and the debug tools call, and keeping the two named apart means a
         * reducer log reads as a story rather than a shrug.
         */
        setRun: (_state, action: PayloadAction<IRunState | null>): RunSliceState => ({ run: action.payload }),

        /**
         * Mark the run finished. Does NOT clear it: ticket 19 owns the run-summary screen, which
         * has to read the corpse — fights resolved, what was banked, how it ended. `clearRun` is
         * the separate step that throws it away, and the autosave arm removes the storage key when
         * it does.
         */
        endRun: (state, action: PayloadAction<RunOutcome>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            return { run: { ...run, phase: 'ended', outcome: action.payload } };
        },

        /** Throw the run away and go back to the ranch. Removes the run save key. */
        clearRun: (): RunSliceState => ({ run: null }),

        // --- Travel and the node trigger (ticket 11, part 2) ---

        /**
         * Walk to a node and TRIGGER it. Ticket 07, RULED:
         *
         * > "Entering a node triggers it again, always. Wilds re-fight (full rewards — farming is
         * > fine), markets and workshops can be revisited at the price of re-fighting the wilds on
         * > the way. Edges are walkable in both directions."
         *
         * Three things happen here and they are one action on purpose, because a run that has moved
         * but not incremented — or incremented but not changed phase — is a run in a state no rule
         * describes:
         *
         * 1. `currentNodeId` moves.
         * 2. The destination's `visited` count goes up. It is a **count and not a flag** so that
         *    `encounterSeed` can roll a different fight on the second visit; the count that
         *    identifies this entry is therefore the one *after* the increment, which is why the
         *    increment must land before anything reads it.
         * 3. The phase becomes `'encounter'` for a fight kind and stays `'map'` otherwise, which is
         *    what tells `RunScreen` to start a battle. Phase — rather than a component-local flag —
         *    because it is already persisted: an app close between walking onto a wild and finishing
         *    it resumes into the same fight, re-rolled identically from the same seed.
         *
         * Adjacency is not checked. `RegionMap` only offers reachable nodes, and a reducer has no
         * error channel to refuse through — the silent-no-op convention would turn a bad dispatch
         * into a dead button rather than a visible bug. An id naming no node is a no-op.
         */
        enterNode: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };

            const target = run.nodes.find((node) => node.id === action.payload);
            if (!target) return { run };

            const nodes: IRegionNode[] = run.nodes.map((node) => (
                node.id === target.id ? { ...node, visited: node.visited + 1 } : node
            ));

            return {
                run: {
                    ...run,
                    currentNodeId: target.id,
                    nodes,
                    phase: isFightNode(target.kind) ? 'encounter' : 'map',
                },
            };
        },

        /**
         * A fight ended in a win: back to the map, one more fight on the tally.
         *
         * `fightsResolved` counts what actually happened rather than what the route implies — a
         * farmed wild is a resolved fight, and `exploration-map.md`'s 8–10 battle target is a target
         * the player is allowed to exceed. Ticket 25's playtest reads this number to find out
         * whether the 35–45 minute run holds, so counting only "new" nodes would flatter it.
         *
         * A loss does not come through here. Defeat ends the run (`endRun('defeat')`), and a fight
         * that killed you is not a fight you resolved.
         */
        resolveEncounter: (state): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            return { run: { ...run, phase: 'map', fightsResolved: run.fightsResolved + 1 } };
        },

        // --- Run-scoped economy (ticket 11) ---

        /**
         * Bank scrap won in the run. Was `gameSlice.addScrap`, which credited a persistent
         * `scrapCount`; `economy-session.md`'s anti-mudflation line is the whole reason it moved —
         * scrap the player can carry home makes the first marketplace of the *next* run a function
         * of the last one.
         *
         * Negative and fractional amounts are refused rather than clamped: `RunStateSchema` types
         * `scrap` as a non-negative integer, so writing one would fail the run's own save.
         */
        addRunScrap: (state, action: PayloadAction<number>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (!Number.isInteger(action.payload) || action.payload < 0) return { run };
            return { run: { ...run, scrap: run.scrap + action.payload } };
        },

        /** Spend scrap. Silent no-op when the run cannot afford it — never goes negative. */
        spendRunScrap: (state, action: PayloadAction<number>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (!Number.isInteger(action.payload) || action.payload < 0) return { run };
            if (run.scrap < action.payload) return { run };
            return { run: { ...run, scrap: run.scrap - action.payload } };
        },

        /**
         * Add cards to the shared run deck — a reward claim, a marketplace purchase, a recruit's
         * kit. `IRunCard` carries its `dataId` directly, so there is no inventory to add to first:
         * the deck *is* the collection for the length of the run (`economy-session.md`, bite two).
         */
        addRunCards: (state, action: PayloadAction<ReadonlyArray<IRunCard>>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (action.payload.length === 0) return { run };
            return { run: { ...run, deck: [...run.deck, ...action.payload] } };
        },

        /** Remove one card by instance id — card removal at a marketplace. No-op if absent. */
        removeRunCard: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const deck = run.deck.filter((card) => card.instanceId !== action.payload);
            if (deck.length === run.deck.length) return { run };
            return { run: { ...run, deck } };
        },

        /**
         * Win a driver — the party-wide passive an elite pays out (`macros-and-drivers.md`). Was
         * `gameSlice.addRelic`; the rename is ticket 16's vocabulary, and the move is ticket 06's
         * ruling that a run's passives die with the run.
         *
         * **Dedupes.** Drivers are not currency: a second copy of the same passive is not a second
         * effect, and `createBattleState` applies the list once per entry, so a duplicate would
         * silently double a bonus.
         */
        addDriver: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (run.drivers.includes(action.payload)) return { run };
            return { run: { ...run, drivers: [...run.drivers, action.payload] } };
        },
    },
});

export const {
    startRun,
    setRun,
    endRun,
    clearRun,
    enterNode,
    resolveEncounter,
    addRunScrap,
    spendRunScrap,
    addRunCards,
    removeRunCard,
    addDriver,
} = runSlice.actions;

export default runSlice.reducer;
