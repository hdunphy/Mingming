/**
 * WHAT IS IN A NODE — ticket 11, part 2. The thing the map has been pointing at since ticket 07.
 *
 * # WHY THIS IS NOT `EncounterGenerator`
 *
 * `data/EncounterGenerator.ts` is the pre-run generator: give it an element and a player party and
 * it hands back "some enemies of that element with a themed pile of cards". It knows nothing about
 * a run, which is exactly right for the sector screen it was written for and exactly wrong now. A
 * run encounter is decided by four things that generator cannot see — the **node's kind** (a wild
 * and an ambush are different fights), the **biome's element** (the map's routing information), the
 * **biome's depth** (ticket 08's kit fraction), and the **visit count** (ticket 07's re-roll) — and
 * three of the four live in `IRunState`. So this module owns the run's answer and leaves the old
 * generator to the callers that still have no run: the gauntlet branch of `createBattleState` and
 * the debug paths.
 *
 * # THE THREE RULINGS THIS FILE IMPLEMENTS
 *
 * 1. **Ticket 07 — "entering a node triggers it again, always."** Contents are rolled at entry from
 *    the node's seed plus its visit count, so a second visit is honestly a second fight rather than
 *    a replay. `encounterSeed` is that rule, and it is the whole of it.
 * 2. **Ticket 11 — symmetric party size.** The enemy party matches yours, with two authored
 *    exceptions (`ambush`, `alpha`) that ticket 07 names in its own words.
 * 3. **Ticket 08, RULED — the enemy's deck is the player's kit fraction at that depth.** See
 *    `KIT_FRACTION_BY_BIOME`, which is the one place to tune it.
 *
 * And one ruling it deliberately does NOT implement: **ticket 21 froze the engine at
 * `CALIBRATION_LEVEL`**, so nothing here scales a stat, an IV range or an HP pool by depth. Biome 2
 * is harder than biome 0 because of the deck and the firmware in front of you, never because the
 * numbers grew. `encounter.test.ts` asserts that by building the same species at both depths and
 * comparing the entities.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()` — everything procedural threads through `SeedStream` so a node replays identically.
 */

import { SeedStream } from '../core/SeedStream';
import { getSectorSpecies } from '../data/EncounterGenerator';
import { GetMingmingData, PLAYABLE_SPECIES, getDeckForOS } from '../data/mingmingRegistry';
import { initializeBattleEntity } from '../types';
import type { Element, EnemyCombatMode, IBattleEntity, IMingmingState } from '../types';
import type { IRegionNode, IRunState, NodeKind } from '../runTypes';
import { START_KIT_SIZE, startDeckFor, startKitIdsFor } from './createRun';
import { nodeSeed } from './nodeSeed';

// ---------------------------------------------------------------------------------------------
// Which nodes are a fight
// ---------------------------------------------------------------------------------------------

/**
 * The kinds that start a battle on entry.
 *
 * `marketplace`, `workshop` and `event` are the other three, and they belong to tickets 13, 14 and
 * 30. They are not listed as a "not yet" set anywhere, because the moment one of them ships it
 * stops being a fight-or-nothing question and becomes its own node handler — the honest shape is a
 * positive list of what fights, and everything else routed by kind.
 *
 * This lives in the engine rather than in `ui/screens/regionLayout.ts` (which used to own the same
 * list for its element badge) because it is now load-bearing in two places that must agree: the
 * reducer that decides whether entering a node puts the run into `phase: 'encounter'`, and this
 * module's sizing rules. Two copies of that list would be a bug waiting for the day someone adds a
 * ninth kind.
 */
/*
 * **`gym` is in this list but it is not rolled by this module** — ticket 18. The gym is a fight kind
 * (walking onto it puts the run into `phase: 'encounter'`, which is what starts the trigger), but
 * what it starts is a three-fight gauntlet: `RunScreen` hands that arm to `runSlice.beginGauntlet`
 * and the fights themselves are rolled by `engine/run/gauntlet.rollGauntletFight`. Removing it from
 * this list would make entering the gym do nothing at all, which is why it stays.
 */
export const FIGHT_KINDS: ReadonlyArray<NodeKind> = ['wild', 'elite', 'alpha', 'ambush', 'gym'];

export function isFightNode(kind: NodeKind): boolean {
    return FIGHT_KINDS.includes(kind);
}

/**
 * How the enemy side fights in a run encounter.
 *
 * **This is a call ticket 11 had to make and it is one line so it can be unmade.** The engine
 * defaults to `'MOVES'` (telegraphed intents, no cards), which is what the pre-run sector fights
 * used. Ticket 08's ruling below is entirely about what is in the **enemy's deck** at each depth,
 * and a `MOVES` enemy is never dealt a hand — `createBattleState` builds its drawpile only under
 * `'CARDS'` — so under `MOVES` the ruled kit fraction would be computed, stored and never played.
 * The balance corpus that the fraction is calibrated against (`debug/balance`) is `'CARDS'` on both
 * sides too, so `CARDS` is also what makes "the tuned deck is the late-run reference" a true
 * statement rather than an aspiration.
 */
export const RUN_ENEMY_MODE: EnemyCombatMode = 'CARDS';

// ---------------------------------------------------------------------------------------------
// Party size (ticket 11, with ticket 07's two exceptions)
// ---------------------------------------------------------------------------------------------

/**
 * `exploration-map.md` puts a hard ceiling of three on a side, so an ambush against a full party
 * cannot be four — it is simply an even fight you were told was dangerous.
 */
export const MAX_PARTY_SIZE = 3;

/**
 * How many enemies a node fields.
 *
 * **Symmetric by default (ticket 11).** `generateEncounter` rolled `1..playerParty.length`, which
 * meant a three-member party spent a third of its wild fights against a single enemy — a rounding
 * error dressed as variance, and the reason the pre-run game's difficulty read as random. A run's
 * ordinary fight is now the same size as your team, every time, and the *shape* of the fight is
 * what varies.
 *
 * **Two authored exceptions, both quoted from ticket 07:**
 *
 * - `ambush` is *"their 3 vs your 2"* — one more than you, capped at three.
 * - `alpha` is *"one overtuned wild vs your full team"* — always exactly one.
 *
 * **Both are flagged for ticket 17.** Counting bodies is all this ticket does: an alpha with a
 * one-member deck and no firmware is currently *easier* than the wild next to it, not the
 * blueprint-guarding boss `exploration-map.md` describes, and an ambush is only dangerous in
 * proportion to how much the extra body is actually carrying. Ticket 17 (danger tuning) is where
 * "overtuned" gets a number. Getting the counts right here is what that ticket builds on.
 */
export function enemyPartySize(kind: NodeKind, playerPartySize: number): number {
    if (kind === 'alpha') return 1;
    if (kind === 'ambush') return Math.min(playerPartySize + 1, MAX_PARTY_SIZE);
    // A zero-member party cannot happen in play (`createBattleState` throws on one) but a battle
    // with no enemies renders a ghost arena, so the floor is one rather than a mirror of nothing.
    return Math.max(1, playerPartySize);
}

// ---------------------------------------------------------------------------------------------
// The kit fraction (ticket 08, RULED by Henry 2026-08-21)
// ---------------------------------------------------------------------------------------------

/**
 * How an enemy's deck is composed. The three values are the three rows of ticket 08's table, in
 * depth order.
 */
export type EnemyDeckRule =
    /** The same 8 the player starts with: 5 `startKit` cards + 3 generics (`createRun.startDeckFor`). */
    | 'start-kit-plus-generics'
    /** The 5 `startKit` cards alone — a sharper list than the player's, and shorter. */
    | 'start-kit'
    /** The full tuned per-OS deck (`getDeckForOS`) — the list the balance corpus is calibrated on. */
    | 'tuned';

export interface IKitFraction {
    readonly deck: EnemyDeckRule;
    /**
     * Whether the enemy runs its firmware. `false` means the built entity carries **no `activeOS`
     * at all**, so `OSSystem` wires no hooks for it.
     *
     * Expressing "no OS" needed care: `initializeBattleEntity` resolves a missing `activeOS` to
     * `definition.availableOS[0]`, so an `IMingmingState` with the field left off comes out of the
     * factory running its default firmware — the opposite of what this flag says. The OS is
     * therefore cleared on the **built entity**, after the factory has had its say, which is the
     * same technique `createBattleState` already uses to strip OS from intent-driven enemies.
     */
    readonly os: boolean;
}

/**
 * **THE ONE KNOB. Ticket 08's ruled table, indexed by biome depth.**
 *
 * | biome | enemy deck | OS |
 * |---|---|---|
 * | 0 | 4 `startKit` + 2 generics — the same 6 the player opens with (ticket 60) | no |
 * | 1 | the species' `startKit` | yes |
 * | 2 (and the gym) | the full tuned per-OS deck | yes |
 *
 * **Why this shape rather than a difficulty multiplier**, which is the point of the ruling and the
 * reason it is worth a table at all. Every deck in `mingmingRegistry` was tuned as a *complete*
 * list against other complete lists — that is what the 1v1 and 3v3 balance corpus measures. If the
 * final biome fields those tuned decks, then the corpus becomes the **late-run** reference point
 * rather than an average the run wobbles around, and everything earlier is easier *by construction*
 * — the biome-0 enemy is beatable because it is holding the same six cards you are, not because a
 * hidden coefficient scaled its damage down. Difficulty is a deck, exactly as `vision.md` demands
 * ("never bigger numbers"), and it is legible: the player can read the enemy's hand and see why the
 * fight got harder.
 *
 * Tuning this is editing this array. Nothing else in the file branches on depth.
 */
export const KIT_FRACTION_BY_BIOME: ReadonlyArray<IKitFraction> = [
    { deck: 'start-kit-plus-generics', os: false },
    { deck: 'start-kit', os: true },
    { deck: 'tuned', os: true },
];

/** The deepest rule, and what anything off the end of the table falls back to. */
export const FULL_KIT_FRACTION: IKitFraction = KIT_FRACTION_BY_BIOME[KIT_FRACTION_BY_BIOME.length - 1];

/**
 * The rule a given node fights under.
 *
 * **Elites use the deepest rule regardless of depth, and this is a READING, not a ruling** — no
 * ticket says it in so many words and it should be confirmed. The argument: ticket 07 makes the
 * elite every biome's unavoidable exit, `economy-session.md` makes it "ONE harder fight" with a
 * Driver visible as the stakes, and a biome-0 elite under the biome-0 rule would be the exam
 * written in the same six cards as the practice questions — harder only by having one more body
 * on the field. Facing a complete tuned deck for the first time at the end of biome 0 is what makes
 * the elite legible as a checkpoint, and it is the same lesson the gym asks for twice more later.
 *
 * The gym takes it too, for the plainer reason that it is the run's final exam. **Ticket 18 leans on
 * that clause from outside**: `rollGauntletFight` builds all three gauntlet fights with full tuned
 * decks and firmware *because* this function pins a gym node to the deepest row, and
 * `gauntlet.test.ts` asserts the two agree rather than letting the gauntlet hold its own opinion
 * about the gym's depth.
 */
export function kitFractionFor(node: IRegionNode): IKitFraction {
    if (node.kind === 'elite' || node.kind === 'gym') return FULL_KIT_FRACTION;
    return KIT_FRACTION_BY_BIOME[node.biomeIndex] ?? FULL_KIT_FRACTION;
}

// ---------------------------------------------------------------------------------------------
// The opening fight (ticket 24, re-ruled by Henry 2026-08-23)
// ---------------------------------------------------------------------------------------------

/**
 * Is this the run's opening fight — the scripted easy one?
 *
 * # THE RULING
 *
 * > *"it's fine to script the first encounter to an easy fight like slay the spire"* — Henry,
 * > 2026-08-23.
 *
 * Slay the Spire draws Act 1's opening encounters from a separate easy pool **every run**, not only
 * on a player's first. That is the model, and adopting it wholesale is what makes this three lines
 * instead of a feature:
 *
 * - the gate is `fightsResolved === 0` and nothing else — no flag, no modifier, no save field;
 * - it is **not** coupled to the tutorial. Ticket 24's first version keyed it off `seenTips`, which
 *   meant pressing "Skip tips" silently made your first fight harder. Henry rejected that
 *   explicitly, and the coupling is gone rather than patched.
 *
 * # WHAT THE SCRIPT ACTUALLY IS
 *
 * A floor made of rules that already exist, not authored content:
 *
 * - the enemy deck is pinned to `KIT_FRACTION_BY_BIOME[0]` — the same six cards the player is
 *   holding, no firmware — rather than whatever the node's depth or kind would give it;
 * - the enemy party is pinned to **one** body.
 *
 * Everything else is untouched: same seed, same species pool, same IVs. Where the node was already
 * gentle the softened roll and the ordinary roll are byte-identical, and a test asserts exactly
 * that, so this can never quietly become a second difficulty curve. Difficulty is still a deck —
 * `vision.md`'s "never bigger numbers" holds in both directions.
 *
 * **What it is NOT is Epic8's "Initiation".** That design picks the opponent's element to *counter*
 * the player's starter, and ticket 07 made it unbuildable: the biome's element is the promise the
 * map makes (`encounterSpeciesPool`), and the player chose that biome two screens earlier on the gym
 * offer. An opponent whose element is chosen to punish them is an opponent the map lied about.
 *
 * # WHY IT IS NEEDED AT ALL
 *
 * Because without it the opening fight is whatever the map roll says. `generateRegionGraph` used to
 * assign biome-0 layer-1 kinds from a pool containing `elite`, and an elite takes `FULL_KIT_FRACTION`
 * regardless of depth — so a brand-new player with one mingming and eight cards could meet a complete
 * tuned per-OS deck as their first fight ever. An `ambush` there is two enemies against their one.
 * The generator now pins that layer to `wild` (the other half of the Slay the Spire model: the first
 * room is always a fight), and this pins what is *in* it.
 */
export function isOpeningFight(run: IRunState): boolean {
    return run.fightsResolved === 0;
}

// ---------------------------------------------------------------------------------------------
// The seed (ticket 07)
// ---------------------------------------------------------------------------------------------

/**
 * The seed a fight's contents are rolled from: **run seed + node id + visit count**.
 *
 * All three parts are load-bearing. The run seed makes a whole run replayable from one string
 * (ticket 23's resume contract). The node id keeps two nodes entered at the same moment from
 * fielding the same enemies. The **visit count** is ticket 07's re-roll — `visited` is a count and
 * not a flag precisely so that walking back into a wild you already cleared rolls a genuinely
 * different fight instead of replaying a cached one. Farming is fine; farming the same three
 * enemies forever is not.
 *
 * `node` must already be visit-incremented — the count that identifies *this* entry is the one
 * after the increment. `runSlice.enterNode` does the increment, and the caller reads the node back
 * out of the updated run.
 *
 * **The derivation itself moved to `nodeSeed.ts` under ticket 13**, which added a second thing a
 * node can contain (a marketplace's stock) that has to re-roll on re-entry by the same rule. The
 * string is unchanged — this is `nodeSeed(run, node, 'encounter')` — so every fight that has ever
 * been rolled from a stored run still rolls identically.
 */
export function encounterSeed(run: IRunState, node: IRegionNode): string {
    return nodeSeed(run, node, 'encounter');
}

// ---------------------------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------------------------

/** Elements already warned about, so a three-enemy fight does not print the same line three times. */
const warnedEmptyPools = new Set<string>();

/**
 * The species a node can field: **the biome's own element**, which is the promise the map makes.
 *
 * `IBiome.elements` is a 1-or-2 list. Ticket 05 makes it mono at Early Access, but the type admits
 * a friendly pair because ticket 05 defers them rather than cancelling them and save v4 has no
 * migration path — so this unions the pools rather than reading `elements[0]` and pretending. Order
 * is the biome's order and duplicates are dropped, so a pair biome draws from both halves evenly
 * rather than twice from whatever overlaps.
 */
export function encounterSpeciesPool(run: IRunState, node: IRegionNode): string[] {
    const elements = run.biomes[node.biomeIndex]?.elements ?? [];

    const ids: string[] = [];
    for (const element of elements) {
        for (const definition of getSectorSpecies(element as Element)) {
            if (!ids.includes(definition.id)) ids.push(definition.id);
        }
    }

    if (ids.length > 0) return ids;

    // A biome whose element has no wild species is a content gap, not a crash: the registry is
    // still filling out (ticket 05 ships 6 of 16 species) and a run that soft-locks on an empty
    // pool is worse than a run that fields something off-element and says so out loud.
    const label = elements.join('/') || '(none)';
    if (!warnedEmptyPools.has(label)) {
        warnedEmptyPools.add(label);
        console.warn(
            `[ticket 11] Biome element "${label}" has no wild species; falling back to the whole ` +
            `playable roster for node ${node.id}. Encounters here will be off-element.`,
        );
    }
    return [...PLAYABLE_SPECIES];
}

// ---------------------------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------------------------

export interface EncounterInput {
    readonly run: IRunState;
    /** The node just entered, **already visit-incremented** — see `encounterSeed`. */
    readonly node: IRegionNode;
    /** The player's party, resolved against the ranch roster (`battleSetup.toMingmingState`). */
    readonly party: ReadonlyArray<IMingmingState>;
}

export interface IRunEncounter {
    readonly enemyParty: ReadonlyArray<IBattleEntity>;
    /** The enemy side's shared deck, as dataIds — one contribution per enemy, same as the player's. */
    readonly enemyDeckIds: ReadonlyArray<string>;
    /** `encounterSeed`, handed on as the battle's seed so the whole fight replays from the node. */
    readonly seed: string;
}

/**
 * What the enemy is holding, under the rule for this depth.
 *
 * `start-kit-plus-generics` calls `startDeckFor` rather than re-listing "4 kit + 2 generics",
 * because the claim is *"the same six the player starts with"* — and a second copy of
 * that composition would be a second thing to keep true. The minted `IRunCard` wrappers are thrown
 * away and only the dataIds kept: an enemy deck has no owner and no instance identity, and
 * `createBattleState` instantiates its own card entities anyway.
 */
function enemyDeckFor(state: IMingmingState, fraction: IKitFraction, stream: SeedStream): string[] {
    switch (fraction.deck) {
        case 'start-kit-plus-generics':
            return startDeckFor(state, stream).map((card) => card.dataId);
        case 'start-kit':
            return [...startKitIdsFor(state, START_KIT_SIZE)];
        case 'tuned':
            return getDeckForOS(state.definitionId, state.activeOS);
    }
}

/**
 * Roll what is in a node. Pure, and deterministic in (`run.seed`, `node.id`, `node.visited`).
 *
 * **The two streams are forked apart on purpose.** Everything about *who* the enemies are — species,
 * IVs, firmware — is drawn from one stream, and the deck minting from another, so that changing the
 * kit fraction cannot shift which enemies appear. Without that split, `start-kit-plus-generics`
 * (which mints card instance ids) and `tuned` (which does not) would leave the shared stream at
 * different positions, and the second enemy of a biome-0 fight would be a different species from
 * the second enemy of the same fight at biome 2 — which would make ticket 21's "no scaling by
 * depth" untestable, because there would be no "same encounter at two depths" to compare.
 */
export function rollEncounter(input: EncounterInput): IRunEncounter {
    const { run, node, party } = input;

    const seed = encounterSeed(run, node);
    const roster = new SeedStream(new SeedStream(seed).fork('enemy-roster'));
    const decks = new SeedStream(new SeedStream(seed).fork('enemy-deck'));

    // Ticket 24: every run's opening fight is the scripted easy one (Slay the Spire's model, ruled
    // 2026-08-23) — pinned to the gentlest row of ticket 08's table and to a single body. See
    // `isOpeningFight` for why this is a floor on the fight rather than a rewrite of it.
    const opening = isOpeningFight(run);
    const fraction = opening ? KIT_FRACTION_BY_BIOME[0] : kitFractionFor(node);
    const pool = encounterSpeciesPool(run, node);
    const size = opening ? 1 : enemyPartySize(node.kind, party.length);

    const enemyParty: IBattleEntity[] = [];
    const enemyDeckIds: string[] = [];

    for (let i = 0; i < size; i += 1) {
        const definitionId = pool[roster.nextInt(0, pool.length - 1)];
        const definition = GetMingmingData(definitionId);

        // Ticket 21: IVs are the ONLY per-individual variance left, and their range is the same at
        // every depth. A biome-2 enemy is not rolled hotter than a biome-0 one; 10-31 is the same
        // band `generateEncounter` used, kept so the two paths field comparable individuals.
        const hpIV = roster.nextInt(10, 31);
        const attackIV = roster.nextInt(10, 31);
        const defenseIV = roster.nextInt(10, 31);

        // Rolled even when the fraction says no OS, and deliberately: the `startKit` tags are keyed
        // by firmware, so a biome-0 enemy still needs a firmware to have chosen its five cards
        // FROM, it just does not get to run it. Drawing it unconditionally also keeps the stream
        // position identical across depths, which is what the no-scaling test compares.
        const activeOS = definition.availableOS[roster.nextInt(0, definition.availableOS.length - 1)];

        const state: IMingmingState = {
            id: roster.nextId(`enemy_${definitionId}`),
            definitionId,
            nickname: `Wild ${definition.name}`,
            activeOS,
            blueprintsCollected: 0,
            hpIV,
            attackIV,
            defenseIV,
        };

        const entity = initializeBattleEntity(state, definition);
        enemyParty.push(fraction.os ? entity : { ...entity, activeOS: undefined });
        enemyDeckIds.push(...enemyDeckFor(state, fraction, decks));
    }

    return { enemyParty, enemyDeckIds, seed };
}
