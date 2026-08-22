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
 * # WHAT TICKET 13 ADDED
 *
 * The marketplace's three verbs — buy, sell, paid removal — plus the paid re-roll. They are four
 * reducers rather than compositions of `spendRunScrap` + `addRunCards` because each is one
 * transaction: see the block comment above `buyMarketCard` for ticket 20's atomicity argument, which
 * is the whole reason the affordability check is in here and not only in the screen.
 *
 * # WHAT TICKET 14 ADDED
 *
 * `recruitIntoParty` — the run half of a mid-run recruit. It is the only reducer in the file that
 * grows `partyIds`, because ticket 06 rules the party grows **at a workshop and only there**, and it
 * is the only one that spends scrap and adds cards *and* changes the party in one action, because
 * all three are one transaction.
 *
 * **It is half of a two-slice write, and the other half is `gameSlice.assembleMingming`.** No
 * reducer can touch two slices, so ticket 11's reward claim split its dispatch and this does the
 * same; the block comment above `recruitIntoParty` argues the ordering, which is the part that has
 * to be right.
 *
 * # WHAT IS DELIBERATELY NOT HERE YET
 *
 * Rewards beyond the economy reducers, and the gauntlet: tickets 15 through 19. **Gauntlet progress
 * in particular is untouched** — `IRunState.gauntlet` is carried and persisted, but nothing here
 * advances it, because ticket 18 owns the gauntlet refit and half-moving it would leave two
 * partial implementations to reconcile. Every later ticket adds reducers here rather than reaching
 * into `IRunState` from a component.
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import { isFightNode } from '../../engine/run/encounter';
import { isMarketNode } from '../../engine/run/marketplace';
import { PARTY_SIZE } from '../../engine/party';
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

        // --- The marketplace's three verbs, plus the reroll (ticket 13) ---
        //
        // **Each one is a single action, and that is the whole point of them being here.** Ticket
        // 20's atomicity argument: a check that lives only in a component is a check that races.
        // Buying is "scrap goes down AND a card arrives" — dispatched as `spendRunScrap` followed by
        // `addRunCards` it is two states, and the one in between (paid, nothing bought) is a state
        // no rule describes and any interleaved dispatch, remount or autosave can observe. The
        // affordability test therefore lives in the same reducer as the mutation it guards, and the
        // screen's own check is a courtesy to the player rather than the enforcement.
        //
        // All four keep the slice's silent-no-op-on-invalid convention: a reducer has no error
        // channel, so an unaffordable purchase changes nothing at all.

        /**
         * Buy a card from a market's stock. Refused — silently, entirely — when the price is not a
         * non-negative integer, when the run cannot afford it, or when the deck **already holds a
         * card with this instance id**.
         *
         * That last clause is what makes a stock a stock. `rollMarketStock` mints each offer's
         * instance id deterministically from the run seed, so "already bought" is derivable from the
         * deck and survives an app close without `IRunState` growing a field (ticket 06's shape is
         * ratified; ticket 13 does not touch it). It is also a correctness guard rather than only an
         * economy one: two deck cards sharing an instance id would both disappear on the first
         * `removeRunCard`, and `sellRunCard`'s "one specific instance" promise would be a lie.
         */
        buyMarketCard: (state, action: PayloadAction<{ card: IRunCard; price: number }>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { card, price } = action.payload;
            if (!Number.isInteger(price) || price < 0) return { run };
            if (run.scrap < price) return { run };
            if (run.deck.some((held) => held.instanceId === card.instanceId)) return { run };
            return { run: { ...run, scrap: run.scrap - price, deck: [...run.deck, card] } };
        },

        /**
         * Sell one card out of the run deck.
         *
         * **By `instanceId`, never by `dataId`.** A deck routinely holds several copies of one card
         * — the tuned lists run doubles and `startDeckFor` deals three identical generics — and
         * "sell a `water_slap`" would leave the player unable to say *which* one, which matters the
         * moment `ownerId` means anything (it is the departure bookkeeping `runTypes.ts` describes).
         * Selling a card that is not in the deck is a no-op and pays nothing, so a double-dispatched
         * click cannot mint scrap.
         */
        sellRunCard: (state, action: PayloadAction<{ instanceId: string; price: number }>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { instanceId, price } = action.payload;
            if (!Number.isInteger(price) || price < 0) return { run };
            const deck = run.deck.filter((card) => card.instanceId !== instanceId);
            if (deck.length === run.deck.length) return { run };
            return { run: { ...run, scrap: run.scrap + price, deck } };
        },

        /**
         * Pay to remove one card — `economy-session.md`'s designer-added sink, and by Henry's
         * 2026-08-21 amendment the answer to the generic filler.
         *
         * Distinct from `removeRunCard` (which is free and has no price to check) because this one
         * has to be atomic with the payment: charging for a removal that did not happen, or removing
         * for free, are both reachable if the two halves are two dispatches. A card that is not in
         * the deck costs nothing.
         */
        removeRunCardForScrap: (state, action: PayloadAction<{ instanceId: string; price: number }>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { instanceId, price } = action.payload;
            if (!Number.isInteger(price) || price < 0) return { run };
            if (run.scrap < price) return { run };
            const deck = run.deck.filter((card) => card.instanceId !== instanceId);
            if (deck.length === run.deck.length) return { run };
            return { run: { ...run, scrap: run.scrap - price, deck } };
        },

        /**
         * Pay to re-roll a market's stock.
         *
         * **Implemented as a paid re-entry: it increments the node's `visited` count.** The stock is
         * a pure function of (run seed, node id, visit count) exactly as an encounter is (ticket 07),
         * so bumping the count is not a trick — it buys precisely what walking away and walking back
         * would buy, minus the wilds re-fought on the way. Henry's amendment blesses the walk
         * (*"revisiting a market is allowed... stock re-rolls per visit"*); this is the same thing
         * priced in scrap, and it needs no field that `IRunState` does not already have.
         *
         * **Gated on the node actually being a marketplace**, which is the one place this slice
         * checks a node's kind before mutating it. A stray dispatch naming a wild would otherwise
         * increment *that* node's visit count and silently re-roll a fight the player is standing in.
         */
        rerollMarketStock: (state, action: PayloadAction<{ nodeId: string; price: number }>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { nodeId, price } = action.payload;
            if (!Number.isInteger(price) || price < 0) return { run };
            if (run.scrap < price) return { run };

            const target = run.nodes.find((node) => node.id === nodeId);
            if (!target || !isMarketNode(target.kind)) return { run };

            const nodes: IRegionNode[] = run.nodes.map((node) => (
                node.id === target.id ? { ...node, visited: node.visited + 1 } : node
            ));
            return { run: { ...run, scrap: run.scrap - price, nodes } };
        },

        // --- The workshop's run half (ticket 14) ---

        /**
         * A recruit joins the party: **scrap is spent, `partyIds` grows by one, and the recruit's
         * kit merges into the shared deck**, in one action.
         *
         * # THIS IS HALF A TRANSACTION, AND THE OTHER HALF IS ON THE RANCH
         *
         * A mid-run assembly writes both slices: the blueprint is spent and the individual is added
         * to `ranch.roster` (`gameSlice.assembleMingming`, itself atomic), and everything above
         * happens here. No reducer can write two slices, so — exactly as ticket 11's reward claim
         * did — the dispatch is split, and the only decision left is **which half goes first**.
         *
         * **THE RANCH GOES FIRST.** Work out what each ordering leaves behind if the app dies in
         * between:
         *
         * - **Ranch first, then this.** The intermediate state is: a blueprint spent, an individual
         *   on the roster, no scrap taken, the party unchanged. That is *the ranch transaction,
         *   exactly* — the trade `RanchScreen`'s assembly bay makes for free. The player keeps the
         *   individual permanently and can field it at the start of the next run. Nothing is
         *   inconsistent and nothing needs repairing; they simply did not get it into *this* party,
         *   and were not charged for that.
         * - **This first, then the ranch.** The intermediate state is: scrap spent, cards in the
         *   deck owned by nobody, and a `partyIds` entry naming a roster member that does not exist.
         *   That is not a shortfall, it is a **torn save**: `reconcileLoadedState` is *required* to
         *   discard it (`party-references-missing-member`), so the player loses the whole run —
         *   forty minutes — rather than 75 scrap.
         *
         * A lost blueprint is a loss; a member with no blueprint behind it is a duplicate the game
         * cannot describe. Ranch-first pays the first and makes the second unrepresentable, so the
         * ordering is not a preference, it is the one that fails least badly. `WorkshopNode` also
         * **verifies the ranch half committed before dispatching this one** — the single cross-slice
         * check no reducer can make, made in the only place that can see both.
         *
         * # WHAT THIS REDUCER CAN AND CANNOT ENFORCE
         *
         * Ticket 20's argument stands: a check that lives only in a component is a check that races,
         * so everything the *run* can see is checked here rather than only at the button —
         * affordability, the party ceiling, a party id already held, and a card instance id already
         * in the deck. Refusals are silent and leave the run **byte-identical**, the slice's standing
         * convention.
         *
         * What it cannot check is the **species clause**, because species live on the roster and the
         * roster is the other slice. That law is enforced where it can be: `workshop.planRecruit`
         * refuses before either dispatch (so an illegal recruit produces no action at all), and
         * `reconcileLoadedState` refuses again at load. Duplicate *ids* — the one form of it visible
         * from here — are refused below.
         */
        recruitIntoParty: (
            state,
            action: PayloadAction<{ memberId: string; cards: ReadonlyArray<IRunCard>; price: number }>,
        ): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { memberId, cards, price } = action.payload;

            if (!Number.isInteger(price) || price < 0) return { run };
            if (run.scrap < price) return { run };
            // `vision.md`'s 3v3 ceiling, and the reason the run half has to know about it at all: a
            // fourth member would be refused by nothing else until the next load.
            if (run.partyIds.length >= PARTY_SIZE) return { run };
            // The double-click guard. `planRecruit` mints a member id deterministically from the
            // node seed, so a second click computes the SAME id — and this refuses it, rather than
            // paying twice for one recruit.
            if (run.partyIds.includes(memberId)) return { run };
            // Two deck cards sharing an instance id would both vanish on the first `removeRunCard`,
            // the same correctness guard `buyMarketCard` makes for the same reason.
            const held = new Set(run.deck.map((card) => card.instanceId));
            if (cards.some((card) => held.has(card.instanceId))) return { run };

            return {
                run: {
                    ...run,
                    scrap: run.scrap - price,
                    partyIds: [...run.partyIds, memberId],
                    deck: [...run.deck, ...cards],
                },
            };
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
    buyMarketCard,
    sellRunCard,
    removeRunCardForScrap,
    rerollMarketStock,
    recruitIntoParty,
    addDriver,
} = runSlice.actions;

export default runSlice.reducer;
