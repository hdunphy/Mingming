/**
 * PROTOTYPE — ticket 06 (steam-release map). NOT WIRED TO ANYTHING YET.
 *
 * What a run IS in state, next to a ranch that persists between runs. Nothing imports this file;
 * it exists for Henry to react to, and [ticket 23](../../docs/wayfinder/steam-release/tickets/23-save-v4.md)
 * lands the ratified version in `SaveSystem.ts` as save v4.
 *
 * THE LINE THIS FILE DRAWS. Everything here is thrown away when a run ends. The only things that
 * survive a run are in `IRanchState` at the bottom: assembled individuals, blueprint counts, the
 * codex, and what tiers/gyms are unlocked. That is the whole anti-mudflation argument from
 * `economy-session.md` expressed as a type — if a field is in `IRunState`, it cannot inflate the
 * next run, and if it is in `IRanchState`, someone has to justify why it can.
 *
 * Sources, in the precedence the HANDOFF gives them: `vision.md`, `exploration-map.md`,
 * `economy-session.md`, `macros-and-drivers.md`. Every non-obvious field below cites the ruling
 * it comes from. Fields marked **[ASSUMED]** are the prototype's guesses on things no session has
 * ruled — they are the agenda for Henry's review, not decisions.
 *
 * ## Henry's rulings, 2026-08-21 (this session)
 *
 * 1. **An in-progress run survives closing the app, and there is ONE run slot.** Steam players
 *    expect to come back to a run; a 35–45 minute run is longer than one sitting.
 * 2. **Ranch and run are stored under SEPARATE KEYS**, written independently — not one blob. The
 *    blast radius of a corrupt run then stops at the run. See `reconcileLoadedState` below, which
 *    is the price of that choice: the cross-object laws move out of the schema and into an
 *    explicit load-time reconciliation.
 * 3. **Save v4 is a CLEAN BREAK. No v3 → v4 migration.** Nothing is using the save system in
 *    anger, so v4 is the floor and anything older is discarded as if there were no save. See the
 *    note at the foot of this file for what that deletes.
 * 4. **Biomes are MONO-ELEMENT at Early Access launch** ([ticket 05](../../docs/wayfinder/steam-release/tickets/05-release-shape.md),
 *    Henry 2026-08-21), which amends `exploration-map.md`'s "each biome mixes two elements". The
 *    launch triangle (Fire > Nature > Water > Fire) is a *pure counter cycle*, so every possible
 *    pairing within it is a counter pair and a Fire starter walking into a Fire/Water biome is not
 *    fun. Two-element biomes return as *friendly* pairs once the roster widens — **deferred, not
 *    cancelled** — so `elements` is modelled as a 1-or-2 list rather than a single string. See
 *    `IBiome` for why that matters more than it looks.
 * 5. **Assembly costs a blueprint at the ranch, and a blueprint PLUS scrap at a mid-run workshop.**
 *    This resolves a direct conflict between `vision.md` ("spend SCRAP to assemble") and
 *    `economy-session.md` ("assembly (ranch AND workshop) costs blueprints only") by making both
 *    literally true of the place each was describing. Mid-run recruiting therefore competes with
 *    the marketplace for scrap — growing the team vs sharpening the deck is a real route decision
 *    — while between runs a blueprint is always spendable. **The scrap number is not set here**;
 *    it belongs to [ticket 14](../../docs/wayfinder/steam-release/tickets/14-workshop-node.md).
 */

import { z } from 'zod';
import { effectiveOS } from './run/effectiveOS';

// ---------------------------------------------------------------------------------------------
// Region graph
// ---------------------------------------------------------------------------------------------

/**
 * `exploration-map.md`: "Visibility: types visible, contents hidden — 'fire encounter /
 * fire-and-earth encounter / event / marketplace / elite / boss' readable from the map." So the
 * node's `kind` is public from the moment the graph is generated, and everything that decides what
 * is actually *in* it is rolled at entry from the run seed, never stored ahead of time. Storing a
 * pre-rolled encounter would be the easy version and it would leak through any save-file inspector.
 */
export type NodeKind =
    | 'wild'        // the ordinary fight; symmetric to your party size
    | 'rival'       // ticket 142a: a wild in every way but its species — the PATH elements, not the biome's
    | 'elite'       // `economy-session.md`: ONE harder fight, the Driver visible as the stakes
    | 'alpha'       // `exploration-map.md`: one overtuned wild vs your full team, guards a rare blueprint
    | 'ambush'      // `exploration-map.md`: their 3 vs your 2, marked high-risk
    | 'marketplace' // buy cards / macros, sell cards, pay for removal
    | 'workshop'    // assemble a blueprint into the party, or reflash an OS
    | 'event'
    | 'gym';        // the region boss — a three-fight gauntlet, not a node you clear in one battle

export const NODE_KINDS = [
    'wild', 'rival', 'elite', 'alpha', 'ambush', 'marketplace', 'workshop', 'event', 'gym',
] as const;

/**
 * `exploration-map.md`: "an explorable GRAPH, explicitly NOT Spire's three lanes — you find your
 * way to the boss, with room to FARM if you don't feel ready." The shape below is
 * [ticket 07](../../docs/wayfinder/steam-release/tickets/07-region-graph.md)'s ruled model:
 * **3 sequential biomes × 5 layers** (entry, 3 middle, exit), width 2–3 per middle layer, lateral
 * edges between siblings on ~60% of layers, one dead-end **pocket** per biome, biome exit = an
 * elite (biome 3's exit is the gym).
 *
 * Three consequences the type has to carry that a lane model would not:
 *
 *   - **`visited` is a count, not a boolean, and it is load-bearing.** Ticket 07: *"Entering a
 *     node triggers it again, always"* — wilds re-fight at **full rewards** ("farming is fine"),
 *     markets and workshops can be revisited at the price of re-fighting the wilds on the way. A
 *     node's contents are rolled at entry from the node's seed **plus this count**, so re-entry
 *     re-rolls honestly instead of replaying a cached encounter.
 *   - **`edges` is walkable in both directions.** Ticket 07 again: *"the graph is genuinely
 *     explorable, not a frontier picker."* A DAG would forbid backtracking silently.
 *   - **`layer` replaces raw x/y.** The generator lays nodes out in layers, so layer + biome is
 *     the position; ticket 10's screen derives pixels from it. Storing pixels in the save would
 *     freeze a layout decision the UI has not made yet.
 */
export interface IRegionNode {
    readonly id: string;
    readonly kind: NodeKind;
    /** Which biome this node sits in — indexes into `IRunState.biomes`. Biomes are sequential. */
    readonly biomeIndex: number;
    /** 0–4 within its biome: 0 entry, 1–3 middle, 4 exit (an elite, or the gym in biome 3). */
    readonly layer: number;
    /** Ticket 07: one dead-end side node per biome — a wild, an alpha, or an ambush. */
    readonly pocket: boolean;
    /** Node ids reachable from here. Walkable both ways. */
    readonly edges: ReadonlyArray<string>;
    /**
     * How many times the player has entered and resolved this node. 0 = never. Feeds the
     * content roll at entry — see the note above on why re-entry must re-roll.
     */
    readonly visited: number;
    /**
     * Ticket 142b: this elite is the SCOUT — the last fight before the gauntlet, fielding two
     * bodies of the gym leader's own comp. Optional rather than required because save v4 has no
     * migration path (ticket 06): a run saved before this shipped simply has no scout, which is
     * the honest reading of a map generated without one.
     */
    readonly scout?: boolean;
    /**
     * Ticket 17: the Driver this node pays on a win — set on every `elite` and `ambush` at run
     * creation (`run/driverStakes.ts`) so the map can show the stakes before the player commits.
     * Optional for the scout's reason: a run saved before this shipped has no stakes, and resumes
     * as it was rather than failing the parse.
     */
    readonly driverStake?: string;
}

/**
 * A run is THREE biomes (`exploration-map.md`). What each biome *contains* changed under
 * [ticket 05](../../docs/wayfinder/steam-release/tickets/05-release-shape.md): **mono-element at
 * EA launch**, with two-element biomes deferred until the roster widens.
 *
 * `elements` is therefore a **1-or-2 list**, not a single string and not a fixed pair. That choice
 * is doing real work rather than hedging:
 *
 * - Ticket 05 defers two-element biomes, it does not cancel them, and names a pre-agreed fallback
 *   (bring in all six non-Light/Dark elements) that widens this axis too.
 * - Save v4 has **no migration path** by ruling (ticket 06). Before launch that is free; *after*
 *   an Early Access launch, changing the biome shape would mean either a v5 migration the ruling
 *   forbids or wiping real players' runs. A list that already admits both shapes costs one
 *   `.min(1).max(2)` today and saves a save-breaking patch later.
 *
 * The elements are the routing information the player reads the map with, and the gym's team draws
 * one member per biome — so they are the final exam's syllabus, not decoration.
 */
export interface IBiome {
    readonly id: string;
    readonly name: string;
    /** One element at EA launch; two once friendly pairs ship. Never zero, never three. */
    readonly elements: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------------------------
// Run-scoped economy
// ---------------------------------------------------------------------------------------------

/**
 * `economy-session.md`, bite two: "Cards do NOT persist. Every run starts fresh with a PARTIAL
 * deck... The run BUILDS toward the ~20-25 cards a good 3v3 deck wants."
 *
 * So the shared deck lives here, not in the save's persistent half — which is the single biggest
 * change from v3, where `cardInventory` + `activeDeck` were permanent.
 *
 * `ownerId` is the roster instance that brought the card. It is not needed for STAB (that is by
 * *caster*, per the 3v3 ruling) — it is needed for **removal on departure**: nothing yet rules what
 * happens to a member's cards if a member can ever leave the party mid-run. **[ASSUMED]** members
 * never leave, so this field is currently write-only bookkeeping. Cheap to keep, expensive to add
 * back later.
 */
export interface IRunCard {
    readonly instanceId: string;
    readonly dataId: string;
    readonly ownerId: string | null; // null = bought, drafted, or granted by an event
    /**
     * TICKET 163b — **this instance has been upgraded**, and `dataId` is therefore the `+` id.
     *
     * The upgrade happens IN PLACE: the instance keeps its `instanceId` and its `ownerId` and
     * swaps which card it points at. That is what makes *"an upgrade replaces exactly one copy"*
     * literally true — a mint-and-delete would give the player a card they did not have and take
     * one they did, which reads the same in a deck list and differently in every log that follows
     * an instance.
     *
     * REDUNDANT WITH `dataId`, AND DELIBERATELY SO. 163b §4 asks for the flag, and the reason is
     * the persistence door 163 §5 leaves open: *"no persistence across runs to start; the data
     * shape must leave the door open."* When upgrades survive a run they will be a map on the
     * collection entry keyed by BASE id, and the thing that has to be read at that point is "was
     * this copy upgraded", not "does this string end in a plus". `runSlice.upgrade.test.ts` pins
     * the two agreeing, so the redundancy is checked rather than trusted.
     */
    readonly upgraded?: true;
}

/**
 * `macros-and-drivers.md`: MACROS — 3 slots, single-use, fired free on your turn, priced at FULL
 * 1e-card value (rares 1.5x). Slots are fixed at 3, so this is a fixed-length array with holes
 * rather than a growable list: an empty slot is a visible, fillable thing in the UI.
 */
export const MACRO_SLOTS = 3;
export type MacroSlots = readonly [string | null, string | null, string | null];

// ---------------------------------------------------------------------------------------------
// The gauntlet
// ---------------------------------------------------------------------------------------------

/**
 * `exploration-map.md`: "The gym is a GAUNTLET: three fights, NO healing between them", and
 * "FULL HEAL between regular nodes". That asymmetry is why HP carry-over lives *inside* this object
 * and nowhere else in `IRunState` — outside the gauntlet there is no HP state worth persisting.
 *
 * Keeps the `persistedStats` shape already proven in v3's `IGauntletState` (`engine/gameTypes.ts`),
 * including its comment's reasoning: only `hp` persists between the three fights; energy, statuses
 * and everything else reset each fight.
 *
 * `downedMemberIds` exists because of `economy-session.md`'s "Gauntlet death: revivable, never
 * gone-for-gauntlet" — a fight-one loss must not be unrecoverable. **The revive's SHAPE is
 * explicitly deferred to playtesting** in that doc (a Revive macro per `macros-and-drivers.md`, vs
 * auto-return at reduced %), so this field records *who is down* and stays silent about how they
 * come back. Both candidate shapes read the same field.
 */
export interface IGauntletProgress {
    /** 0, 1 or 2 — which of the three fights is next. */
    readonly fightIndex: number;
    readonly totalFights: number;
    /** Roster instance id → carried HP. Only HP; see above. */
    readonly persistedHp: Readonly<Record<string, number>>;
    /** Members at 0 HP, awaiting whatever revive shape playtesting picks. */
    readonly downedMemberIds: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------

export type RunPhase = 'map' | 'encounter' | 'gauntlet' | 'ended';
export type RunOutcome = 'victory' | 'defeat' | 'abandoned';

export interface IRunState {
    /**
     * The run's root seed. Everything procedural in the run derives from it through `SeedStream`,
     * so ticket 23's "an app close mid-run resumes at the same node with the same seed" is
     * satisfied by storing this one string plus the node states — not by storing pre-rolled
     * content.
     */
    readonly seed: string;

    /** Which of the three offered gyms was chosen at run start (`exploration-map.md`). */
    readonly gymId: string;
    /** Exactly three (`exploration-map.md`). */
    readonly biomes: ReadonlyArray<IBiome>;

    /** The whole graph, generated once at run start from `seed`. */
    readonly nodes: ReadonlyArray<IRegionNode>;
    readonly currentNodeId: string;

    /**
     * Roster instance ids, max 3, **no duplicate species**. The species clause is a standing law
     * (map § Notes) that `teamComps.ts` documents as an open question and **no game code enforces
     * today** (gap audit §5) — putting it in this schema is the first place it becomes real.
     * Starts at 1 and grows 1 → 2 → 3 through workshop nodes (`vision.md`).
     */
    readonly partyIds: ReadonlyArray<string>;

    /** The shared 3v3 deck the party actually fights with. `economy-session.md` bite two. */
    readonly deck: ReadonlyArray<IRunCard>;

    /**
     * THE RUN COLLECTION — everything owned this run that is not in the active deck.
     *
     * Ticket 61 (Henry, 2026-08-26). Picks the player chose to store rather than play, cards edited
     * out of the deck at one of the four surfaces, and a benched member's engine all live here. It
     * is run-scoped exactly as `deck` and `scrap` are: it dies with the run.
     *
     * **This is what stopped deck bloat being a trap.** Before it, a card you took was a card you
     * had to draw, so taking a good card you could not use yet was a cost — and the answer the game
     * offered was to pay 20 scrap to undo it. A card in the collection costs nothing and is one
     * free edit away from playing, which is why paid removal could be deleted rather than repriced.
     *
     * Optional so save v4 blobs written before this field parse; every read defaults to `[]`.
     */
    readonly collection?: ReadonlyArray<IRunCard>;

    /**
     * THE BENCH — roster member ids owned by this run but not currently fielded.
     *
     * Ticket 61 §3 (Henry, 2026-08-26). A benched member is still yours: it can be swapped into the
     * party at any of the four edit surfaces, and when it is, **its five engine cards follow it**
     * out of the collection and into the active deck. Swapping the other way sends the outgoing
     * member's engine back to the collection. That is the whole of *"remove Rat for the fire
     * biome"* — a routing decision, not a loss.
     *
     * Member ids, not members: the individuals live on the ranch roster exactly as `partyIds`'
     * do, and a run that stored copies of them would be a second place for a nickname to drift.
     *
     * Optional so save v4 blobs written before this field parse; every read defaults to `[]`.
     */
    readonly bench?: ReadonlyArray<string>;

    /**
     * The biome the player is about to walk INTO, when the boundary alert is owed and unanswered.
     * Undefined is the ordinary state.
     *
     * Ticket 61 §3's fourth edit surface, and the one Henry added after the other three: *"I think
     * after defeating the elite that gates the next biome you should be able to manage your deck and
     * team."* `runSlice.resolveEncounter` sets it when the fight that just ended was the biome's
     * exit elite and another biome follows; `dismissBoundaryAlert` clears it, whichever button the
     * player pressed.
     *
     * **It is run state rather than a component flag for the same reason `phase` is.** The alert is
     * a thing the run owes the player, not a thing a screen happens to be showing: an app close
     * between the elite dying and the modal being answered must resume with the offer still open,
     * because the information it carries — what element the next biome runs — is the whole reason
     * ticket 62 put an edit surface here rather than at the next node.
     *
     * Optional so save v4 blobs written before this field parse; a run resumed without it is a run
     * that owes no alert, which is true of every run that predates the field.
     */
    readonly boundaryBiome?: number;

    /** Run-scoped, resets with the run (`economy-session.md`, anti-mudflation). */
    readonly scrap: number;

    /** 3 fixed slots; `macros-and-drivers.md`. */
    readonly macros: MacroSlots;

    /** Party-wide passives from elites; `macros-and-drivers.md`. Ids into a driver registry. */
    readonly drivers: ReadonlyArray<string>;

    /**
     * `exploration-map.md`: "Run difficulty = TIERS, not scaling... harder tiers unlock by beating
     * gyms — meaner curated teams, more elites, enemy relics; never bigger numbers." Tier is chosen
     * at run start from what the ranch has unlocked, and never changes mid-run.
     */
    readonly tier: number;
    /** Opt-in run modifiers, ascension-shaped. Empty for the vertical slice. */
    readonly modifiers: ReadonlyArray<string>;

    readonly phase: RunPhase;
    /** Set only when `phase === 'gauntlet'`. */
    readonly gauntlet: IGauntletProgress | null;
    /** Set only when `phase === 'ended'`. */
    readonly outcome: RunOutcome | null;

    /**
     * Won fights since the last blueprint dropped — the counter behind the PITY FLOOR
     * (`RewardSystem.BLUEPRINT_PITY_FIGHTS`), ruled by Henry on 2026-09-01 after a solo run went
     * 13 fights dry.
     *
     * It lives on the RUN rather than the ranch because the drought is a property of the session
     * being played, not of the collection: a pity debt carried between runs would make a fresh run
     * pay for the last one's luck, which is the anti-mudflation line (`economy-session.md`) running
     * backwards. It resets to 0 on every drop, including a guaranteed alpha.
     *
     * Optional, `boundaryBiome`'s precedent: a save written before this field parses, and a run
     * resumed without it is a run owed no pity — which is exactly what was true of it.
     */
    readonly blueprintDryFights?: number;

    /**
     * How many times each marketplace node's stock has been REFRESHED, by node id.
     *
     * Ticket 142 §7 (Henry, 2026-09-11): *"make it static per run so whenever you come back it has
     * the same stock, which doesn't get replenished — once you buy the card it's gone from the
     * shop."* Stock used to be a function of `node.visited`, so walking back in was a free re-roll
     * — the farm the ticket closes. It is now a function of this counter, which only a PAID
     * refresh moves (142f).
     *
     * Keyed by node id rather than a single run-wide number: two markets are two shelves, and
     * refreshing one must not disturb the other's stock.
     *
     * Optional with `.default({})` — the `seenTips` precedent. A run saved before this field is a
     * run that has refreshed nothing, which is what the default says.
     */
    readonly marketRefreshes?: Readonly<Record<string, number>>;

    /**
     * Which marketplace blueprint slots have been bought, as `nodeId:refreshCount` keys.
     *
     * Ticket 142 §7: *"Add blueprints to the shop ... Bought -> gone until a refresh."* A CARD
     * offer answers "already bought?" from ownership - `isOfferSold` looks for its minted instance
     * id - and a blueprint cannot, because blueprints are a persistent COUNT on the ranch and
     * owning a kraken blueprint says nothing about which stall it came from.
     *
     * The refresh count is IN the key rather than beside it, so a refresh makes the slot available
     * again with no clearing step and nothing to forget to clear.
     */
    readonly boughtBlueprints?: ReadonlyArray<string>;

    /**
     * TICKET 163b — which upgrade benches have been used, as `nodeId:visitCount` keys.
     *
     * Henry ruled ONE UPGRADE PER VISIT (163 §2) and, on 2026-09-24, that the bench appears at BOTH
     * stops — the market stall and the workshop — so the allowance is per node per visit and this
     * is where it is spent. The gym gate's free upgrade is not in here: it is once per gauntlet and
     * `IGauntletProgress` already knows how far into one you are.
     *
     * Keyed on `node.visited` rather than on a refresh count, which is the one place this differs
     * from `boughtBlueprints` above and is the difference between the two rules. A stall's stock is
     * a SHELF — buy the card and it is gone until you pay to restock — so its key is the shelf's
     * identity. An upgrade bench is a SERVICE: walking back in is a new visit and a new allowance,
     * at the price of re-fighting the wilds on the way, which is ticket 07's answer to farming and
     * the reason `visited` is a count rather than a boolean.
     *
     * Optional with `.default([])`, the `boughtBlueprints` precedent: a run saved before this field
     * is a run that has upgraded nothing.
     */
    readonly upgradesTaken?: ReadonlyArray<string>;

    /**
     * TICKET 166e — which gate patch benches have been used, as `patch:nodeId:visitCount` keys.
     * The gate's heading has always said "A PATCH FOR ONE BODY"; before 166e nothing enforced it.
     * Optional with `.default([])`, the `upgradesTaken` precedent.
     */
    readonly patchBenchesUsed?: ReadonlyArray<string>;

    /**
     * TICKET 168: every event resolved this run, in order. The once-per-run and first-visit rules,
     * and the power cap, read this. Optional with `.default([])`, the `patchBenchesUsed` precedent.
     */
    readonly eventHistory?: ReadonlyArray<{
        readonly nodeId: string;
        readonly eventId: string;
        readonly choiceId: string;
        readonly grants: ReadonlyArray<'driver' | 'patch'>;
    }>;

    /**
     * TICKET 168b — **Drivers that last for the next fight only**, and how many fights each has
     * left. An event's bad outcome (Frayed Signal, Static Haze) lands here rather than in `drivers`:
     * `drivers` is the run's permanent list and the power cap counts it, while this list empties
     * itself. `battleSetup` applies both lists; `resolveEncounter`, `advanceGauntlet` and
     * `finishGauntlet` count it down. Optional with `.default([])`.
     */
    readonly tempDrivers?: ReadonlyArray<{ readonly driverId: string; readonly fightsLeft: number }>;

    /**
     * TICKET 163d — **the patch fitted to each party member's firmware**, by member id.
     *
     * RUN STATE, not roster state, on 163 §5 decision 5: *"no persistence across runs to start."*
     * `IRanchMember` is the individual that survives a run; a patch is something the run found, so
     * it dies with the run exactly as `drivers` and `scrap` do. Keyed by member id rather than held
     * on the member for the same reason `partyIds` is a list of ids — one place owns a Mingming,
     * and it is the roster.
     *
     * At most `PATCH_SLOTS` (one) per member. The cap is enforced in the reducer rather than by the
     * type, because a type cannot say "one" about an array in a way zod will also say.
     *
     * Optional with `.default({})`: a run saved before this field is a run that found none.
     */
    readonly patches?: Readonly<Record<string, ReadonlyArray<string>>>;

    /**
     * TICKET 168f — **the firmware an event switched a body to, for this run only**, by member id.
     *
     * Firmware Reflash writes here and never to the ranch, so the roster member keeps its own OS for
     * the next run. Read through `effectiveOS(run, member)` everywhere a run reads a party member's
     * firmware. The deck is untouched: only the firmware changes. Optional with `.default({})`.
     */
    readonly osOverrides?: Readonly<Record<string, string>>;

    /**
     * TICKET 168g — **this encounter is Ambush Bait's optional fight**, on an `event` node.
     *
     * Set by `startEventFight` when the player chooses Fight it, cleared by `resolveEncounter`. While
     * it is set the fight is classed as a wild (`engine/run/eventFight.ts`) and its win pays double
     * scrap. Persisted with the run, so an app close mid-fight resumes into the same fight.
     * Optional with `.default(false)`.
     */
    readonly eventFight?: boolean;

    /**
     * Fights resolved so far. `exploration-map.md` targets **8–10 battles plus the gauntlet =
     * 10–13 fights, 35–45 minutes**, and farming means the player can exceed it — so this is the
     * metric the playtest ticket (25) reads to find out whether the target holds, not a cap.
     */
    readonly fightsResolved: number;
    /**
     * **[ASSUMED]** `Date.now()` at run start, for the same measurement. Wall-clock, so it counts
     * time the game sat paused — worth knowing before anyone quotes it as "session length".
     */
    readonly startedAt: number;
}

// ---------------------------------------------------------------------------------------------
// The ranch — everything that survives a run
// ---------------------------------------------------------------------------------------------

/**
 * `vision.md`: "RULED (Henry, 2026-08-19): BLUEPRINTS ARE CONSUMABLE. One blueprint is SPENT to
 * assemble a mingming; stats roll at first assembly... Reflashing an individual's OS also costs a
 * blueprint."
 *
 * That is why this is a **count per species** and not v3's array of `IBlueprint` objects. v3
 * deduplicated blueprints on `architectureId` (gap audit §3) — the exact opposite of a consumable.
 * The migration has to turn "I have seen a kraken blueprint" into "I have N kraken blueprints",
 * and there is no honest N in the old data; see the migration note at the foot of this file.
 */
export type BlueprintCounts = Readonly<Record<string, number>>;

/**
 * `economy-session.md`: "Card collection = a CODEX (seen/played cards logged; completion pays
 * cosmetics or blueprints) — collection as achievement layer, **ZERO power attached**."
 *
 * Two sets, not one, because "seen" and "played" are different achievements and collapsing them
 * loses the distinction permanently.
 */
export interface ICodex {
    readonly seen: ReadonlyArray<string>;   // program dataIds encountered
    readonly played: ReadonlyArray<string>; // program dataIds actually cast
    /**
     * Ticket 31. Three more ledgers, each a different claim about the player and none derivable
     * from the others — see `engine/codex.ts` for why collapsing any two loses something.
     *
     * `species` is the bestiary: anything that stood on a battlefield, yours or theirs.
     * `assembled` is what you built out of a blueprint — a strict subset of `species`.
     * `os` is every firmware that has ever been equipped on something you own.
     *
     * All add-only and deduped, like `seen`, and all `.default([])` in the schema so a v4 save
     * written before ticket 31 loads as a player who has recorded none of them.
     */
    readonly species: ReadonlyArray<string>;
    readonly assembled: ReadonlyArray<string>;
    readonly os: ReadonlyArray<string>;
}

export interface IRanchState {
    /**
     * Assembled individuals with their stat rolls and active OS. **No `level`, no `experience`** —
     * ticket 21 freezes the engine at the level-15 calibration, so those fields leave the type
     * entirely rather than being pinned to a constant here.
     */
    readonly roster: ReadonlyArray<IRanchMember>;
    readonly blueprints: BlueprintCounts;
    readonly codex: ICodex;
    /** Gym ids beaten — what tiers and gyms are offered at run start. */
    readonly gymsCleared: ReadonlyArray<string>;
    readonly highestTierCleared: number;
    /**
     * Onboarding tips already shown (ticket 24). `TipId`s, but typed as plain strings for the same
     * reason the codex stores raw dataIds: the save has to survive a build that renamed or retired
     * a tip, and a union in the schema would fail the parse on an id this build never heard of.
     *
     * On the RANCH rather than the run, deliberately: a player who dies in biome 0 has still been
     * taught what energy is, and being taught it again on the next attempt is the thing tutorials
     * are hated for. It is also what makes the first fight easier exactly once — see `createRun`'s
     * `onboarding` flag.
     */
    readonly seenTips: ReadonlyArray<string>;
    /**
     * Codex milestones that have already FIRED (ticket 31), as ids into `CODEX_MILESTONES`.
     *
     * Separate from "currently satisfied", which `codex.milestonesMet` computes from the ledgers on
     * demand. A milestone is an event that pays out once; storing satisfaction instead of firing
     * would pay again every time the screen mounted. The payouts themselves are unwired pending
     * Henry's numbers — see `CodexMilestone`.
     */
    readonly codexMilestones: ReadonlyArray<string>;
    /**
     * How many runs this player has FINISHED, by any outcome (victory, defeat or abandon).
     *
     * Ticket 59 (Henry, 2026-09-09): *"for the first run increase blueprint rate by 10% across
     * the board"*. `RewardSystem`'s own note asks for exactly this shape - early-game generosity
     * *"belongs as an explicit `firstRun: true` modifier on this table, not as a silent function
     * of roster length"* - and this counter is what makes `firstRun` answerable.
     *
     * **It counts ENDED runs, not started ones, and it lives on the ranch.** A run in progress
     * cannot change it, so the bonus can never switch off underneath a player mid-run - which is
     * the failure that made the deleted `getBlueprintRate(rosterSize)` curve wrong. Abandoning
     * counts: `endRun('abandoned')` is a finished attempt, and not counting it would let a player
     * farm the first-run rate forever by quitting to the ranch.
     *
     * Optional and `.default(0)` for the same reason `seenTips` is: a save written before this
     * field is a player who has completed no runs, which is what the default says. No version bump.
     */
    readonly runsCompleted?: number;
}

export interface IRanchMember {
    readonly id: string;
    readonly definitionId: string;
    readonly nickname?: string;
    readonly activeOS: string;
    readonly attackIV: number;
    readonly defenseIV: number;
    readonly hpIV: number;
}

// ---------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------

export const BiomeSchema = z.object({
    id: z.string(),
    name: z.string(),
    // 1 at EA launch (ticket 05's mono biomes), 2 once friendly pairs ship. Bounded on both sides:
    // an empty biome has no routing information at all, and three would be a design change nobody
    // has ruled.
    elements: z.array(z.string()).min(1).max(2),
});

export const RegionNodeSchema = z.object({
    id: z.string(),
    kind: z.enum(NODE_KINDS),
    biomeIndex: z.number().int().min(0).max(2),
    // 5 layers per biome (ticket 07): 0 entry, 1-3 middle, 4 exit.
    layer: z.number().int().min(0).max(4),
    pocket: z.boolean(),
    edges: z.array(z.string()),
    visited: z.number().int().min(0),
    // Ticket 142b. Optional, not defaulted: a pre-142 save has no scout and must resume as it was.
    scout: z.boolean().optional(),
    // Ticket 17. Optional, not defaulted, for the same reason as `scout`.
    driverStake: z.string().optional(),
});

export const RunCardSchema = z.object({
    instanceId: z.string(),
    dataId: z.string(),
    ownerId: z.string().nullable(),
    // TICKET 163b. `.optional()` and never defaulted: the ABSENCE of the flag is the ordinary
    // state, and a `false` on every card in every save would be three hundred bytes a run saying
    // nothing. A card saved before this field is a card nobody had upgraded.
    upgraded: z.literal(true).optional(),
});

export const GauntletProgressSchema = z.object({
    fightIndex: z.number().int().min(0),
    totalFights: z.number().int().min(1),
    persistedHp: z.record(z.string(), z.number().int().min(0)),
    downedMemberIds: z.array(z.string()),
});

export const RunStateSchema = z.object({
    seed: z.string(),
    gymId: z.string(),
    biomes: z.array(BiomeSchema).length(3),
    nodes: z.array(RegionNodeSchema).min(1),
    currentNodeId: z.string(),
    partyIds: z.array(z.string()).max(3),
    deck: z.array(RunCardSchema),
    // `.default([])` rather than required: an in-progress run saved before the collection existed
    // must resume, and resuming with an empty collection is exactly right — everything it owned
    // was in its deck.
    collection: z.array(RunCardSchema).default([]),
    // Same reasoning as `collection`: an in-progress run saved before the bench existed resumes
    // with nobody benched, which is exactly what was true of it.
    bench: z.array(z.string()).default([]),
    // Bounded like `biomeIndex` is: an alert naming a fourth biome is a save that would open a modal
    // about somewhere the run cannot go. `.optional()` rather than `.default()` because "no alert
    // owed" has no number to stand for it — 0 is a real biome.
    boundaryBiome: z.number().int().min(0).max(2).optional(),
    scrap: z.number().int().min(0),
    macros: z.tuple([z.string().nullable(), z.string().nullable(), z.string().nullable()]),
    drivers: z.array(z.string()),
    tier: z.number().int().min(0),
    modifiers: z.array(z.string()),
    phase: z.enum(['map', 'encounter', 'gauntlet', 'ended']),
    gauntlet: GauntletProgressSchema.nullable(),
    outcome: z.enum(['victory', 'defeat', 'abandoned']).nullable(),
    // `.default(0)` rather than `.optional()`: unlike `boundaryBiome`, 0 is the honest value for a
    // run that predates the field — no fights have gone dry as far as this counter knows — so the
    // parse can supply it and every reader downstream is spared a `?? 0`.
    blueprintDryFights: z.number().int().min(0).default(0),
    // Ticket 142 §7, add-only like the field above it.
    marketRefreshes: z.record(z.string(), z.number().int().min(0)).default({}),
    upgradesTaken: z.array(z.string()).default([]),
    patchBenchesUsed: z.array(z.string()).default([]),
    tempDrivers: z.array(z.object({
        driverId: z.string(),
        fightsLeft: z.number().int().min(1),
    })).default([]),
    eventHistory: z.array(z.object({
        nodeId: z.string(),
        eventId: z.string(),
        choiceId: z.string(),
        grants: z.array(z.enum(['driver', 'patch'])),
    })).default([]),
    patches: z.record(z.string(), z.array(z.string())).default({}),
    osOverrides: z.record(z.string(), z.string()).default({}),
    eventFight: z.boolean().default(false),
    boughtBlueprints: z.array(z.string()).default([]),
    fightsResolved: z.number().int().min(0),
    startedAt: z.number().int().min(0),
})
    // Referential integrity, checked at load rather than trusted. A save whose `currentNodeId`
    // points at nothing is a soft-locked run, and finding that out at load time is the difference
    // between a clear error and a black map screen.
    .refine(
        (run) => run.nodes.some((n) => n.id === run.currentNodeId),
        { message: 'currentNodeId does not match any node', path: ['currentNodeId'] },
    )
    .refine(
        (run) => run.phase !== 'gauntlet' || run.gauntlet !== null,
        { message: 'phase is "gauntlet" but gauntlet progress is null', path: ['gauntlet'] },
    )
    .refine(
        (run) => run.phase !== 'ended' || run.outcome !== null,
        { message: 'phase is "ended" but outcome is null', path: ['outcome'] },
    );

export const RanchMemberSchema = z.object({
    id: z.string(),
    definitionId: z.string(),
    nickname: z.string().optional(),
    activeOS: z.string(),
    attackIV: z.number().int().min(0).max(31),
    defenseIV: z.number().int().min(0).max(31),
    hpIV: z.number().int().min(0).max(31),
});

export const CodexSchema = z.object({
    seen: z.array(z.string()).default([]),
    played: z.array(z.string()).default([]),
    // Ticket 31, all `.default([])` and no version bump — same argument as ticket 24's `seenTips`.
    species: z.array(z.string()).default([]),
    assembled: z.array(z.string()).default([]),
    os: z.array(z.string()).default([]),
});

/**
 * `.default()`, NOT `.catch()` — and the difference is the whole point.
 *
 * v3's `PlayerSaveSchema` uses `.catch([])` on `blueprints`, `relics`, `unlockedSectors` and
 * `baseDecksGranted` (`engine/SaveSystem.ts`). `.catch` means *malformed input is replaced by the
 * fallback and the parse still succeeds* — so a single corrupt blueprint count would silently
 * reset the player's entire permanent inventory to empty, and the autosave would then write that
 * emptiness over the good save on the very next state change. The prototype's own test caught this
 * (`runTypes.test.ts`, "keeps blueprints as counts"): the first version of this schema had
 * `.catch({})` and cheerfully accepted `{ kraken: -1 }` as `{}`.
 *
 * `.default()` only fills in a **missing** field and lets a **malformed** one fail the parse. A
 * failed parse is the outcome we want: ticket 04's `loadGame` treats it as a corrupt save and the
 * last good one survives. Losing a session beats silently voiding the only persistent currency in
 * the game.
 *
 * **v3's `.catch` usages should be revisited under the same argument in ticket 23** — they predate
 * blueprints being consumable, when the field was a dedup'd list nobody could spend.
 */
export const RanchStateSchema = z.object({
    roster: z.array(RanchMemberSchema),
    blueprints: z.record(z.string(), z.number().int().min(0)).default({}),
    codex: CodexSchema.default({ seen: [], played: [], species: [], assembled: [], os: [] }),
    gymsCleared: z.array(z.string()).default([]),
    highestTierCleared: z.number().int().min(0).default(0),
    // Ticket 24. `.default([])` and no version bump: a v4 save written before this field existed is
    // a player who has seen no tips, which is exactly what the default says. That is the whole
    // reason the field is add-only and never removed — see `IRanchState.seenTips`.
    seenTips: z.array(z.string()).default([]),
    codexMilestones: z.array(z.string()).default([]),
    // Ticket 59, same add-only shape as `seenTips` above: absent means zero completed runs.
    runsCompleted: z.number().int().min(0).default(0),
});

/**
 * TWO KEYS, TWO ENVELOPES (Henry, 2026-08-21).
 *
 * The ranch and the run are written independently, so a corrupt run costs the run and nothing
 * else. That is the right blast radius: the ranch is the only irreplaceable thing in the game
 * (blueprints are the only persistent currency, and individuals carry unrepeatable stat rolls),
 * while a run is at most 45 minutes old and was always going to end.
 *
 * Each envelope carries its own `version` because they can now drift — a future ranch-only change
 * must not force a run schema bump, and vice versa.
 */
export const SAVE_VERSION_V4 = 4;

export const RanchSaveSchema = z.object({
    version: z.literal(SAVE_VERSION_V4),
    ranch: RanchStateSchema,
});

export const RunSaveSchema = z.object({
    version: z.literal(SAVE_VERSION_V4),
    run: RunStateSchema,
});

export type IRanchSave = z.infer<typeof RanchSaveSchema>;
export type IRunSave = z.infer<typeof RunSaveSchema>;

// ---------------------------------------------------------------------------------------------
// Reconciliation — the price of two keys
// ---------------------------------------------------------------------------------------------

/**
 * Two independent writes can tear: the run can say you have three party members while the ranch
 * only knows about two, because the process died between the two `setItem` calls. One blob made
 * that impossible for free; two keys make it possible, so it has to be handled explicitly rather
 * than discovered later as a black map screen.
 *
 * **The law: the run is always the disposable half.** Anything that cannot be reconciled discards
 * the run and keeps the ranch. A player loses at most one run in progress; they never lose an
 * individual, a blueprint, or a codex entry to a tear. There is deliberately no attempt to repair
 * a run — a run whose party is wrong is a run whose deck, scrap and node state are all suspect
 * too, and half-repairing it produces a subtler bug than discarding it.
 *
 * This is also where the two cross-object laws now live. They cannot be schema refinements any
 * more (nothing parses both halves at once), and they were never enforced anywhere before this
 * (`teamComps.ts` records the species clause as an open question; gap audit §5 confirms no game
 * code checks it).
 */
export type RunDiscardReason =
    | 'run-schema-invalid'
    | 'party-references-missing-member'
    | 'party-has-duplicate-species';

export interface ReconcileResult {
    /** Null when the ranch itself failed to parse — treat exactly like "no save". */
    readonly ranch: IRanchState | null;
    /** Null when there is no run, or when one was discarded. */
    readonly run: IRunState | null;
    /** Set when a run existed and was thrown away. Surface it; do not swallow it. */
    readonly discarded?: RunDiscardReason;
}

/**
 * Pure. Takes whatever came out of the two storage keys (already `JSON.parse`d, or `null` when the
 * key was absent) and decides what the game actually starts with.
 */
export function reconcileLoadedState(rawRanch: unknown, rawRun: unknown): ReconcileResult {
    const ranchParsed = RanchSaveSchema.safeParse(rawRanch);
    if (!ranchParsed.success) {
        // No trustworthy ranch means no game state at all — a run without a ranch is meaningless,
        // since every party id points into the roster.
        return { ranch: null, run: null };
    }
    const ranch = ranchParsed.data.ranch;

    if (rawRun === null || rawRun === undefined) {
        return { ranch, run: null };
    }

    const runParsed = RunSaveSchema.safeParse(rawRun);
    if (!runParsed.success) {
        return { ranch, run: null, discarded: 'run-schema-invalid' };
    }
    const run = runParsed.data.run;

    // Law 1: every party member is a real roster member. A dangling id is an unstartable run.
    const byId = new Map(ranch.roster.map((m) => [m.id, m]));
    if (run.partyIds.some((id) => !byId.has(id))) {
        return { ranch, run: null, discarded: 'party-references-missing-member' };
    }

    // Law 2: NO DUPLICATE BUILD PER TEAM — species AND firmware (Henry, 2026-09-05; see
    // `party.partyBlockFor` for the ruling). This was species alone, which is now legal: a party
    // holding `kraken_v1` beside `kraken_v2` is exactly what the ruling asked for, and a loader
    // still enforcing the old clause would throw that run away on the next launch — the worst
    // possible place for the two rules to disagree, because it costs the run silently.
    // TICKET 168f: the firmware a body runs in THIS run. A Firmware Reflash can put a body on the OS
    // a later recruit holds on the ranch; comparing the ranch's own would discard that legal run.
    const builds = run.partyIds.map((id) => {
        const member = byId.get(id)!;
        return `${member.definitionId}::${effectiveOS(run, member) ?? ''}`;
    });
    if (new Set(builds).size !== builds.length) {
        return { ranch, run: null, discarded: 'party-has-duplicate-species' };
    }

    return { ranch, run };
}

// ---------------------------------------------------------------------------------------------
// v4 is the floor — no migration (Henry, 2026-08-21)
// ---------------------------------------------------------------------------------------------

/**
 * **There is no v3 → v4 migration, by ruling.** Anything whose `version` is not 4 is discarded and
 * the game starts as if there were no save.
 *
 * The evidence that made this safe rather than reckless: **the repo contains no v3 player-save
 * fixtures at all.** Ticket 23's original text says "existing playtest saves in
 * `playtest-results/` are fixtures" — they are not saves. All 14 files there are **battle
 * snapshots** (`{"kind":"snapshot", ...}`), which go through `debug/scenarios/scenarioIO.ts` and
 * its own independent `registryHash` versioning, and are untouched by anything in this file. The
 * only v3 data that exists anywhere is whatever currently sits in Henry's own browser
 * `localStorage`.
 *
 * Writing a migration would therefore have meant writing, testing and maintaining a conversion for
 * a population of one save that its owner has explicitly said he does not want kept — and
 * inventing a blueprint count out of v3 data that structurally cannot express one (v3 deduplicated
 * blueprints on `architectureId`, the exact opposite of a consumable).
 *
 * **What ticket 23 should therefore DELETE rather than extend:**
 *
 * - The version-keyed upgrade function and its v1→v2 / v2→v3 branches (`SaveSystem.ts`, ~45 lines).
 * - The migration cases in `SaveSystem.test.ts` (20 tests today; the v1/v2/v3 chain goes).
 * - Its import and use in `debug/saveEdit.ts` (`parseSaveFileText`) — the debug save-editor's
 *   file-import path currently upgrades on read and would simply validate instead.
 *   `debug/saveSlots.ts` and `SaveSlotsPanel.tsx` document that path in comments and need the
 *   same edit.
 * - `SaveSlots.ts`'s legacy `mingming_save` adoption-by-copy, which exists to rescue pre-slot
 *   saves and has nothing left to rescue.
 *
 * **What it must ADD in exchange:** a deliberate "version is not 4" path that returns *no save*
 * rather than an error. That distinction is load-bearing — ticket 04's `loadGame` treats a parse
 * failure as corruption and keeps the last good save, which is exactly the wrong response to a v3
 * save that is supposed to be abandoned. A v3 save must read as "new player", not as "your save is
 * damaged".
 */
export function isSupportedSaveVersion(version: unknown): boolean {
    return version === SAVE_VERSION_V4;
}
