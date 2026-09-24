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
import { GAME_BEAM_WIDTH, type AiTier } from '../ai/TacticalAI';
import { getSectorSpecies } from '../data/EncounterGenerator';
import { GetMingmingData, PLAYABLE_SPECIES, getDeckForOS } from '../data/mingmingRegistry';
import { GetProgramData } from '../data/programRegistry';
import { initializeBattleEntity, numericBaseCost } from '../types';
import type { Element, EnemyCombatMode, IBattleEntity, IMingmingState } from '../types';
import type { IRegionNode, IRunState, NodeKind } from '../runTypes';
import { authoredBossFor } from './bosses';
import { GYM_REGISTRY, gymCompElementPlan, pathElementsFor, speciesOwningFirmware } from './gyms';
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
export const FIGHT_KINDS: ReadonlyArray<NodeKind> = ['wild', 'rival', 'elite', 'alpha', 'ambush', 'gym'];

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
    /**
     * TICKET 144 §2, RULED BY HENRY 2026-09-06: **the boss thinks at full depth; everything else
     * gets the beam.**
     *
     * The beam is a fourth column of this ladder rather than a global setting, and that is the
     * whole correction. Ticket 127 keyed it on "is this Node", which gave the game a beamed search
     * everywhere including its bosses. Measured at 3v3 (ticket 144 §2), the beam costs the side
     * that is winning about 12.5 points of win rate and adds 0.75 turns — it ranks candidates by
     * immediate score, so the first thing it stops seeing is the kill two plays out. That is a fine
     * trade for a wild you meet twenty times an hour; it is the wrong trade for the fight the whole
     * run was built to reach.
     *
     * 0 means beamless. `undefined` is not used here — every rung states its width, so a new rung
     * cannot inherit one by accident.
     */
    readonly beam: number;
    /** Inclusive IV band, both ends. See `IV_BANDS` for why each rung has its own. */
    readonly iv: readonly [number, number];
    /**
     * ── TICKET 152, RULED BY HENRY 2026-09-22 — A WILD MAY NOT HOLD TWO PURE CANTRIPS ────
     *
     * *"leave it, but remove the double undertow cards from all wild encounters. It should only be
     * in elites and bosses."*
     *
     * Ticket 111's law is *players may break decks; base enemy decks may not loop*, and the loop
     * needs exactly two things: a card that costs nothing and draws, and a SECOND COPY of it. The
     * 111 guard already holds the resolving instance out of a reshuffle so a card cannot draw
     * itself; it cannot stop two copies drawing each other. `undertow` A draws B, B's draw
     * reshuffles a discard holding A, A comes back. On a nine-card deck the pile cycles inside one
     * turn — measured at **≥6 casts in 12.7% of jormungandr_v1's turns, max 18**, and 16.8% of his
     * turns removing three quarters of a health pool.
     *
     * 152 tried two card swaps and both gutted the deck (69.6% field → 18–27% against a 47–64% peer
     * band), because the loop IS why he is at the top of the roster. Henry declined both, and
     * declined the engine fix that would have reached every deck. This is the third answer: the
     * deck keeps its shape, and the RUNG decides whether the player meets it.
     *
     * **False at a wild, true at an elite and a gauntlet.** The player meets a wild twenty times an
     * hour and an elite as the biome's exam; a turn that deletes a full-health recruit out of
     * nowhere is a boss's privilege, not a roadside encounter's.
     */
    readonly duplicateCantrips: boolean;
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
    wild: { deck: 'tuned', os: false, ai: 'greedy', iv: WILD_IV, beam: GAME_BEAM_WIDTH, duplicateCantrips: false },
    elite: { deck: 'tuned', os: true, ai: 'lite', iv: ELITE_IV, beam: GAME_BEAM_WIDTH, duplicateCantrips: true },
    // The gym. Beamless: the boss is the one fight worth the full search, and it is the one fight
    // a player meets once. See `IEnemyLoadout.beam`.
    gauntlet: { deck: 'tuned', os: true, ai: 'full', iv: ELITE_IV, beam: 0, duplicateCantrips: true },
};

/** The three rungs. Named rather than inferred, so a fourth is a deliberate act. */
export type EnemyGrade = 'wild' | 'elite' | 'gauntlet';

/** Which rung a node fights under, before the tier has its say. */
export function gradeFor(kind: NodeKind): EnemyGrade {
    if (kind === 'elite') return 'elite';
    if (kind === 'gym') return 'gauntlet';
    // Ticket 142a: a rival is a WILD. It fields different species, and nothing else about it moves
    // — same rung, same kit fraction, same AI, same blueprint rate. Giving the road a harder rung
    // as well would make "route toward the species you need" a cost rather than a choice.
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
    beam: GAME_BEAM_WIDTH,
    // Ticket 152: a wild's rule, and the opening fight is gentler than a wild by construction.
    // It is also moot here - `start-kit-plus-generics` holds no tuned deck to de-duplicate - but
    // stated rather than inherited, for the reason the docblock above gives about the ladder.
    duplicateCantrips: false,
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

/** The species a single element fields, in registry order. Shared by the pool and 142c's deal. */
function speciesOfElement(element: string): string[] {
    return getSectorSpecies(element as Element).map(d => d.id);
}
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
/**
 * TICKET 142c — WHICH ELEMENT EACH RIVAL BODY FIELDS, off-biome first.
 *
 * Henry, after the first Rootfall playtest: *"We should guarantee at least one 'off biome'
 * mingming. So the first is always the Nature in a fire biome (1v1 it's just nature); in 3v3 we can
 * coin flip the last one to make it NFN or NFF."*
 *
 * 142a shipped the pool as a flat UNION of the two path elements and drew every body from it
 * independently, which made the guarantee a coin flip: each path element holds two species out of
 * the four, so a solo player's rival was **50% an ordinary-looking on-biome fight** that dropped
 * the blueprint they already had. The node exists to break the map's grip on recruiting order, and
 * half the time it did not.
 *
 * So the first bodies are DEALT rather than rolled: one of each path element, the one that is NOT
 * this biome's element first, and only the bodies past that roll from the union.
 *
 * | biome (Rootfall, path Fire+Nature) | 1 body | 2 bodies | 3 bodies |
 * |---|---|---|---|
 * | 1, Nature | Fire | Fire, Nature | Fire, Nature, roll |
 * | 2, Fire | **Nature** | Nature, Fire | **N, F, roll → NFN or NFF** |
 * | 3, Water | Fire | Fire, Nature | Fire, Nature, roll |
 *
 * OFF-BIOME IS BIOME-RELATIVE, not "the counter element". For Rootfall the path is [Fire, Nature]
 * and it is FIRE that beats the leader — but standing in the Fire biome the body you cannot
 * otherwise get is the NATURE one, and in the Nature biome it is the Fire one. Ordering by the
 * biome rather than by the path is what makes one rule serve both. In the third biome neither path
 * element is the biome's, both are off-biome, and the path's own order stands.
 *
 * Returns `[]` for anything that is not a rival, which is every caller's signal to roll as before.
 */
export function rivalElementPlan(run: IRunState, node: IRegionNode, size: number): string[] {
    if (node.kind !== 'rival') return [];
    const path = pathElementsFor(GYM_REGISTRY[run.gymId]?.element ?? '');
    if (path.length === 0) return [];
    const biomeElements = run.biomes[node.biomeIndex]?.elements ?? [];
    const offBiome = path.filter(e => !biomeElements.includes(e));
    const onBiome = path.filter(e => biomeElements.includes(e));
    return [...offBiome, ...onBiome].slice(0, Math.max(0, size));
}
/**
 * THE APPROACH BIOME'S BODIES — ticket 142 §7, Henry 2026-09-11.
 *
 * *"It should be NNW decks so the last spot is a water mingming (either jorm or kraken). So you
 * only see the water in 3v3s — the first two are one of the four nature decks. If it's a 1v1 or
 * 2v2 it would be a single N then two N's respectively."*
 *
 * Same shape as `rivalElementPlan` and dealt by the same loop: one element per body, each filled
 * from that element's whole species pool, exactly one draw per body. `gymCompElementPlan` supplies
 * the order (gym element first, the off-element body last), and slicing it to the party size is
 * what makes a solo run meet one Nature and a full one meet the Water.
 *
 * Empty for every other node, which is the caller's signal to roll as before. The gym fight, the
 * scout and rivals each have their own rule and are all resolved before this one - the approach
 * biome governs the ORDINARY fights on it, not the set pieces standing in it.
 */
export function gymBiomeElementPlan(run: IRunState, node: IRegionNode, size: number): string[] {
    if (node.biomeIndex !== run.biomes.length - 1) return [];
    if (node.kind === 'gym' || node.kind === 'rival') return [];
    const gym = GYM_REGISTRY[run.gymId];
    if (!gym) return [];
    return [...gymCompElementPlan(gym)].slice(0, Math.max(0, size));
}
export function encounterSpeciesPool(run: IRunState, node: IRegionNode): string[] {
    // TICKET 142b — the scout fields the leader's own bodies, so its pool is the species behind
    // `gym.leaderComp` rather than an element at all. Ahead of the element branch because it is not
    // a narrowing of it: this fight is the exam, not the biome.
    const scoutSpecies = scoutSpeciesFor(run, node);
    if (scoutSpecies.length > 0) return scoutSpecies;

    // TICKET 142a — a rival fields the PATH species: what beats the gym, and the gym's own element.
    // The biome keeps its promise either way, because two wilds in three are still its element and
    // the exit elite always is.
    const elements = node.kind === 'rival'
        ? pathElementsFor(GYM_REGISTRY[run.gymId]?.element ?? '')
        : run.biomes[node.biomeIndex]?.elements ?? [];

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
     * TICKET 144 §2 — the beam width this fight's search runs at, from the same ladder row as
     * `enemyAiTier` above and carried for the same reason: the screen must not have to re-derive
     * it. `RunScreen` and `GauntletNode` hand it to `startBattle` as `options.aiBeam`.
     *
     * Bosses are beamless. See `IEnemyLoadout.beam`.
     */
    readonly aiBeam: number;
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
 * ── THE CARDS A WILD MAY NOT HOLD TWO OF — ticket 152, and this is a MEASURED list ──────
 *
 * It was a property test: *0 energy, draws, and does nothing else*. That lasted one day. The
 * third clause was justified by "there is no price that stops the third repetition", and the
 * 2026-09-23 brake measurement falsified it — `undertow` with a 15-power recoil, `forage`'s own
 * number, still chained **fourteen deep** in a turn and still removed three quarters of a health
 * pool once every thirteen turns. A price does not stop a loop whose payoff scales with the loop.
 *
 * Worse, the clause made the rule ESCAPABLE. Henry shipped a self-Weaken rider on `undertow` the
 * same day, and the card fell straight out of a rule written for it. A rule a card can wriggle
 * out of by gaining flavour is not a rule.
 *
 * So the obvious widening — drop the third clause, keep *0 energy and it draws* — was measured
 * too, and it is wrong in the other direction. That catches `forage`, and `forage` **does not
 * loop**: 1,200 games on ratatoskr_v1 put it at a maximum of 4 casts in a turn and 0.0% of turns
 * at six or more, against `undertow`'s max 18 and 12.7%. Removing a copy from ratatoskr_v1 costs
 * that deck **10.9 field points** and buys nothing.
 *
 * Card properties cannot separate them, because the difference is not in the card. `undertow`
 * chains on jormungandr_v1 because that deck holds `ink_stream` (scales on cards drawn this turn)
 * and `serpents_coil` (cards played this turn), so every iteration pays for itself several times
 * over. `forage` sits in decks that do not pay for drawing, so the AI never bothers.
 *
 * Hence a list, with the measurement beside each entry. That is not an arbitrary cap in the sense
 * Henry's standing rule forbids — the evidence IS the condition, and it is written down. What
 * keeps it honest is the tripwire in `encounter.test.ts`: every 0-energy card that draws must
 * appear in this set or in `MEASURED_NOT_LOOPING`, so a new cantrip fails a test until somebody
 * measures it and decides. A missed card becomes a conversation instead of a silent regression.
 */
export const LOOPING_FREE_DRAWS: ReadonlySet<string> = new Set([
    // max 18 casts in one turn, 12.7% of turns at >=6, on jormungandr_v1 (1,200 games).
    'undertow',
    // Same shape, same deck shape: sleipnir_v1 runs two and holds `stampede`, which scales on
    // cards played this turn. Not separately measured at depth; caught on the evidence that its
    // twin is the same card with a different name.
    'slipstream',
    // No shipped deck runs two, so this costs nothing today. Listed because it is the same card
    // again, and tickets 111/113 are the record of what it did when a deck could chain it.
    'glimmer',
    /*
     * TICKET 163a — **`ignite+` is a loop and its base is not.** This is the tripwire below doing
     * the job it was built for, on the first upgrade pass to reach it.
     *
     * Measured on ONE instrument so the two readings can be compared: `t149_castprobe` on
     * fenrir_v2 (two copies, the deck 162a measured the base on), 25 iterations against the 1v1
     * opponent set, base and `+` run back to back.
     *
     *     ignite    7.7% of turns at >=3, 0.3% at >=6, max 8   (results/t163/ignite__fenrir_v2.jsonl)
     *     ignite+  26.3% of turns at >=3, 23.1% at >=6, max 16 (results/t163/ignite_plus__fenrir_v2.jsonl)
     *
     * Seventy-seven times the rate at six or more, from a rule that only moved a number. The base
     * card draws IF THE TARGET WAS ALREADY BURNING, and at 1 Burn a cast that is a real condition:
     * the pile decays, so a turn often opens on a clean target and the first cast pays nothing.
     * At 2 Burn the target is burning essentially always, and the condition stops being one — the
     * upgrade did not make the cantrip bigger, it made it UNCONDITIONAL.
     *
     * CAPPING IT HERE IS NOT THE WHOLE ANSWER, and saying so is the point of this note. This list
     * governs the pile an ENEMY brings to a wild. The deck that loops is the PLAYER's, and 163b's
     * workshop is what puts `ignite+` in it — twice, since fenrir_v2 ships two copies. The cap is
     * the half that can be applied today; whether `ignite+` keeps this printing at all is Henry's,
     * and the write-up asks him.
     */
    'ignite+',
    /*
     * `undertow+` is here because its BASE is, not because the measurement asked for it. Same
     * probe, same deck (jormungandr_v1, both copies swapped):
     *
     *     undertow   0.3% of turns at >=3, 0.0% at >=6, max 4
     *     undertow+  0.0% of turns at >=3, 0.0% at >=6, max 2
     *
     * It loops LESS: the `+` rule doubled the self-Weakened and left the draw at one, so the
     * upgrade is a bigger brake on the same engine. (Both numbers sit below the 12.7%/max 18 that
     * ticket 152 published, because that was a different harness — which is exactly why the base
     * was re-run here rather than compared across instruments.) Uncapping a card whose base is
     * capped is a ruling, not a build step, so it inherits the cap and the reading is on file.
     */
    'undertow+',
]);

/**
 * 0-energy draws that were measured and are NOT capped, with the number that says why.
 *
 * `forage` is "draw 1, take 15 power". 1,200 games on ratatoskr_v1: **max 4 casts in a turn, 0.0%
 * of turns at six or more**. Capping it would cost that deck 10.9 field points against a loop it
 * has never run.
 *
 * `ignite` joined it under ticket 162a, which gave the card a conditional cantrip — *"apply 1 Burn;
 * if the target was ALREADY Burning, draw a card"*. That makes it a 0-energy card that draws, so
 * the tripwire below stopped the build until somebody measured it. Measured, 1,200 games on
 * fenrir_v2 (the deck that runs two copies and the most Burn in the roster): **max 8 casts in a
 * turn, 0.3% of turns at six or more**, against `undertow`'s max 18 and 12.7%.
 *
 * The number that actually settles it is the one the wild rule exists for — the deletion turn.
 * fenrir_v2's worst turn is **85.5% of a health pool** and it spends 0.1% of turns above 75%;
 * jormungandr_v1 on `undertow` was at **145%** before its brake and 118.6% after. Chaining `ignite`
 * piles a status that caps at 4 and draws cards into a deck with no draw payoff, so the chain does
 * not convert into damage the way `undertow`'s did. Capping it would cost fenrir_v2 the two-copy
 * opener its whole kit is built on, for a loop it does not have.
 *
 * `forage+` joined under ticket 163a. The upgrade HALVES the self-damage (15 power -> 8), which is
 * the brake moving in the direction that should worry this list, so it was measured rather than
 * assumed: same probe, same deck (ratatoskr_v1, both copies), base and `+` back to back — **0.2%
 * of turns at >=3 and max 7 for `forage`, 0.3% and max 7 for `forage+`**. The price was never what
 * stopped it (the paragraph above says so), so halving the price did not start it.
 *
 * `ignite+` did NOT join them, and it is the only card on that pass that did not. It is capped
 * instead, and the measurement is written beside its entry in `LOOPING_FREE_DRAWS`.
 *
 * This set exists so the tripwire can tell "measured and excluded" from "nobody has looked".
 */
export const MEASURED_NOT_LOOPING: ReadonlySet<string> = new Set(['forage', 'ignite', 'forage+']);

/** Every 0-energy card that draws — the population the two sets above must between them cover. */
export function freeDrawCardIds(ids: ReadonlyArray<string>): string[] {
    return ids.filter((dataId) => {
        const data = GetProgramData(dataId);
        if (!data || data.id === 'missing') return false;
        if (numericBaseCost(data.baseCost) !== 0) return false;
        return (data.actions ?? []).some((action) => (action.type as string) === 'DRAW');
    });
}

/**
 * ── TICKET 152 — ONE LOOPING FREE DRAW AT A WILD, HOWEVER MANY THE DECK SHIPS ───────────────
 *
 * Henry, 2026-09-22: *"remove the double undertow cards from all wild encounters. It should only
 * be in elites and bosses."* See `IEnemyLoadout.duplicateCantrips` for the measurement behind it.
 *
 * The EXTRA copies are dropped and nothing is put in their place. A replacement would be a card
 * nobody designed into the list, chosen by this function, and 152 already measured what swapping
 * one in does — both arms cost the deck 43–51 field points. Dropping is the smaller claim: the
 * deck is the deck, minus the copy that makes it loop.
 *
 * Applied to the SIDE's assembled pile rather than to one member's list - see the call site.
 *
 * It touches two shipped lists, and they are the only two: `jormungandr_v1` (`undertow` x2, the
 * deck this ticket is about) and `sleipnir_v1` (`slipstream` x2). `ratatoskr_v1` and `hel_v2` run
 * `forage` x2 and keep both — measured at max 4 casts in a turn, see `MEASURED_NOT_LOOPING`.
 *
 * Order is preserved and the FIRST copy is the one kept, so a wild's list is a prefix-stable
 * subsequence of the tuned list. That matters more than it looks: the deck is shuffled from a
 * seeded stream, and a rule that reordered the list would change every wild encounter's draw in
 * the whole corpus rather than only the decks it removes a card from.
 */
export function dedupeCantrips(deck: ReadonlyArray<string>, loadout: IEnemyLoadout): string[] {
    if (loadout.duplicateCantrips) return [...deck];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const dataId of deck) {
        if (LOOPING_FREE_DRAWS.has(dataId)) {
            if (seen.has(dataId)) continue;
            seen.add(dataId);
        }
        out.push(dataId);
    }
    return out;
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

/**
 * TICKET 142b — the firmwares the scout fields: two of the leader's three, chosen by the node seed.
 *
 * Two rather than three so it is a CUT of the gym and not a rehearsal of it, and so the fight sits
 * at an elite's size rather than the gauntlet's. Which two is stable per node: the same scout on
 * the same run always shows the same pair, because a preview that reshuffled on re-entry would be
 * a slot machine rather than information.
 */
export function scoutFirmwareFor(run: IRunState, node: IRegionNode): string[] {
    if (!node.scout) return [];
    const comp = GYM_REGISTRY[run.gymId]?.leaderComp ?? [];
    if (comp.length === 0) return [];
    const stream = new SeedStream(new SeedStream(encounterSeed(run, node)).fork('scout-comp'));
    return stream.shuffle([...comp]).slice(0, 2);
}

/** The species behind those firmwares — what `encounterSpeciesPool` has to return. */
function scoutSpeciesFor(run: IRunState, node: IRegionNode): string[] {
    const species: string[] = [];
    for (const firmware of scoutFirmwareFor(run, node)) {
        // `speciesOwningFirmware` rather than the search written out again — this was the second
        // copy of it, and the first copy is what 142d's biome builder needed and did not find.
        const ownerId = speciesOwningFirmware(firmware);
        if (ownerId && !species.includes(ownerId)) species.push(ownerId);
    }
    return species;
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
    // Ticket 142b: the scout is TWO bodies of the leader's comp, whatever the player brought — a
    // preview that mirrored your party size would show a different fight to a solo run than to a
    // full one, and the thing being previewed is the gym's team.
    const scoutFirmware = scoutFirmwareFor(run, node);
    const size = opening
        ? 1
        : scoutFirmware.length > 0 ? scoutFirmware.length : enemyPartySize(node.kind, party.length);

    /*
     * ONE DEALT PLAN, TWO RULES THAT PRODUCE ONE. A rival deals the PATH elements (142a); an
     * ordinary fight on the approach biome deals the gym's comp shape (§7). They cannot both
     * apply - `gymBiomeElementPlan` returns nothing for a rival - so the fallback below is a
     * choice between them rather than a merge, and the dealing loop stays one loop.
     */
    const rivalPlan = rivalElementPlan(run, node, size);
    const dealtPlan = rivalPlan.length > 0 ? rivalPlan : gymBiomeElementPlan(run, node, size);

    const enemyParty: IBattleEntity[] = [];
    const enemyDeckIds: string[] = [];

    for (let i = 0; i < size; i += 1) {
        // The scout's bodies are named, not rolled — `pool` holds exactly their species, in the
        // same order as the firmwares, so body i is firmware i running on its own species.
        const scoutOS = scoutFirmware[i];
        // TICKET 142c: a rival's first bodies are DEALT one per path element, off-biome first, so
        // the node cannot roll into the fight the biome already offers. Still exactly ONE draw per
        // body — narrowed to that element's species rather than skipped — so the roster stream
        // stays in step with the IV draws below and with every other node kind.
        const dealtElement = dealtPlan[i];
        const dealtPool = dealtElement ? speciesOfElement(dealtElement) : [];
        const definitionId = scoutOS
            ? (pool[i] ?? pool[pool.length - 1])
            : dealtPool.length > 0
                ? dealtPool[roster.nextInt(0, dealtPool.length - 1)]
                : pool[roster.nextInt(0, pool.length - 1)];
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
        // Drawn even for the scout, so the stream position is identical whether or not this node
        // is one — the same reason it is drawn for a loadout that will not run it.
        const rolledOS = definition.availableOS[roster.nextInt(0, definition.availableOS.length - 1)];
        // Ticket 142b: which firmware is the whole point of a preview. `kraken_v1` and `kraken_v2`
        // are different fights on the same body, and the comp grid picked one of them.
        const activeOS = scoutOS ?? rolledOS;

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

    /*
     * TICKET 152 — ON THE ASSEMBLED PILE, NOT PER ENEMY, AND THE DIFFERENCE IS THE WHOLE RULE.
     *
     * The enemy SIDE shares one deck: this list is every member's cards in one pile, which is why
     * it is built by pushing rather than by mapping. So a 3v3 of three jormungandr_v1 holds SIX
     * `undertow` even though no single member ships more than two, and a per-member de-duplication
     * would have left three — enough to loop, on a rule that claims to stop looping.
     *
     * Found by the ticket-08 test, which compares the pile card for card: it expected one and got
     * two. That test is the reason this is a one-line call in the right place rather than a subtle
     * bug in a shipped wild.
     */
    const sideDeck = dedupeCantrips(enemyDeckIds, loadout);

    // Ticket 68 ruling 4: the gym's Driver, on the elites guarding its approach and nowhere else.
    // Undefined for every wild, every elite outside the gym's biome, and every un-authored gym.
    const gymDriver = gymDriverForNode(run, node);

    return {
        enemyParty,
        enemyDeckIds: sideDeck,
        seed,
        enemyAiTier: loadout.ai,
        aiBeam: loadout.beam,
        ...(gymDriver ? { enemyDrivers: [gymDriver] } : {}),
    };
}
