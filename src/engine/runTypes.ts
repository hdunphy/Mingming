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
    | 'elite'       // `economy-session.md`: ONE harder fight, the Driver visible as the stakes
    | 'alpha'       // `exploration-map.md`: one overtuned wild vs your full team, guards a rare blueprint
    | 'ambush'      // `exploration-map.md`: their 3 vs your 2, marked high-risk
    | 'marketplace' // buy cards / macros, sell cards, pay for removal
    | 'workshop'    // assemble a blueprint into the party, or reflash an OS
    | 'event'
    | 'gym';        // the region boss — a three-fight gauntlet, not a node you clear in one battle

export const NODE_KINDS = [
    'wild', 'elite', 'alpha', 'ambush', 'marketplace', 'workshop', 'event', 'gym',
] as const;

/**
 * `exploration-map.md`: "Map shape: an explorable GRAPH, explicitly NOT Spire's three lanes — you
 * find your way to the boss, with room to FARM if you don't feel ready."
 *
 * Two consequences the type has to carry that a lane model would not:
 *   - **`visited` is a count, not a boolean.** Farming means re-entering. A cleared wild node has
 *     to be able to say "you already took this one" without pretending it never happened.
 *   - **`edges` is a plain adjacency list, undirected in practice.** Backtracking is the farming
 *     affordance; a DAG would forbid it silently.
 */
export interface IRegionNode {
    readonly id: string;
    readonly kind: NodeKind;
    /** Which biome this node sits in — indexes into `IRunState.biomes`. */
    readonly biomeIndex: number;
    /** Node ids reachable from here. */
    readonly edges: ReadonlyArray<string>;
    /** Layout only. The graph's meaning is in `edges`; these are for drawing it (ticket 10). */
    readonly x: number;
    readonly y: number;
    /**
     * How many times the player has entered and resolved this node. 0 = never.
     * **[ASSUMED]** that a cleared node stays re-enterable (farming) but pays out less or nothing
     * the second time. The falloff rule is an economy question, not a data-model one — ticket 12.
     */
    readonly visited: number;
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

    /** The shared 3v3 deck, built up over the run. `economy-session.md` bite two. */
    readonly deck: ReadonlyArray<IRunCard>;

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
    edges: z.array(z.string()),
    x: z.number(),
    y: z.number(),
    visited: z.number().int().min(0),
});

export const RunCardSchema = z.object({
    instanceId: z.string(),
    dataId: z.string(),
    ownerId: z.string().nullable(),
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
    scrap: z.number().int().min(0),
    macros: z.tuple([z.string().nullable(), z.string().nullable(), z.string().nullable()]),
    drivers: z.array(z.string()),
    tier: z.number().int().min(0),
    modifiers: z.array(z.string()),
    phase: z.enum(['map', 'encounter', 'gauntlet', 'ended']),
    gauntlet: GauntletProgressSchema.nullable(),
    outcome: z.enum(['victory', 'defeat', 'abandoned']).nullable(),
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
    codex: CodexSchema.default({ seen: [], played: [] }),
    gymsCleared: z.array(z.string()).default([]),
    highestTierCleared: z.number().int().min(0).default(0),
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

    // Law 2: NO DUPLICATE SPECIES PER TEAM (map § Notes). First enforcement anywhere.
    const species = run.partyIds.map((id) => byId.get(id)!.definitionId);
    if (new Set(species).size !== species.length) {
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
 * - `migrateSave()` and its v1→v2 and v2→v3 branches (`SaveSystem.ts`, ~45 lines).
 * - The migration cases in `SaveSystem.test.ts` (20 tests today; the v1/v2/v3 chain goes).
 * - `migrateSave`'s import and use in `debug/saveEdit.ts:206` (`parseSaveFileText`) — the debug
 *   save-editor's file-import path currently migrates on read and would simply validate instead.
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
