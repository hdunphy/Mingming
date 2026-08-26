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
 * The marketplace's verbs — buy and paid removal — plus the paid re-roll. They are three reducers
 * rather than compositions of `spendRunScrap` + `addRunCards` because each is one transaction: see
 * the block comment above `buyMarketCard` for ticket 20's atomicity argument, which is the whole
 * reason the affordability check is in here and not only in the screen.
 *
 * **`sellRunCard` shipped in ticket 13, was deleted by ticket 57, and is back (2026-08-26).** The
 * ticket-56 ban was right for the game it was ruled against — when the only way to shrink a deck
 * was to pay, selling was being paid for the shrinking you already had to do. The run collection
 * deleted that shape: editing is free, so a sale is what you do with a card you will never play
 * rather than a rebate on housekeeping. `removeRunCardForScrap` went the other way in the same
 * pass; the two verbs traded places.
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
 * # WHAT TICKET 18 ADDED
 *
 * The gauntlet: `beginGauntlet`, `advanceGauntlet`, `reviveGauntletMember` and `finishGauntlet` —
 * the four reducers that drive `IGauntletProgress`. They are the **only** writers of `persistedHp`
 * anywhere in the codebase, and that is a property worth stating rather than discovering: outside a
 * gauntlet a full heal is true by construction, because there is nowhere else in `IRunState` to put
 * an HP number (`encounter.test.ts` asserts exactly that, and ticket 11's own note says why).
 *
 * # WHAT TICKET 19 ADDED
 *
 * `recordBankedBlueprint` — one line in a ledger, and nothing else. The run end needed to be able to
 * say *which* blueprints came from this run, and the ranch cannot answer that (its counts have no
 * provenance). Everything else ticket 19 does happens outside a reducer, because it spans both
 * slices and storage: see `ui/store/runTeardown.ts`, which is the single path all three endings take.
 *
 * # WHAT IS DELIBERATELY NOT HERE YET
 *
 * Events (ticket 30) and the codex proper (ticket 31). Every later ticket adds reducers here rather
 * than reaching into `IRunState` from a component.
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import { isFightNode } from '../../engine/run/encounter';
import { GAUNTLET_FIGHTS } from '../../engine/run/gauntlet';
import { isMarketNode } from '../../engine/run/marketplace';
import { REGION_PARAMS } from '../../engine/run/regionGraph';
import {
    biomeRevealModifier,
    firstFreeMacroSlot,
    getMacro,
    isBiomeRevealed,
    macroRackBlockFor,
} from '../../engine/data/macroRegistry';
import { PARTY_SIZE } from '../../engine/party';
import { minimumActiveDeck } from '../../engine/run/createRun';
import { blueprintBankedModifier } from '../../engine/run/runSummary';
import { MACRO_SLOTS } from '../../engine/runTypes';
import type { IRegionNode, IRunCard, IRunState, MacroSlots, RunOutcome } from '../../engine/runTypes';

/**
 * Rebuild the three-slot macro rack with one slot changed.
 *
 * `MacroSlots` is a ratified fixed-length tuple, so `macros.map(...)` produces a plain array the
 * type refuses — and casting it back would be overruling the type rather than satisfying it. Writing
 * the rebuild once, here, is what keeps every macro reducer below honest about the rack's shape:
 * change `MACRO_SLOTS` and this is the single line that has to change with it.
 */
function withMacroSlot(macros: MacroSlots, slot: number, value: string | null): MacroSlots {
    return [
        slot === 0 ? value : macros[0],
        slot === 1 ? value : macros[1],
        slot === 2 ? value : macros[2],
    ];
}

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
         *
         * # THE BIOME BOUNDARY IS RAISED HERE — TICKET 61 §3
         *
         * *"I think after defeating the elite that gates the next biome you should be able to manage
         * your deck and team."* The gate is the exit-layer elite, so the moment it resolves is the
         * moment the offer is owed, and `boundaryBiome` is where the run records that it owes it.
         *
         * **Written here rather than watched for by a screen** for the reason `phase` is: an app
         * close between the elite dying and the modal being answered must resume with the offer
         * still open. A component effect keyed on "did `fightsResolved` just go up on an elite?"
         * cannot survive a reload, and would fire twice under `StrictMode`.
         *
         * The gym is not a boundary: it is biome 3's exit and there is no fourth biome to prepare
         * for, which the `biomeIndex + 1 < biomes.length` clause covers without naming the kind. A
         * re-fought elite raises it again, deliberately — walking back over a gate is walking over
         * the gate, and ticket 07 makes that re-entry legal and re-rolled.
         */
        resolveEncounter: (state): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };

            const here = run.nodes.find((node) => node.id === run.currentNodeId);
            const gate = here !== undefined
                && here.kind === 'elite'
                && here.layer === REGION_PARAMS.layersPerBiome - 1
                && here.biomeIndex + 1 < run.biomes.length;

            return {
                run: {
                    ...run,
                    phase: 'map',
                    fightsResolved: run.fightsResolved + 1,
                    ...(gate ? { boundaryBiome: here!.biomeIndex + 1 } : {}),
                },
            };
        },

        /**
         * The player answered the boundary alert — with IGNORE or with EDIT, it makes no difference
         * here. The offer was to open the editor; opening it is `RunScreen`'s business, and clearing
         * the debt is this.
         *
         * One reducer for both buttons rather than two named after them, because a reducer named
         * `ignoreBoundary` would invite a future ticket to make ignoring mean something. It does not
         * — ticket 62: *"an alert offers the edit screen; player accepts or ignores"*, and an alert
         * with a real IGNORE is an offer rather than a toll.
         */
        dismissBoundaryAlert: (state): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (run.boundaryBiome === undefined) return { run };
            const { boundaryBiome: _cleared, ...rest } = run;
            return { run: rest };
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
         * Add cards to the shared run deck — a reward claim taken to the deck, a marketplace
         * purchase, a recruit's kit. `IRunCard` carries its `dataId` directly, so there is no
         * inventory to add to first.
         *
         * The old note here read *"the deck IS the collection for the length of the run"*. That
         * stopped being true on 2026-08-26: there is a real collection now, and `addRunCollection`
         * below is where a card goes when the player wants to own it without playing it.
         */
        addRunCards: (state, action: PayloadAction<ReadonlyArray<IRunCard>>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (action.payload.length === 0) return { run };
            return { run: { ...run, deck: [...run.deck, ...action.payload] } };
        },

        /**
         * Add cards to the run COLLECTION — ticket 61 §2's other half of a reward pick.
         *
         * *"Each taken pick offers per-card: ADD TO ACTIVE DECK, or STORE in the run collection."*
         * This is STORE. It exists because the alternative Henry described from the playtest was
         * the whole problem: *"it was too hard to build a good deck... deck bloat became a massive
         * problem"*, and a pick that could only go into the live deck made taking a card and
         * diluting a deck the same act. Now they are two acts, and only one of them costs anything.
         *
         * Separate from `addRunCards` rather than a flag on it, because the two have different
         * invariants and the difference is going to matter: the deck has a floor and a shuffle
         * behind it, the collection has neither. A boolean argument would make the call site the
         * place you find out which.
         */
        addRunCollection: (state, action: PayloadAction<ReadonlyArray<IRunCard>>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (action.payload.length === 0) return { run };
            return { run: { ...run, collection: [...(run.collection ?? []), ...action.payload] } };
        },

        /** Remove one card by instance id — card removal at a marketplace. No-op if absent. */
        removeRunCard: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const deck = run.deck.filter((card) => card.instanceId !== action.payload);
            if (deck.length === run.deck.length) return { run };
            return { run: { ...run, deck } };
        },

        // --- The marketplace's verbs, plus the reroll (ticket 13; ticket 57 cut selling) ---
        //
        // **Each one is a single action, and that is the whole point of them being here.** Ticket
        // 20's atomicity argument: a check that lives only in a component is a check that races.
        // Buying is "scrap goes down AND a card arrives" — dispatched as `spendRunScrap` followed by
        // `addRunCards` it is two states, and the one in between (paid, nothing bought) is a state
        // no rule describes and any interleaved dispatch, remount or autosave can observe. The
        // affordability test therefore lives in the same reducer as the mutation it guards, and the
        // screen's own check is a courtesy to the player rather than the enforcement.
        //
        // All three keep the slice's silent-no-op-on-invalid convention: a reducer has no error
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
         * `removeRunCard`, and the sink's "one specific instance" promise would be a lie.
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
         * THE FOUR EDIT SURFACES' VERBS — ticket 61 §3 (Henry, 2026-08-26).
         *
         * Free, unpriced, and reachable only at a marketplace, a workshop, a biome boundary or the
         * pre-gauntlet screen. The reducers do not know which surface called them — that gating is
         * the screens' job — because a reducer that checked the node kind would have to be taught
         * every new surface, and the list of surfaces is a design decision that moves.
         *
         * **The floor is enforced HERE, not only in the editor.** `minimumActiveDeck(partySize)` is
         * 8 / 13 / 18, and a deck at its floor refuses to shrink. Putting it in the reducer means a
         * screen that forgets to grey a row cannot produce an illegal deck, which is the same
         * argument ticket 20 made for the affordability checks living beside the payment.
         */
        moveCardToCollection: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            // The floor counts the PARTY, so benching a member lowers it in the same edit session.
            if (run.deck.length <= minimumActiveDeck(run.partyIds.length)) return { run };
            const instanceId = action.payload;
            const card = run.deck.find((held) => held.instanceId === instanceId);
            if (!card) return { run };
            return {
                run: {
                    ...run,
                    deck: run.deck.filter((held) => held.instanceId !== instanceId),
                    collection: [...(run.collection ?? []), card],
                },
            };
        },

        /** Collection -> active deck. No ceiling: `DECK_TARGET_MAX` is advice, not a rule. */
        moveCardToDeck: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const instanceId = action.payload;
            const card = (run.collection ?? []).find((held) => held.instanceId === instanceId);
            if (!card) return { run };
            return {
                run: {
                    ...run,
                    deck: [...run.deck, card],
                    collection: (run.collection ?? []).filter((held) => held.instanceId !== instanceId),
                },
            };
        },

        /**
         * Swap a benched member into the party — **and their engines swap with them.**
         *
         * *"Drag a benched mingming onto a party slot to swap — its 5 engine cards follow it."* The
         * card movement is what makes benching a routing decision rather than a loss: the outgoing
         * member's cards go to the collection intact, and come back whole if they are fielded again.
         *
         * Cards are matched by `IRunCard.ownerId`, which `runTypes.ts` calls "write-only bookkeeping
         * against the day a member can leave the party mid-run". This is that day. Cards with a null
         * owner — picks, purchases, the starter's generics — belong to the RUN and never move.
         *
         * Party size does not change, so the deck floor does not change: five out, five in. A swap
         * therefore cannot break the floor no matter how the deck was edited beforehand.
         */
        swapBenchMember: (state, action: PayloadAction<{ outId: string; inId: string }>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { outId, inId } = action.payload;
            const bench = run.bench ?? [];
            if (!run.partyIds.includes(outId) || !bench.includes(inId)) return { run };

            const collection = run.collection ?? [];
            const outgoing = run.deck.filter((card) => card.ownerId === outId);
            const incoming = collection.filter((card) => card.ownerId === inId);

            return {
                run: {
                    ...run,
                    partyIds: run.partyIds.map((id) => (id === outId ? inId : id)),
                    bench: bench.map((id) => (id === inId ? outId : id)),
                    deck: [...run.deck.filter((card) => card.ownerId !== outId), ...incoming],
                    collection: [...collection.filter((card) => card.ownerId !== inId), ...outgoing],
                },
            };
        },

        /**
         * Bench a party member with no one coming back the other way — the party shrinks.
         *
         * Separate from `swapBenchMember` because the floor behaves differently: a party of three
         * becoming two drops the floor from 18 to 13 in the same action that removes five cards, so
         * the deck lands exactly on its new floor rather than under it. A swap can never do that.
         */
        benchPartyMember: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const memberId = action.payload;
            // The last member cannot be benched: a party of nobody cannot fight, and the run has no
            // other way back to a legal state.
            if (!run.partyIds.includes(memberId) || run.partyIds.length <= 1) return { run };
            const leaving = run.deck.filter((card) => card.ownerId === memberId);
            return {
                run: {
                    ...run,
                    partyIds: run.partyIds.filter((id) => id !== memberId),
                    bench: [...(run.bench ?? []), memberId],
                    deck: run.deck.filter((card) => card.ownerId !== memberId),
                    collection: [...(run.collection ?? []), ...leaving],
                },
            };
        },

        /**
         * SELL one card for scrap — from the active deck OR the run collection.
         *
         * Replaces `removeRunCardForScrap`, which charged 20 to take a card out of the deck. That
         * verb is deleted: the collection makes leaving the deck free, so the only card transaction
         * left worth a price is the one that ends in scrap.
         *
         * **Both piles, one verb.** A card you will never play is the same card whether you already
         * moved it out of the deck or not, and a sale that only worked on the active deck would
         * force the player to edit a card back IN to sell it — which is the shape of nonsense the
         * collection exists to remove.
         *
         * Atomic, for the reason `buyMarketCard`'s block gives: paying for a sale that did not
         * happen, or handing over the card without the scrap, are both reachable if the two halves
         * are two dispatches. A card in neither pile earns nothing and changes nothing.
         *
         * **By `instanceId`, never by `dataId`.** A deck routinely holds several copies of one card
         * (the tuned lists run doubles and a starter deals three identical generics), so "sell a
         * `water_slap`" leaves the player unable to say *which* one — which matters the moment
         * `ownerId` means anything (the departure bookkeeping `runTypes.ts` describes).
         *
         * # THE FLOOR APPLIES HERE TOO, AND IT HAS TO BE HERE RATHER THAN ONLY ON THE SHOP
         *
         * Ticket 61 §5 makes the party's own contribution (8/13/18) the minimum active deck, and
         * `moveCardToCollection` refuses to break it. A sale that ignored it would be the same
         * illegal deck reached through the other door — pay 5 scrap and the floor is gone — so this
         * refuses identically. `MarketplaceNode` greys the rows that would break it and the pill
         * above them says why, but a screen that forgets to grey something still must not be able
         * to produce an under-floor deck; same argument ticket 20 made for affordability living
         * beside the payment. **Selling out of the COLLECTION is never floor-blocked**, because the
         * collection is not the deck.
         */
        sellRunCard: (state, action: PayloadAction<{ instanceId: string; price: number }>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { instanceId, price } = action.payload;
            if (!Number.isInteger(price) || price < 0) return { run };

            const fromDeck = run.deck.some((card) => card.instanceId === instanceId);
            if (fromDeck && run.deck.length <= minimumActiveDeck(run.partyIds.length)) return { run };

            const deck = run.deck.filter((card) => card.instanceId !== instanceId);
            const collection = (run.collection ?? []).filter((card) => card.instanceId !== instanceId);
            const soldFromDeck = deck.length !== run.deck.length;
            const soldFromCollection = collection.length !== (run.collection ?? []).length;
            if (!soldFromDeck && !soldFromCollection) return { run };

            return { run: { ...run, scrap: run.scrap + price, deck, collection } };
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
         * A recruit assembled straight onto the BENCH — ticket 65's second assembly button.
         *
         * Same transaction as `recruitIntoParty` and the same ranch-first ordering behind it (see
         * that reducer's block, which argues both at length); the only difference is where the two
         * halves land. The member joins `bench` instead of `partyIds`, and its five engine cards go
         * to the **collection** instead of the deck.
         *
         * # WHY THIS EXISTS AT ALL
         *
         * Ticket 65 ruled that an assembled member's engine goes straight to the active deck. That
         * is right for the member you are going to field, and wrong for the one you are building
         * *for the fire biome two nodes from now* — which is precisely the experiment Henry asked
         * for: *"I want to be able to swap out mingmings from the active roster based on the upcoming
         * biome or challenges. I also want to experiment more."* A bench assembly that shoved five
         * cards into the live deck would tax the experiment with a deck it did not want, and the
         * player would have to walk into the editor and undo half of what they just paid for.
         *
         * **The party ceiling is not checked here**, because the bench is not the party — this is
         * how a full party keeps buying. The species clause still is, but not here: `planRecruit`
         * refuses before either dispatch, and `partyBlockFor` counts party **and** bench, which is
         * the standing rule (map § Notes) that the roster may hold ten krakens and the *team* may
         * field one.
         */
        recruitToBench: (
            state,
            action: PayloadAction<{ memberId: string; cards: ReadonlyArray<IRunCard>; price: number }>,
        ): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { memberId, cards, price } = action.payload;

            if (!Number.isInteger(price) || price < 0) return { run };
            if (run.scrap < price) return { run };
            // The double-click guard, in both piles: `planRecruit` mints a deterministic member id,
            // so a second click computes the SAME id rather than a second recruit.
            if (run.partyIds.includes(memberId)) return { run };
            if ((run.bench ?? []).includes(memberId)) return { run };
            // Two cards sharing an instance id would both vanish on the first move, the same
            // correctness guard `buyMarketCard` and `recruitIntoParty` make for the same reason.
            const held = new Set([...run.deck, ...(run.collection ?? [])].map((card) => card.instanceId));
            if (cards.some((card) => held.has(card.instanceId))) return { run };

            return {
                run: {
                    ...run,
                    scrap: run.scrap - price,
                    bench: [...(run.bench ?? []), memberId],
                    collection: [...(run.collection ?? []), ...cards],
                },
            };
        },

        /**
         * The RUN half of a reflash: the retired engine leaves the deck for the collection, and the
         * new one arrives in the deck. Five out, five in — see `workshop.planReflash` for why a
         * reflash moves cards at all now, and why the count is exactly balanced.
         *
         * # HALF A TRANSACTION AGAIN, AND THE RANCH HALF GOES FIRST
         *
         * `gameSlice.swapOS` spends the blueprint and rewrites `activeOS`; this spends the scrap and
         * rewrites the deck. Ranch-first for `recruitIntoParty`'s reason, sharpened by one detail:
         * the intermediate state here (OS swapped, cards not yet moved) is a member running a
         * firmware whose engine is not in the deck — untidy, but a perfectly loadable run that the
         * player can fix for free in the editor. The reverse order leaves a deck holding an engine
         * for an OS nobody runs, and no blueprint spent to explain it.
         *
         * # WHAT IS RETIRED IS MATCHED BY (owner, dataId), AND ONLY OUT OF THE DECK
         *
         * Not by instance id, because the plan is computed from the registry and cannot know which
         * of three `forage` instances is this member's. Not out of the collection either: a card the
         * player already benched is a card they already decided about, and hauling it back out to
         * "retire" it would move something they did not touch.
         *
         * The consequence, stated because it is a real asymmetry rather than an oversight: a player
         * who has already sold or stored part of the old engine retires fewer than five cards and
         * still receives five, so the deck **grows**. That is correct — the floor is a minimum, not a
         * quota — and it cannot be farmed, because the cards arriving are the ones they now need.
         */
        reflashEngine: (
            state,
            action: PayloadAction<{
                memberId: string;
                retireIds: ReadonlyArray<string>;
                cards: ReadonlyArray<IRunCard>;
                price: number;
            }>,
        ): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { memberId, retireIds, cards, price } = action.payload;

            if (!Number.isInteger(price) || price < 0) return { run };
            if (run.scrap < price) return { run };
            if (!run.partyIds.includes(memberId) && !(run.bench ?? []).includes(memberId)) return { run };
            const held = new Set([...run.deck, ...(run.collection ?? [])].map((card) => card.instanceId));
            if (cards.some((card) => held.has(card.instanceId))) return { run };

            // One instance per retired id, so a five-card engine listing `forage` twice retires two
            // forages and an engine listing it once retires one.
            const budget = new Map<string, number>();
            for (const id of retireIds) budget.set(id, (budget.get(id) ?? 0) + 1);

            const keep: IRunCard[] = [];
            const retired: IRunCard[] = [];
            for (const card of run.deck) {
                const left = budget.get(card.dataId) ?? 0;
                if (card.ownerId === memberId && left > 0) {
                    budget.set(card.dataId, left - 1);
                    retired.push(card);
                } else {
                    keep.push(card);
                }
            }

            return {
                run: {
                    ...run,
                    scrap: run.scrap - price,
                    deck: [...keep, ...cards],
                    collection: [...(run.collection ?? []), ...retired],
                },
            };
        },

        // --- Macros (ticket 15) ---
        //
        // Three fixed slots, single use. `IRunState.macros` is a ratified fixed-length tuple
        // (`MacroSlots`), so every reducer here REBUILDS it as a three-element literal rather than
        // mapping over it — `Array.prototype.map` returns a `(string | null)[]`, which is not
        // assignable to the tuple, and a cast would be the type system being overruled rather than
        // satisfied. `withMacroSlot` below is that rebuild, written once.
        //
        // All four keep the slice's silent-no-op-on-invalid convention. The *reason* a purchase was
        // refused is not produced here — a reducer has no error channel — it comes from
        // `macroRegistry.macroRackBlockFor`, which the screen calls before it dispatches and prints
        // on the dead button. Ticket 15: "a full rack must refuse a purchase with a reason, not
        // silently drop it."

        /**
         * Buy a macro into the first free slot: **scrap goes down and the slot fills, in one
         * action.** Ticket 20's atomicity argument, the same one behind `buyMarketCard`.
         *
         * Refused entirely when the price is not a non-negative integer, when the run cannot afford
         * it, when the id names no macro, or when **the rack is full**. A full rack refusing is the
         * clause with a rule behind it: three slots is the ruled rack size, and a fourth purchase
         * that silently vanished would take the player's scrap for nothing.
         *
         * Note what is deliberately NOT refused: **buying a macro you already hold.** Macros are
         * consumables, not relics — two Surges in two slots is a legal and often correct rack — so
         * there is no dedupe here, unlike `addDriver` where a second copy is a no-op by design.
         */
        buyMacro: (state, action: PayloadAction<{ macroId: string; price: number }>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const { macroId, price } = action.payload;
            if (!Number.isInteger(price) || price < 0) return { run };
            if (run.scrap < price) return { run };
            if (macroRackBlockFor(run.macros, macroId) !== null) return { run };
            const slot = firstFreeMacroSlot(run.macros);
            return { run: { ...run, scrap: run.scrap - price, macros: withMacroSlot(run.macros, slot, macroId) } };
        },

        /**
         * Take a macro for free — an event reward, a drop, a debug grant. Same rack rules, no price.
         *
         * Separate from `buyMacro` rather than `buyMacro({ price: 0 })` because the two have
         * different failure modes worth telling apart in a reducer log, and because a free grant
         * must not be silently refusable by an affordability check that can never fire.
         */
        grantMacro: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const macroId = action.payload;
            if (macroRackBlockFor(run.macros, macroId) !== null) return { run };
            return { run: { ...run, macros: withMacroSlot(run.macros, firstFreeMacroSlot(run.macros), macroId) } };
        },

        /**
         * Spend a slot. **This is what "single-use" means**, and it is a separate dispatch from the
         * battle resolving the macro because no reducer can write two slices — the same split ticket
         * 11's reward claim and ticket 14's recruit both make.
         *
         * **The battle half goes FIRST.** Work out what each ordering leaves behind if the app dies
         * between them: consume-first loses the macro and never fires it; fire-first fires it and
         * leaves the slot full, which the player could fire again. The second is strictly better —
         * the run save is written on a state change either way, and a duplicated macro costs 32
         * scrap of value where a lost one costs the player something they paid for and never got.
         * `BattleArena` also checks `canFireMacro` before either dispatch, so the window is a crash
         * between two synchronous dispatches rather than a real race.
         *
         * An empty slot, or an index outside 0..2, is a no-op.
         */
        consumeMacro: (state, action: PayloadAction<number>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const slot = action.payload;
            if (!Number.isInteger(slot) || slot < 0 || slot >= MACRO_SLOTS) return { run };
            if (run.macros[slot] === null) return { run };
            return { run: { ...run, macros: withMacroSlot(run.macros, slot, null) } };
        },

        /**
         * Fire the map-reveal: **the biome you are standing in is surveyed and the slot is spent**,
         * in one action.
         *
         * Ticket 07's amendment, and Henry's *"items and events that reveal more of the map"* under
         * one-layer visibility. This is the only macro that fires outside a battle, which is why it
         * is a `runSlice` reducer and not a `battleReducer` action — `canFireMacro` refuses it there
         * on purpose.
         *
         * **The reveal is recorded in `modifiers`, not in a new field.** `runTypes.ts` is ratified
         * and this ticket may not widen it; `modifiers` is already a persisted string array whose
         * documented job is "facts about this run that change how it plays", and a permanently
         * lifted fog is one. `macroRegistry.biomeRevealModifier` owns the string shape and
         * `regionLayout` reads it back. See that module for the argument in full.
         *
         * Refused when the slot does not hold the map-reveal (so a mis-click cannot burn a Revive on
         * the map screen) and when the biome is **already surveyed** — a second Ping Sweep on the
         * same biome would spend a consumable for no change at all, and the screen greys it out for
         * the same reason.
         */
        fireMapReveal: (state, action: PayloadAction<number>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const slot = action.payload;
            if (!Number.isInteger(slot) || slot < 0 || slot >= MACRO_SLOTS) return { run };

            const macro = getMacro(run.macros[slot]);
            if (!macro || macro.targeting !== 'MAP') return { run };

            const here = run.nodes.find((node) => node.id === run.currentNodeId);
            if (!here) return { run };
            if (isBiomeRevealed(run, here.biomeIndex)) return { run };

            return {
                run: {
                    ...run,
                    macros: withMacroSlot(run.macros, slot, null),
                    modifiers: [...run.modifiers, biomeRevealModifier(here.biomeIndex)],
                },
            };
        },

        // --- The gauntlet (ticket 18) ---
        //
        // # THE FOUR REDUCERS, AND WHY THE HP LIVES HERE AND NOWHERE ELSE
        //
        // `exploration-map.md`: *"The gym is a GAUNTLET: three fights, NO healing between them"*,
        // against *"FULL HEAL between regular nodes"*. That asymmetry is the whole feature, and it
        // is implemented by omission everywhere except in these four reducers:
        // `IGauntletProgress.persistedHp` is the only place a run stores an HP number, so a fight
        // outside a gauntlet cannot carry damage even by accident (`buildBattleSetup` passes `{}`
        // whenever `run.gauntlet` is null, and `encounter.test.ts` pins it).
        //
        // # STATUSES AND ENERGY DO NOT CARRY — READING, FLAGGED FOR HENRY
        //
        // Ticket 18 asks: *"whether statuses also carry is Henry's call"*. The reading taken here is
        // **HP only**, and it is not a coin toss:
        //
        //  1. `IGauntletProgress` is a RATIFIED type (ticket 06, `runTypes.ts`). It has exactly
        //     `fightIndex`, `totalFights`, `persistedHp` and `downedMemberIds` — there is no field a
        //     status could be written to, and this ticket may not widen it.
        //  2. Its own docblock keeps v3's ruling verbatim: *"only `hp` persists between the three
        //     fights; energy, statuses and everything else reset each fight."* v3's `IGauntletState`
        //     carried the same sentence in the same words, so this is continuity, not a new call.
        //
        // Carrying a Burn between fights would also make Kindle the strongest macro in the game for
        // one fight of the run and dead for the rest, which is a balance decision nobody has taken.
        // If Henry wants statuses to carry, it is a ratified-type change (ticket 06) before it is a
        // reducer change.
        //
        // All four keep the slice's silent-no-op-on-invalid convention, and replace rather than
        // mutate.

        /**
         * Enter the gym: the run stops being a map and becomes three fights.
         *
         * Dispatched by `RunScreen` when the phase the walk produced (`enterNode` sets
         * `'encounter'` for every fight kind, and a gym is one) lands on a `gym` node with no
         * gauntlet in progress. It is a reducer rather than a spread in that effect for this file's
         * standing reason — a component that edits `IRunState` in place is a component that owns the
         * save shape — and because the state it produces is the one an app close has to resume into.
         *
         * **Idempotent, and it has to be.** React runs effects twice under `StrictMode` and the
         * phase it reads is the phase it writes, so a second dispatch must be a no-op rather than a
         * reset of `fightIndex` to 0 — that would be an infinite gauntlet, and it would be
         * discovered by a player rather than by a test.
         *
         * **Gated on the node actually being a gym**, the same guard `rerollMarketStock` makes for
         * the same reason: a stray dispatch on a wild would otherwise put the run into a phase whose
         * screen has no fight behind it.
         */
        beginGauntlet: (state): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (run.gauntlet !== null) return { run };

            const here = run.nodes.find((node) => node.id === run.currentNodeId);
            if (!here || here.kind !== 'gym') return { run };

            return {
                run: {
                    ...run,
                    phase: 'gauntlet',
                    gauntlet: {
                        fightIndex: 0,
                        totalFights: GAUNTLET_FIGHTS,
                        // Nobody is hurt and nobody is down before the first fight. The empty
                        // objects are the "full heal on the way in" that `exploration-map.md` grants
                        // between ordinary nodes — the gauntlet's asymmetry starts after fight one.
                        persistedHp: {},
                        downedMemberIds: [],
                    },
                },
            };
        },

        /**
         * A gauntlet fight was won and it was not the last: **record what the party has left, and
         * move to the next fight.**
         *
         * The payload is the party as the battle left it — one entry per member, HP included, taken
         * off `IBattleState.playerParty` by `BattleArena`. The reducer derives both stored fields
         * from it rather than being told them separately, which is what makes the revive hook work
         * with no special case: a member who was down at the start of this fight and was brought back
         * by a Revive reports positive HP here, so it **leaves `downedMemberIds` and enters
         * `persistedHp`** by the same rule that put it there. Ticket 15's resolution names that as the
         * thing this ticket has to wire, and this is the wire.
         *
         * **Merged onto the previous record, not replacing it.** A member missing from the payload
         * keeps the HP it carried in. That is defensive rather than expected — `buildBattleSetup`
         * fields every party member, downed ones included — but the failure it prevents is the bad
         * one: an omitted member would otherwise silently walk into the next fight at FULL HP, which
         * is the one thing the gauntlet is not allowed to do.
         *
         * HP is floored at 0 and integer-ised because `RunStateSchema` types `persistedHp` as
         * non-negative integers, and a run that cannot save itself is worse than a rounded number.
         *
         * `fightsResolved` goes up here, exactly as `resolveEncounter` does it for a node: a gauntlet
         * fight is a fight the player resolved, and ticket 25 reads that number to find out whether
         * the 35-45 minute run holds. The phase deliberately does NOT go back to `'map'` — there is
         * no walking out of the exam, and `RunScreen` renders the Pit Stop for as long as the phase
         * says `'gauntlet'`.
         *
         * Refused on the last fight: that one is `finishGauntlet`'s, and advancing past it would
         * leave `fightIndex` pointing at a fight that does not exist.
         */
        advanceGauntlet: (
            state,
            action: PayloadAction<ReadonlyArray<{ memberId: string; hp: number }>>,
        ): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const gauntlet = run.gauntlet;
            if (!gauntlet) return { run };
            if (gauntlet.fightIndex >= gauntlet.totalFights - 1) return { run };

            const persistedHp: Record<string, number> = { ...gauntlet.persistedHp };
            const downed = new Set(gauntlet.downedMemberIds);

            for (const entry of action.payload) {
                // Only the party. A battle can contain entities the run does not own (nothing does
                // that today), and writing one into `persistedHp` would leave a key no member
                // matches — harmless until the day something iterates it.
                if (!run.partyIds.includes(entry.memberId)) continue;
                const hp = Number.isFinite(entry.hp) ? Math.max(0, Math.floor(entry.hp)) : 0;
                persistedHp[entry.memberId] = hp;
                if (hp <= 0) downed.add(entry.memberId);
                else downed.delete(entry.memberId);
            }

            return {
                run: {
                    ...run,
                    fightsResolved: run.fightsResolved + 1,
                    gauntlet: {
                        ...gauntlet,
                        fightIndex: gauntlet.fightIndex + 1,
                        persistedHp,
                        downedMemberIds: [...downed],
                    },
                },
            };
        },

        /**
         * A downed member is back on their feet — **the hook, not the policy.**
         *
         * `economy-session.md` rules the outcome and defers the shape: *"Gauntlet death: revivable,
         * never gone-for-gauntlet"*, with the revive's mechanism *"deferred to playtesting"* (ticket
         * 25). Ticket 15 built the first candidate — a rare Revive macro at
         * `REVIVE_PERCENT_MAX_HP`% of max HP — and the second candidate (auto-return at a reduced
         * percentage between fights) reads and writes the same two fields. **This reducer is what
         * both shapes need and neither owns**: whoever decides a member is alive again says so here,
         * and the number they say it with is theirs.
         *
         * **The economy is ticket 25's to settle.** Nothing here prices a revive, limits how many a
         * gauntlet allows, or decides whether one is free between fights. What is fixed is the
         * invariant: a member cannot be both down and alive, so leaving `downedMemberIds` and
         * entering `persistedHp` is one action.
         *
         * Dispatched by `BattleArena` beside `fireMacro`, in the same order and for the same reason
         * `consumeMacro` argues: the battle half first, then the run. If the app dies between them
         * the player has a revived unit in a battle they will re-fight — and re-fight *with* the
         * revive, because this is what the resumed fight rebuilds from.
         *
         * Refused when the member is not currently down (a revive on a living unit is a bug at the
         * call site, exactly as `ReviveExecutor` treats it) and when the HP is not a positive
         * integer — reviving to 0 is not reviving.
         */
        reviveGauntletMember: (
            state,
            action: PayloadAction<{ memberId: string; hp: number }>,
        ): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const gauntlet = run.gauntlet;
            if (!gauntlet) return { run };

            const { memberId, hp } = action.payload;
            if (!Number.isInteger(hp) || hp < 1) return { run };
            if (!gauntlet.downedMemberIds.includes(memberId)) return { run };

            return {
                run: {
                    ...run,
                    gauntlet: {
                        ...gauntlet,
                        persistedHp: { ...gauntlet.persistedHp, [memberId]: hp },
                        downedMemberIds: gauntlet.downedMemberIds.filter((id) => id !== memberId),
                    },
                },
            };
        },

        /**
         * The last fight is won: the gauntlet is over.
         *
         * Clears `IGauntletProgress` and puts the phase back to `'map'`, counting the fight. It does
         * **not** end the run, and that is the same separation `resolveEncounter` keeps: winning the
         * gauntlet is the run's victory condition (`exploration-map.md`: the gym is the only way a
         * run is won), but `endRun('victory')` is the action that says so, and ticket 19 owns what
         * the player sees afterwards. `BattleArena` dispatches both, in that order.
         *
         * The progress object is cleared rather than left at `fightIndex: 3`, because a completed
         * gauntlet is not a gauntlet in progress and `phase: 'gauntlet'` with nothing left to fight
         * is a state no screen describes.
         *
         * Refused unless the run is actually on the last fight — finishing early would skip fights
         * the player never had to win.
         */
        finishGauntlet: (state): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            const gauntlet = run.gauntlet;
            if (!gauntlet) return { run };
            if (gauntlet.fightIndex < gauntlet.totalFights - 1) return { run };

            return {
                run: {
                    ...run,
                    phase: 'map',
                    gauntlet: null,
                    fightsResolved: run.fightsResolved + 1,
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

        // --- The run's blueprint ledger (ticket 19) ---

        /**
         * Note that this run banked a blueprint. **A receipt, not a payment.**
         *
         * Ticket 12 credits the ranch the instant a blueprint drops (`BattleArena`'s banking
         * effect), so that a dead run — or an app closed on the reward screen — still pays forward.
         * This is dispatched beside that credit and does one thing: write the species into the run's
         * own ledger so ticket 19's summary can say *which* blueprints this run produced. The ranch
         * cannot answer that on its own — `IRanchState.blueprints` is a running count with no
         * provenance, and diffing it would need a run-start snapshot nothing stores.
         *
         * **The ledger lives in `modifiers`** (`engine/run/runSummary.blueprintBankedModifier`), for
         * the reason ticket 15's map-reveal lives there: `runTypes.ts` is ratified with no migration
         * path, `modifiers` is an already-persisted string array documented as facts about this run,
         * and a `blueprintsBanked` field would be a save-shape change this ticket may not make.
         *
         * **No dedupe, unlike `addDriver`.** Blueprints are consumable currency and `addBlueprint`
         * stacks the count (ticket 20), so a second kraken blueprint is a second line. Collapsing
         * them would make the summary under-report a run in exactly the direction that annoys a
         * player — telling them they earned less than the ranch actually received.
         *
         * The ordering against `addBlueprint` does not matter and is worth saying so: the ranch
         * credit is the one that must not be lost, and this receipt describes a payment that has
         * already happened either way. A crash between the two costs a line on a summary screen.
         */
        recordBankedBlueprint: (state, action: PayloadAction<string>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            if (action.payload === '') return { run };
            return { run: { ...run, modifiers: [...run.modifiers, blueprintBankedModifier(action.payload)] } };
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
    dismissBoundaryAlert,
    addRunScrap,
    spendRunScrap,
    addRunCards,
    addRunCollection,
    removeRunCard,
    buyMarketCard,
    // `removeRunCardForScrap` was exported here until 2026-08-26. Paid removal is deleted; free
    // editing at the four surfaces replaced it, and `sellRunCard` is the verb that pays.
    sellRunCard,
    moveCardToCollection,
    moveCardToDeck,
    swapBenchMember,
    benchPartyMember,
    rerollMarketStock,
    recruitIntoParty,
    recruitToBench,
    reflashEngine,
    buyMacro,
    grantMacro,
    consumeMacro,
    fireMapReveal,
    beginGauntlet,
    advanceGauntlet,
    reviveGauntletMember,
    finishGauntlet,
    addDriver,
    recordBankedBlueprint,
} = runSlice.actions;

export default runSlice.reducer;
