/**
 * WHAT IS IN A NODE — ticket 11, part 2. The thing the map has been pointing at since ticket 07.
 *
 * # WHY THIS IS NOT `EncounterGenerator`
 *
 * `data/EncounterGenerator.ts` is the pre-run generator: give it an element and a player party and
 * it hands back "some enemies of that element with a themed pile of cards". It knows nothing about
 * a run, which is exactly right for the sector screen it was written for and exactly wrong now. A
 * run encounter is decided by four things that generator cannot see — the **node's kind** (a wild
 * and an ambush are different fights, and since ticket 60 they are different LADDER RUNGS), the
 * **biome's element** (the map's routing information), the run's **tier**, and the **visit count**
 * (ticket 07's re-roll) — and all four live in `IRunState`. So this module owns the run's answer and leaves the old
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
 * 3. **Ticket 60, RULED — the enemy LADDER.** Every enemy holds the full tuned deck; what a rung
 *    raises is how well it plays it (firmware, then lookahead), and the tier raises the wild rung.
 *    See `ENEMY_LADDER`, which is the one place to tune it. It replaced ticket 08's kit-fraction
 *    table, indexed by biome depth — the run gate measured that table making the MIDDLE of a run
 *    its hardest part, which is the argument written out in full above `ENEMY_LADDER`.
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
import type { AiTier } from '../ai/TacticalAI';
import { getSectorSpecies } from '../data/EncounterGenerator';
import { GetMingmingData, PLAYABLE_SPECIES, getDeckForOS } from '../data/mingmingRegistry';
import { initializeBattleEntity } from '../types';
import type { Element, EnemyCombatMode, IBattleEntity, IMingmingState } from '../types';
import type { IRegionNode, IRunState, NodeKind } from '../runTypes';
import { authoredBossFor } from './bosses';
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
    /** The same the player starts with: 4 `startKit` cards, plus the run's 2 generics on the first. */
    | 'start-kit-plus-generics'
    /** The 5 `startKit` cards alone — a sharper list than the player's, and shorter. */
    | 'start-kit'
    /** The full tuned per-OS deck (`getDeckForOS`) — the list the balance corpus is calibrated on. */
    | 'tuned';

/**
 * One rung of the ladder: everything about an enemy that is not its species or its stat roll.
 *
 * `os: false` means the built entity carries **no `activeOS` at all**, so `OSSystem` wires no hooks
 * for it. Expressing that needed care: `initializeBattleEntity` resolves a missing `activeOS` to
 * `definition.availableOS[0]`, so an `IMingmingState` with the field left off comes out of the
 * factory running its default firmware — the opposite of what this flag says. The OS is therefore
 * cleared on the **built entity**, after the factory has had its say, which is the same technique
 * `createBattleState` already uses to strip OS from intent-driven enemies.
 */
export interface IEnemyLoadout {
    readonly deck: EnemyDeckRule;
    readonly os: boolean;
    /** Which grade of `TacticalAI` plays it — see `IBattleState.enemyAiTier`. */
    readonly ai: AiTier;
    /** Inclusive IV band, both ends. See `IV_BANDS` for why each rung has its own. */
    readonly iv: readonly [number, number];
}

/**
 * **THE IV BANDS — RULED by Henry on ticket 67, 2026-08-26, and this is a FLIP.**
 *
 * The run gate measured it and it was the finding upstream of every band: the player rolls
 * `nextInt(0, 31)` (`gameTypes.createMingmingInstance`, mean 15.5) and **every enemy in the game
 * used to roll `nextInt(10, 31)`** — mean 20.5, with a floor the player has no equivalent of. Five
 * points of every stat, in the enemy's favour, everywhere, forever.
 *
 * Henry's ruling flips it, and the shape of the flip is the design:
 *
 * | rung | band | mean | why |
 * |---|---|---|---|
 * | wild | **0–20** | 10 | *below* the player's 15.5. A bounded, tunable edge to the player, and no more god-roll wilds wiping an early run. |
 * | elite | **0–31 uncapped** | 15.5 | level with the player. *"Elite variance is the elite's spice"* — the elite is the biome's exam and it is allowed to roll hot. |
 * | boss | **fixed, authored** | — | not a band at all. See `gauntlet.BOSS_IVS`: a boss is exactly as hard as it is designed to be, and it is tuned by editing a number rather than by hoping. |
 *
 * The player's own 0–31 is unchanged. Note what this is NOT: it is not a difficulty multiplier and
 * it does not scale with depth — ticket 21's freeze holds, and a biome-2 wild rolls from the same
 * 0–20 a biome-0 wild does. What got harder later is the deck and the firmware, which is
 * `vision.md`'s "never bigger numbers" in the only form it allows.
 */
const WILD_IV: readonly [number, number] = [0, 20];
const ELITE_IV: readonly [number, number] = [0, 31];

/**
 * **THE ENEMY LADDER — ticket 60's ruling, built by ticket 67.**
 *
 * | rung | deck | OS | AI | IVs |
 * |---|---|---|---|---|
 * | wild | full tuned | **no** | greedy | 0–20 |
 * | elite | full tuned | yes | lite | 0–31 |
 * | gauntlet | full tuned | yes | **full lookahead** | 0–31, boss fixed |
 *
 * # WHAT THIS REPLACED, AND WHY THE REPLACEMENT IS A DIFFERENT KIND OF THING
 *
 * `KIT_FRACTION_BY_BIOME` — ticket 08's table, indexed by **biome depth**: biome 0 fought with the
 * six cards the player opened with, biome 1 with the bare start kit, biome 2 with the tuned deck.
 * Ticket 60 killed it and the run gate said why. Difficulty was **not monotonic in the thing the
 * table indexed on**: biome 1 wilds measured 26.7% against biome 2's 50.0% and biome 0's 67.1%,
 * because the middle row fields five pure engine cards per body with no filler — a *sharper* list
 * than the tuned one, not a weaker one. A table that made the middle of the run the hardest part of
 * it was tuning the wrong axis.
 *
 * So depth stops being the axis entirely. **Every enemy in the game now holds the full tuned deck**
 * — the list the balance corpus is calibrated on, so the corpus is the reference point for every
 * fight rather than for one biome — and what a rung raises is **how well the enemy plays it**: no
 * firmware and no lookahead at a wild, firmware and a narrowed lookahead at an elite, both and the
 * full lookahead at the gym.
 *
 * That is still difficulty-as-a-deck in `vision.md`'s sense, and it is arguably more legible than
 * the table was: the player can read a wild's hand and see the same cards a gym leader holds, and
 * lose to the gym leader because the gym leader plays them better.
 *
 * # THE GRADE IS BY NODE KIND, NOT BY DEPTH
 *
 * `elite` is the elite rung wherever it stands, which the old table had to say as a special case
 * (*"elites use the deepest rule regardless of depth"*). It falls out of the shape now. `gym` is the
 * gauntlet rung, and `gauntlet.rollGauntletFight` reads this table rather than holding a second
 * opinion. Everything else — `wild`, `ambush`, `alpha` — is a wild: the two authored exceptions vary
 * the enemy COUNT (`enemyPartySize`), which is ticket 07's own way of making them special, and
 * giving them a fourth rung as well would be two knobs for one idea.
 */
export const ENEMY_LADDER: Readonly<Record<EnemyGrade, IEnemyLoadout>> = {
    wild: { deck: 'tuned', os: false, ai: 'greedy', iv: WILD_IV },
    elite: { deck: 'tuned', os: true, ai: 'lite', iv: ELITE_IV },
    gauntlet: { deck: 'tuned', os: true, ai: 'full', iv: ELITE_IV },
};

/** The three rungs. Named rather than inferred, so a fourth is a deliberate act. */
export type EnemyGrade = 'wild' | 'elite' | 'gauntlet';

/** Which rung a node fights under, before the tier has its say. */
export function gradeFor(kind: NodeKind): EnemyGrade {
    if (kind === 'elite') return 'elite';
    if (kind === 'gym') return 'gauntlet';
    return 'wild';
}

/**
 * **THE TIER RAISES THE WILD RUNG, AND NOTHING ELSE** — ticket 60: *"tier 2 = wild OS on; tier 3 =
 * wild AI lite"*, and `exploration-map.md`'s standing law that *"harder tiers unlock by beating
 * gyms — meaner curated teams, more elites, enemy relics; never bigger numbers."*
 *
 * Only the wild moves, and that is the point rather than an omission: an elite already runs its
 * firmware and a gauntlet already thinks a turn ahead, so there is nothing left to give them without
 * reaching for a number. A tier makes the ORDINARY fight play like the exam did one tier ago, which
 * is a difficulty curve made of the same three grades the player has already met.
 *
 * Tiers are cumulative and clamped: tier 3 and above is the top rung, because there is no fourth
 * grade and inventing one here would be a scaling knob wearing a ladder's clothes.
 */
export function enemyLoadoutFor(kind: NodeKind, tier: number): IEnemyLoadout {
    const grade = gradeFor(kind);
    const base = ENEMY_LADDER[grade];
    if (grade !== 'wild') return base;
    if (tier >= 3) return { ...base, os: true, ai: 'lite' };
    if (tier >= 2) return { ...base, os: true };
    return base;
}

/**
 * The scripted opening fight's loadout — ticket 24, and the one rung that is not on the ladder.
 *
 * It kept working by accident while `KIT_FRACTION_BY_BIOME[0]` existed, because that row happened to
 * say what the script wanted. The table is gone, so the script says it itself: **the same cards the
 * player is holding, no firmware, and the gentlest AI**. That is ticket 24's ruling verbatim
 * (*"the enemy deck is pinned to the same six cards the player is holding, no firmware"*), and
 * writing it here rather than pointing at a row means a later ladder edit cannot silently make a
 * brand-new player's first fight harder.
 */
export const OPENING_FIGHT_LOADOUT: IEnemyLoadout = {
    deck: 'start-kit-plus-generics',
    os: false,
    ai: 'greedy',
    iv: WILD_IV,
};

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
    /**
     * Which grade of `TacticalAI` this fight's enemies play at — the ladder's third column.
     *
     * Carried on the encounter rather than re-derived at the screen, because the screen would have
     * to know the node kind, the tier AND the opening-fight rule to get it right, and one of those
     * three is exactly the sort of thing that drifts. `RunScreen` and `GauntletNode` hand it
     * straight to `startBattle` as `options.enemyAiTier`.
     */
    readonly enemyAiTier: AiTier;
    /**
     * TICKET 68 — the Drivers this fight's enemy SIDE runs, if any.
     *
     * Carried here for the same reason `enemyAiTier` is: the fight is decided in this module, and a
     * screen that re-derived it would have to know the run's gym, the node's kind and the biome
     * index to get it right. `buildBattleSetup` copies it onto `IBattleSetup.enemyDrivers` and
     * `createBattleState` applies it; nothing in between has an opinion about it.
     *
     * Absent on almost every fight — Emberfall's third gauntlet fight and the elites guarding its
     * approach are the whole of it today. See `IBattleSetup.enemyDrivers` for why absent rather than
     * empty.
     */
    readonly enemyDrivers?: ReadonlyArray<string>;
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
function enemyDeckFor(
    state: IMingmingState,
    loadout: IEnemyLoadout,
    stream: SeedStream,
    isFirstEnemy: boolean,
): string[] {
    switch (loadout.deck) {
        case 'start-kit-plus-generics':
            // `true`: an enemy party's first member carries the generics, exactly as the
            // player's does. The symmetry is the whole claim of this loadout — "the same cards you
            // opened with" is only true if the filler rule is the same one.
            return startDeckFor(state, stream, isFirstEnemy).map((card) => card.dataId);
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
/**
 * TICKET 68, ruling 4 — **the telegraph's second half.** The elites guarding the approach to the
 * gauntlet run the gym's own Driver, unmodified.
 *
 * The offer screen tells you the rule at run start; this is where you meet it. Reading about an
 * escalating aura and *fighting* one are different kinds of knowledge, and a boss whose central rule
 * the player has already had to solve once is a boss they lose to for a reason they can name.
 *
 * # WHICH ELITES, AND THE PART THAT IS A READING RATHER THAN A RULING
 *
 * Ruling 4 says *"the region's FINAL elite - the one guarding the gauntlet approach"*, in the
 * singular. **The region graph has no such node.** `REGION_PARAMS` makes each biome's EXIT an elite
 * except the last, whose exit is the gym itself (`finalBiomeExitKind`), so the final biome has no
 * exit elite to be — its elites are middle nodes rolled from the weighted pool, and there may be
 * two, one, or none.
 *
 * Two readings survive that, and this function implements the second:
 *
 * 1. *The last guaranteed elite in the run* — biome 1's exit. Exactly one per run, unavoidable, but
 *    a whole biome away from the gym, which is not "guarding the gauntlet approach".
 * 2. *The elites in the gym's own biome* — what this is. They are literally the fights standing
 *    between the player and the gauntlet, which is what the clause describes, and they serve the
 *    stated purpose (meet the rule before the boss does) where reading 1 barely does.
 *
 * The cost of reading 2 is that a graph can roll a final biome with no elite in it, and that run
 * gets the offer-screen half of the telegraph only. **FLAGGED FOR HENRY** in the ticket's
 * resolution with the measured frequency; flipping to reading 1 is this function and nothing else.
 *
 * Un-authored gyms (Tidewrack, Rootfall — ruling 6) have no Driver to carry, so their elites are
 * untouched. Nothing here changes an elite's deck, firmware, IVs or AI grade: ruling 4 says the
 * Driver runs *unmodified*, and a rung that also got a stat bump would make ticket 67's elite band
 * unreadable against its own history.
 */
export function gymDriverForNode(run: IRunState, node: IRegionNode): string | undefined {
    if (node.kind !== 'elite') return undefined;
    if (node.biomeIndex !== run.biomes.length - 1) return undefined;
    return authoredBossFor(run.gymId)?.driver;
}

export function rollEncounter(input: EncounterInput): IRunEncounter {
    const { run, node, party } = input;

    const seed = encounterSeed(run, node);
    const roster = new SeedStream(new SeedStream(seed).fork('enemy-roster'));
    const decks = new SeedStream(new SeedStream(seed).fork('enemy-deck'));

    // Ticket 24: every run's opening fight is the scripted easy one (Slay the Spire's model, ruled
    // 2026-08-23) — pinned to its own gentle loadout and to a single body. See `isOpeningFight` for
    // why this is a floor on the fight rather than a rewrite of it.
    const opening = isOpeningFight(run);
    const loadout = opening ? OPENING_FIGHT_LOADOUT : enemyLoadoutFor(node.kind, run.tier);
    const pool = encounterSpeciesPool(run, node);
    const size = opening ? 1 : enemyPartySize(node.kind, party.length);

    const enemyParty: IBattleEntity[] = [];
    const enemyDeckIds: string[] = [];

    for (let i = 0; i < size; i += 1) {
        const definitionId = pool[roster.nextInt(0, pool.length - 1)];
        const definition = GetMingmingData(definitionId);

        // Ticket 21: IVs are the ONLY per-individual variance left, and their range is the same at
        // every DEPTH — a biome-2 wild rolls from the same band a biome-0 wild does, which is what
        // makes "no scaling by depth" testable. What varies is the RUNG (ticket 67's flip): a wild
        // rolls 0-20, below the player's 15.5 mean; an elite rolls the player's own 0-31.
        const [ivLow, ivHigh] = loadout.iv;
        const hpIV = roster.nextInt(ivLow, ivHigh);
        const attackIV = roster.nextInt(ivLow, ivHigh);
        const defenseIV = roster.nextInt(ivLow, ivHigh);

        // Rolled even when the loadout says no OS, and deliberately: the `startKit` tags are keyed
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
        enemyParty.push(loadout.os ? entity : { ...entity, activeOS: undefined });
        enemyDeckIds.push(...enemyDeckFor(state, loadout, decks, enemyParty.length === 1));
    }

    // Ticket 68 ruling 4: the gym's Driver, on the elites guarding its approach and nowhere else.
    // Undefined for every wild, every elite outside the gym's biome, and every un-authored gym.
    const gymDriver = gymDriverForNode(run, node);

    return {
        enemyParty,
        enemyDeckIds,
        seed,
        enemyAiTier: loadout.ai,
        ...(gymDriver ? { enemyDrivers: [gymDriver] } : {}),
    };
}
