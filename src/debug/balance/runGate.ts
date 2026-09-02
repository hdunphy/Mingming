/**
 * THE RUN GATE — ticket 61's headless check that a real run is winnable at the rate it was ruled to
 * be. The harness half; `runRunGate.ts` is the script that drives it and prints the table.
 *
 * # WHAT TICKET 61 ASKED FOR, AND WHAT THIS ANSWERS
 *
 * Three ruled win rates for a tier-1 run, each ±5 percentage points:
 *
 * | band | target | what it is |
 * |---|---|---|
 * | WILDS    | 95% | an ordinary `wild` node, at each of the three biomes |
 * | ELITES   | 75% | an `elite` node — the biome's unavoidable exit, and the rolled middle elites |
 * | GAUNTLET | 60% | the gym's three fights (`gauntlet.rollGauntletFight`, indices 0/1/2) |
 *
 * Every other balance instrument in this directory measures a DECK against another DECK. This one
 * measures a RUN: the enemies are rolled by `engine/run/encounter.rollEncounter` and
 * `engine/run/gauntlet.rollGauntletFight` from a real `IRunState` built by `engine/run/createRun`,
 * off a real region graph, at a real node. That distinction is the whole value of the file. A gate
 * that hand-assembled "a plausible biome-2 elite" would be measuring this file's opinion of ticket
 * 08's kit-fraction table rather than the table itself, and the first time someone edited
 * `KIT_FRACTION_BY_BIOME` the gate would keep reporting the old difficulty curve with a straight
 * face. Nothing here decides what an enemy holds. It asks the run.
 *
 * # THE THREE THINGS THIS FILE OWNS (everything else is delegated)
 *
 * 1. **Which fights to sample**, and with what party — see `CELLS` and `lineupFor`.
 * 2. **The translation from a rolled `IRunEncounter` into a `ComposedSetup`** so `runBatch` can play
 *    it — see `setupForEncounter`, and `NO_FIRMWARE_OS` for the one lossy edge in that translation
 *    and the proof that it is not lossy in play.
 * 3. **Pooling and banding** — `measure`, `wilson`.
 *
 * # WHY `runBatch` AND NOT A LOOP OF ITS OWN
 *
 * `runOne`'s loop is not just "call the reducer until someone dies": it carries the per-turn action
 * cap, the wedged-state escape hatch, the DRAW rules and the truncation accounting that every
 * committed balance number in `docs/balance/` was produced under. A second loop here would be a
 * second set of stall semantics, and the first time the two disagreed the gate's numbers would stop
 * being comparable to the corpus they are supposed to sit beside. So this file builds setups and
 * `runBatch` plays them, exactly as `runDeckReport.ts` and `gauntlet-boss.balance.ts` do.
 *
 * # PLAYER-FIRST, SINGLE ORIENTATION — AND WHY THIS DOES **NOT** USE `runPairedBatch`
 *
 * The rest of the suite runs both turn orders and pools, because moving first is worth ~10 points
 * between base decks and a deck comparison must not be a turn-order comparison. **A run gate is the
 * one measurement where that correction is wrong.** `createBattleState` (`battleFactories.ts:362`)
 * and `buildScenarioState` both open every battle with `activeSide: 'PLAYER'` — in a real run the
 * player *always* moves first, at every node, in every gauntlet fight. Pooling in an ENEMY-first
 * orientation would average in a game the shipped product never plays and report the run as harder
 * than it is. So every battle here is PLAYER-first, and the first-mover edge is deliberately left
 * *in* the number, because it is part of the thing being measured. It also halves the cost, which
 * matters more here than anywhere else in the suite (see the cost note below).
 *
 * # COST — READ THIS BEFORE CHOOSING AN ITERATION COUNT
 *
 * Measured on the box this was written on (2-core Xeon @2.8GHz, `npx vite-node`, full AI), one
 * PLAYER-first battle each:
 *
 * | fight shape | cells | seconds per battle |
 * |---|---|---|
 * | 1v1 | `wild:biome0`, `elite:biome0` | 0.05 - 0.15 |
 * | 2v2 | `wild:biome1`, `elite:biome1` | 2.3 - 2.6 |
 * | 3v3 | `wild:biome2`, `elite:biome2`, all three `gauntlet:*` | 30 - 70 |
 *
 * The 3v3 spread inside one cell is real and is mostly the enemy's deck: an `elite:biome2` sample
 * (three tuned per-OS decks, 27 cards) ran 70s a battle where a `wild:biome2` sample ran 31s.
 *
 * That 200x spread is not this file's doing — `gauntlet-boss.balance.ts` measured the same thing
 * ("a 3v3 battle in this harness costs ~300x a 1v1 one") and `TacticalAI`'s own `AI_CENSUS` note
 * explains it: the same-turn search enumerates casters x hand x targets, which is ~83 reducer
 * simulations per decision at 1v1 against ~16,677 at 3v3. **Six of the nine cells below are 3v3**,
 * so the gate's runtime is essentially `9 x iterations x 30s` and nothing else.
 *
 * The consequence has to be said plainly rather than hidden behind a default: **ticket 61's ±5-point
 * window cannot be resolved in minutes.** Resolving ±5 at 95% confidence takes on the order of 350
 * battles in a band (fewer near a 95% target, more near 60%); at 30-70s a battle that is two to
 * seven hours *per band*. So every band prints its Wilson 95% interval beside the point estimate
 * rather than the point estimate alone, and **a band verdict whose interval is wider than the window
 * is not a verdict** — it is the harness saying it has not been given enough sample yet.
 * `--iterations` is the knob, `--bands` and `--cells` let the expensive parts be bought separately,
 * and the script prints what each cell cost so the next person can budget from real numbers.
 *
 * # THE AI TIER IS ALWAYS `full`, AND CANNOT BE CHANGED HERE
 *
 * `TacticalAI` reads `AI_LITE` / `AI_GREEDY` / `AI_BEAM` from `process.env`, and ticket 108's
 * calibration forbids reading a band verdict off the cheap tier ("SCREEN WITH LITE, CONFIRM THE
 * WINNER WITH FULL"). Under `vite-node` the question does not arise: `vite.config.ts` carries
 * `define: { 'process.env': {} }`, so every `process.env.X` in the graph is compile-time-substituted
 * to `undefined` and the tier is unconditionally `full`. Worth writing down because it is
 * surprising, it silently disables `BALANCE_ONLY` for `npm run balance:deck` too, and it is the
 * reason this file takes its knobs as argv flags rather than environment variables.
 *
 * Nothing outside `src/debug/` may import this module.
 */

import { MingmingRegistry, LAUNCH_SPECIES } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { SeedStream } from '../../engine/core/SeedStream';
import {
    START_KIT_SIZE,
    STARTER_GENERICS,
    createRun,
    minimumActiveDeck,
    recruitDeckFor,
    startDeckFor,
    startKitIdsFor,
} from '../../engine/run/createRun';
import { RUN_ENEMY_MODE, rollEncounter } from '../../engine/run/encounter';
import { GAUNTLET_FIGHTS, isBossFight, rollGauntletFight } from '../../engine/run/gauntlet';
import { offerGyms } from '../../engine/run/gyms';
import { GYM_COUNTER_ANSWERS, GYM_SELECTIVE_ANSWERS } from '../../engine/run/marketplace';
import { GENERIC_HIT, getDeckForOS } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { REGION_PARAMS } from '../../engine/run/regionGraph';
import type { IRegionNode, IRunState } from '../../engine/runTypes';
import type { IBattleEntity, IMingmingState } from '../../engine/types';
import type { ComposedSetup, EnemySetup, PartyMemberSetup } from '../scenarios/scenarioSchema';
import { BALANCE_IV, BALANCE_STAT_JITTER } from './balanceScenarios';
import { quietly } from './balanceReporting';
import { DEFAULT_MAX_TURNS, aggregate, runBatch, type RunResult } from './runBatch';
import { ElementalMatrix } from '../../engine/combatUtils';
import type { Element } from '../../engine/types';
import type { AiTier } from '../../engine/ai/TacticalAI';
import type { HandbuiltParty } from './handbuiltParties';
import { tweakEnemyDeck } from './experimentalTweaks';

// ---------------------------------------------------------------------------------------------
// The ruled targets
// ---------------------------------------------------------------------------------------------

export type BandId = 'wild' | 'elite' | 'gauntlet';

/** Ticket 61's three ruled tier-1 win rates, as fractions. The whole point of the file. */
export const RUN_GATE_TARGETS: Readonly<Record<BandId, number>> = {
    wild: 0.95,
    elite: 0.75,
    gauntlet: 0.60,
};

/** Ticket 61's window: *"against these ruled targets (±5 percentage points)"*. */
export const RUN_GATE_TOLERANCE = 0.05;

/**
 * Ticket 61 is *"a report, not a CI gate"* by its own words, so `--strict` is opt-in and the default
 * exit code is 0. Kept here rather than in the script so the two halves cannot disagree about what
 * "outside its window" means.
 */
export function bandVerdict(measured: number, target: number): boolean {
    return Math.abs(measured - target) <= RUN_GATE_TOLERANCE + 1e-9;
}

// ---------------------------------------------------------------------------------------------
// The one lossy edge in the translation, and why it is not lossy in play
// ---------------------------------------------------------------------------------------------

/**
 * **The firmware id given to an enemy that ticket 08 says runs NO firmware.**
 *
 * `KIT_FRACTION_BY_BIOME[0]` is `{ deck: 'start-kit-plus-generics', os: false }`, and `os: false` is
 * half of what makes a biome-0 wild the gentle fight it is meant to be: `rollEncounter` returns that
 * entity with `activeOS: undefined` so `OSSystem` wires no hooks for it. Roughly a third of every
 * wild fight in a run is that fight, so a gate that quietly handed those enemies their firmware
 * would be measuring a game nobody plays and would report the WILDS band low.
 *
 * **`ComposedSetup` cannot say "no firmware".** `EnemySetup.activeOS` is optional, and omitting it
 * does not mean absent — `buildScenarioState.buildEntity` leaves the key off the instance,
 * `initializeBattleEntity` resolves a missing `activeOS` to `definition.availableOS[0]`, and
 * `normalizeBattleState`'s fill class would put it back even if it did not. The empty string does
 * not work either: `initializeBattleEntity` uses `instance.activeOS || availableOS[0]`, so `''` is
 * falsy and takes the same fallback. There is no representable "off".
 *
 * So the enemy is given a firmware id **that the firmware registry does not define**, which is
 * exactly and only what "no firmware" means to the engine at battle time. Every consumer of
 * `IBattleEntity.activeOS` on the battle path resolves it through `getOSBehavior` and guards the
 * result:
 *
 * - `core/Hooks.ts:103,157` — `if (e.activeOS) { const os = getOSBehavior(...); if (os) ... }`
 * - `resolutionEngine.ts:370,433,489` — the same guarded pair, three times
 * - `battleReducer.ts:159,254` — `getOSBehavior(...)?.actsWhileAsleep` / `?.maxCardsPerTurn`
 * - `ai/TacticalAI.ts:197` — `getOSBehavior(entity.activeOS ?? '')?.actsWhileAsleep`
 *
 * `getOSBehavior` is a plain `FIRMWARE_REGISTRY[osId]` lookup that returns `undefined` for an
 * unknown key, so every one of those sites takes the same branch it would take for `undefined`. The
 * only other reader of an enemy's `activeOS` is `getDeckForOS`, and this file never lets it be
 * consulted: the deck always arrives pre-resolved on the setup, straight out of `IRunEncounter`.
 *
 * **The claim is checked, not asserted.** `assertNoFirmwareSentinel` runs at module load and throws
 * if the id ever resolves to a real `OSDefinition` — because the failure mode of a silently-valid
 * sentinel is the worst kind: the gate would keep running and keep reporting, with a third of its
 * wild fights secretly upgraded.
 *
 * The honest alternative was an optional `noFirmware` flag on `EnemySetupSchema` plus three lines in
 * `buildScenarioState`. That is a change to the scenario file format — a format with 51 committed
 * `.scenario.json` files and a documented version-bump policy — made to serve one report script, so
 * it belongs to whoever owns that format rather than to this ticket. If it lands, delete this
 * constant and pass `activeOS: undefined` through honestly; nothing else here changes.
 */
export const NO_FIRMWARE_OS = 'run-gate:no-firmware';

function assertNoFirmwareSentinel(): void {
    const resolved = getOSBehavior(NO_FIRMWARE_OS);
    if (resolved !== undefined) {
        throw new Error(
            `[run-gate] '${NO_FIRMWARE_OS}' now resolves to a real firmware (${resolved.id}), so it ` +
            'no longer means "no firmware" and every biome-0 wild in this gate would silently be ' +
            'running hooks. Pick an unregistered id, or teach ComposedSetup to express "no OS".',
        );
    }
}

assertNoFirmwareSentinel();

// ---------------------------------------------------------------------------------------------
// The sample: which player decks, and why these ones
// ---------------------------------------------------------------------------------------------

/**
 * The twelve tuned OS ids — the six launch species x two firmwares each.
 *
 * Read off `LAUNCH_SPECIES` rather than written out, because ticket 05 ships six of sixteen species
 * and the other ten arrive with their decks. Those ten are reachable from the registry but they are
 * NOT tuned and they carry no `startKits` tags, so `startKitIdsFor` would fall back to "the first
 * five cards of the tuned deck" with a warning — a plausible list nobody chose. A gate whose player
 * decks were half untagged fallbacks would be reporting the fallback rule, not the run.
 *
 * It is also, conveniently, exactly the enemy pool: the three launch elements (`LAUNCH_ELEMENTS` —
 * Fire, Water, Nature) have precisely these six species between them in `MingmingRegistry`, so
 * `encounterSpeciesPool` can only ever field a tagged species. Nothing in this gate takes the
 * untagged path on either side of the field.
 */
export const TUNED_OS_IDS: ReadonlyArray<string> = LAUNCH_SPECIES.flatMap(
    (species) => MingmingRegistry[species].availableOS,
);

const speciesOf = (osId: string): string =>
    LAUNCH_SPECIES.find((s) => MingmingRegistry[s].availableOS.includes(osId))!;

/**
 * **HOW THE PLAYER DECKS ARE SAMPLED, AND WHY THAT SAMPLE IS REPRESENTATIVE.**
 *
 * Sample `i` of a `size`-member party takes the OS ids at indices `5i`, `5i+5`, `5i+10` (mod 12) of
 * `TUNED_OS_IDS`. Three properties make that a sample rather than a habit:
 *
 * 1. **Every tuned OS is a starter exactly once per 12 samples.** 5 is coprime to 12, so `5i mod 12`
 *    is a permutation of the roster. `--iterations 12` is therefore one complete pass over ticket
 *    61's table, and any multiple of 12 is a balanced repeat. Picking one species instead — the
 *    obvious cheap alternative — would report that species' matchup against the biome pool, and the
 *    spread between the strongest and weakest tuned deck in this engine is far wider than the ±5
 *    window the gate is checking, so a single-species reading could sit anywhere inside it and mean
 *    nothing.
 * 2. **It spreads across SPECIES fast, not just across firmware.** The roster is ordered
 *    `fenrir_v1, fenrir_v2, skoll_v1, ...`, so the naive `i mod 12` walk spends its first two
 *    samples on one species. The stride visits five distinct species in its first six samples,
 *    which is what makes a small `--iterations` a thin sample rather than a biased one.
 * 3. **No party ever holds two of one species.** `IRunState.partyIds` carries the standing
 *    no-duplicate-species law (map § Notes; `reconcileLoadedState` is the first code to enforce it)
 *    and `teamComps.ts` builds every comp the same way. Both offsets are +5 and +10 mod 12, and
 *    since species are consecutive PAIRS in the list, neither step can land inside the starter's
 *    own pair. `lineupFor` asserts it anyway rather than trusting the arithmetic.
 *
 * What this sample deliberately does NOT model is deck DRIFT. A real party at biome 2 has walked
 * two marketplaces and two workshops and its 18 cards are not all engine cards any more. Ticket 61
 * asks for the decks *"the game actually deals"* (`startDeckFor` / `recruitDeckFor`), which is the
 * un-drifted floor: the run at its weakest, before a single reward has been taken. Every band here
 * should therefore read a little LOW against a played run, and that is the conservative direction.
 */
export function lineupFor(index: number, size: number): string[] {
    const n = TUNED_OS_IDS.length;
    const base = (index * 5) % n;
    const lineup = Array.from({ length: size }, (_, slot) => TUNED_OS_IDS[(base + slot * 5) % n]);

    const species = lineup.map(speciesOf);
    if (new Set(species).size !== species.length) {
        throw new Error(`[run-gate] Lineup ${lineup.join('+')} holds two of one species.`);
    }
    return lineup;
}

/**
 * **WHICH PLAYER THE GATE IS MEASURING — Henry's ruling on ticket 67, 2026-08-26.**
 *
 * > *"We should report both numbers. No type matchup … the other number is player with matchup adv."*
 * > *"These are the targets for an average prepared player."*
 *
 * So the gate has two arms, and only one of them is graded against 95/75/60.
 *
 * # WHY THIS EXISTS AT ALL
 *
 * `lineupFor` above picks the party by walking the tuned roster on a stride. It never looks at the
 * biome. That is a fine SAMPLE of decks and a terrible sample of FIGHTS, because type advantage in
 * this engine is close to a win condition rather than flavour: 1.5x on every attack for the whole
 * battle, and `combatUtils.ElementalMatrix`'s own header records that a persistent multiplier that
 * size measured an **89/11 cross-element split over 1,440 games**. Measured over 60 boss samples,
 * the blind lineup brought a favourable matchup **7 times**. Every band the gate has reported so far
 * is therefore an average over a lottery on the single largest term in the fight.
 *
 * # THE THREE MODES
 *
 * - **`blind`** — the original stride. Kept as the default so every number taken before this ruling
 *   still reproduces, and kept as a third line worth reporting: it is the honest answer to *"what
 *   happens to a player who does not think about type"*.
 * - **`favourable`** — the PREPARED arm. Brings the counter-element for the fight, as far as the
 *   roster allows. This is the arm the targets grade.
 * - **`control`** — the CONTROL arm. Brings the fight's own element, which is 1.0x in both
 *   directions, so the number isolates deck, AI grade and stats with type removed.
 *
 * # THE CONSTRAINT THAT SHAPES BOTH NON-BLIND MODES
 *
 * With the EA six there is **no element neutral against Fire, Water or Nature except itself** (vs
 * Fire: Water and Earth have the edge, Nature and Ice are behind, and Earth/Ice do not ship), and
 * there are only **two species per element**. So:
 *
 * - a same-element control is exact at party size 1 and 2, and **impossible at size 3**;
 * - a full counter-element commitment likewise caps at two members.
 *
 * The third slot is therefore filled deliberately rather than left to fall out, and differently per
 * mode:
 *
 * - `favourable` fills it with the **target's own element** — neutral, the best available, and
 *   deterministic. A prepared player would not bring the one member the champion eats.
 * - `control` **alternates** the third slot between the two non-target elements by sample index, so
 *   across a sample the third member is favourable half the time and behind half the time and the
 *   arm averages back to neutral. Filling it consistently either way would tilt the control.
 *
 * Both are recorded here rather than hidden, because a control that is not actually neutral is worse
 * than no control at all.
 */
export type MatchupMode = 'blind' | 'favourable' | 'control';

const elementOf = (osId: string): string => MingmingRegistry[speciesOf(osId)].primaryElement;

/** Every tuned firmware of a given element — two species x two firmwares, four ids. */
const osIdsOfElement = (element: string): string[] =>
    TUNED_OS_IDS.filter((id) => elementOf(id) === element);

/** The launch elements that beat `target` at 1.5x. With the EA cycle this is exactly one. */
const countersOf = (target: string): string[] =>
    [...new Set(TUNED_OS_IDS.map(elementOf))].filter(
        (element) => (ElementalMatrix[element as Element]?.[target as Element] ?? 1) > 1,
    );

/**
 * The element the sampled fight is *about*.
 *
 * For a wild or an elite it is the biome the node stands in. **For the gauntlet it is the GYM's own
 * element**, read off the leader directly.
 *
 * # WHY THIS IS NO LONGER AN INDEX
 *
 * It used to be `biomes[2]` — under the pre-2026-08-30 walk order the gym's element *was* the last
 * biome, so the index and the leader agreed and the index was the cheaper thing to write. Henry's
 * biome-order ruling moved the gym's element to `biomes[0]`, which silently turned `biomes[2]` into
 * *the element the leader beats* — the harness would have prepared the party against the wrong
 * third of the triangle and reported the resulting losses as a boss being hard.
 *
 * Nothing would have thrown. Reading the leader is not just the fix, it is the correct expression:
 * the champion — the leader's own species, and the member the fight is named after — is a property
 * of the gym, not of where the gym happens to stand. Countering it is what *"come into the grass
 * boss with firestarters"* means, and it necessarily leaves the other two boss members
 * un-countered. That is the real shape of the fight rather than a limitation of the harness.
 */
/**
 * `--deck <mode>` — TICKET 77 TRACK A: how much of its own kit the party has actually assembled.
 *
 * # WHY THIS FLAG IS THE POINT OF THE TICKET
 *
 * Every lever measured across tickets 67-76 was a BOSS-side lever, and that was not a choice. Read
 * what the graded arm fields: the boss trio brings its full tuned kit, its OS, a Driver, 20/20/20
 * IVs and full lookahead; the player brings three 5-card engines plus 3 generics — the **18-card
 * RUN-START deck** — with `run.drivers` empty and no macros, because no AI policy exists to fire one.
 * So the gate has been asking why a run-start player does not beat a finished one 84% of the time,
 * and then diagnosing the boss. This flag is the other side of that comparison finally being visible.
 *
 *  - **`full`** (A1, the ceiling) — every member's whole tuned per-OS list, no generics. Bounds what
 *    ANY amount of kit completion can buy. If completed engines still miss ~84%/fight, deck
 *    progression is not the whole answer and the session knows that before designing a pick track.
 *  - **`engine-plus-3`** (A2) — each member's 5-card `startKit` plus the next three of its own tuned
 *    list in registry order, so 8 a member plus the starter's 3 generics. Models a mid-run pick track
 *    built only from cards that already exist.
 *  - **`bare-plus-generics`** (A3, the dilution control) — the bare deck plus three copies of
 *    `GENERIC_HIT`. **Same size as the buy-everything toolbox arm, zero situational text.** If three
 *    blanks cost what three counters cost (Rootfall -16.6, Emberfall -18.4) the mechanism is dilution
 *    and the printings are innocent; if blanks are free, the printings are back on the table. This is
 *    the arm that decides the question research/76 §2.3 could not.
 *
 * Registry order is used rather than any notion of "best three" on purpose: choosing which three
 * cards complete an engine is a DESIGN decision, and an arm that measures my choice of cards is not
 * measuring the pick track. Registry order is arbitrary but it is not mine.
 */
export type DeckMode = 'bare' | 'full' | 'engine-plus-3' | 'bare-plus-generics';

const ENGINE_PLUS = 3;

/**
 * The deck a given progression mode deals, given the run-dealt bare deck as the baseline.
 *
 * Returns `undefined` for `bare`/unset so the caller keeps whatever it already built — a handbuilt
 * party's declared deck must not be silently replaced by a mode nobody asked for.
 */
export function deckForMode(
    mode: DeckMode | undefined,
    party: ReadonlyArray<IMingmingState>,
    bare: ReadonlyArray<string>,
): ReadonlyArray<string> | undefined {
    if (mode === undefined || mode === 'bare') return undefined;

    if (mode === 'bare-plus-generics') {
        return [...bare, ...Array.from({ length: 3 }, () => GENERIC_HIT)];
    }

    const perMember = party.map((member) => {
        const tuned = getDeckForOS(member.definitionId, member.activeOS ?? undefined);
        if (mode === 'full') return tuned;

        // `engine-plus-3`: the kit, then the first ENGINE_PLUS tuned cards the kit does not already
        // hold. Counted by INSTANCE rather than by id — a tuned list with `growth` x2 should be able
        // to hand a kit holding one `growth` its second copy.
        const kit = startKitIdsFor(member, START_KIT_SIZE);
        const remaining = [...kit];
        const extras: string[] = [];
        for (const id of tuned) {
            if (extras.length >= ENGINE_PLUS) break;
            const at = remaining.indexOf(id);
            if (at >= 0) { remaining.splice(at, 1); continue; }
            extras.push(id);
        }
        return [...kit, ...extras];
    });

    // The starter's generics ride along for every mode that models a REAL run deck. `full` is a
    // ceiling rather than a run state, so it deliberately carries none.
    const generics = mode === 'full' ? [] : Array.from({ length: STARTER_GENERICS }, () => GENERIC_HIT);
    return [...perMember.flat(), ...generics];
}

/**
 * How much of the gym's counter tech the party arrives holding — ticket 75's shopping-policy arms.
 *
 * `undefined`/`false` is the bare arm, which since ruling 2 is **the arm that GRADES a gym**; every
 * toolbox mode is a diagnostic line beside it.
 */
export type ToolboxMode = boolean | 'all' | 'selective' | `card:${string}`;

/** The cards a given shopping policy adds to the deck at a given gym. Empty for the bare arm. */
export function toolboxAnswersFor(mode: ToolboxMode | undefined, gymId: string): ReadonlyArray<string> {
    if (mode === undefined || mode === false) return [];
    if (mode === true || mode === 'all') return GYM_COUNTER_ANSWERS[gymId] ?? [];
    if (mode === 'selective') return GYM_SELECTIVE_ANSWERS[gymId] ?? [];
    return [mode.slice('card:'.length)];
}

/**
 * `--lean <Element>`: build the party around a NAMED element instead of the gym's counter.
 *
 * Ticket 76 arm 3 asks for a party-lean bracket at Rootfall, and the trap is hand-picking three
 * parties: the bracket would then measure my team-building rather than the lean. So it reuses the
 * harness's own `lineupAgainst` picker unchanged and only moves the element handed to it.
 *
 * `lineupAgainst(.., target, 'favourable')` fills from `countersOf(target)` — so to LEAN on element
 * E you pass the element E counters. Over the launch 3-cycle (Fire > Nature > Water > Fire) that is
 * a lookup, and it is the inverse of `COUNTERED_BY` in `gyms.ts` rather than a second opinion about
 * the triangle.
 */
const LEAN_TARGET: Readonly<Record<string, string>> = { Fire: 'Nature', Nature: 'Water', Water: 'Fire' };

function targetElementFor(
    cell: RunGateCell,
    gym: { readonly element: string },
    biomes: ReadonlyArray<{ elements: ReadonlyArray<string> }>,
): string {
    if (cell.kind === 'gauntlet') return gym.element;
    return biomes[Math.min(cell.biomeIndex, biomes.length - 1)]?.elements[0] ?? 'None';
}

/**
 * Draw `count` firmwares of one element, from DISTINCT species, rotating by sample index.
 *
 * The rotation is what keeps a prepared arm a sample rather than a fixture: without it every
 * favourable boss sample would field the same two firmwares, and the arm would report one matchup's
 * quality instead of the counter-element's.
 */
function drawFromElement(element: string, count: number, index: number, taken: Set<string>): string[] {
    const bySpecies = new Map<string, string[]>();
    for (const id of osIdsOfElement(element)) {
        const species = speciesOf(id);
        if (taken.has(species)) continue;
        bySpecies.set(species, [...(bySpecies.get(species) ?? []), id]);
    }
    const species = [...bySpecies.keys()];
    const out: string[] = [];
    for (let slot = 0; slot < count && slot < species.length; slot += 1) {
        const name = species[(index + slot) % species.length];
        if (taken.has(name)) continue;
        const firmwares = bySpecies.get(name)!;
        /*
         * THE FIRMWARE-PAIRING FIX — Henry, 2026-08-30, after the first three-gym table.
         *
         * This line used to read `firmwares[index % firmwares.length]`, with the SAME `index` for
         * every slot. With two firmwares per species that made every lineup **all-v1 on even
         * samples and all-v2 on odd ones**, and a mixed-firmware team — which is what a player
         * actually builds — literally unreachable.
         *
         * It was not a small distortion. It is the mechanism behind the whole per-deck split in the
         * three-gym table: 15/15 vs 10/15 at Emberfall, 14/15 vs 9/15 at Rootfall, and 11/15 vs 1/15
         * on Tidewrack's control arm. n=30 was never thirty decks; it was two decks fifteen times,
         * and the v1 firmwares happen to share a draw-and-cantrip idiom, so an all-v1 team was
         * *accidentally* synergistic. Nothing chose that.
         *
         * # WHY A BIT SHIFT AND NOT A SECOND MODULUS
         *
         * Each party slot reads a DIFFERENT BIT of the sample index, so the slots decorrelate
         * completely: with 3 members and 2 firmwares apiece, samples 0-7 enumerate all eight
         * v1/v2 combinations exactly once. A second modulus (`(index + slot) % 2`) would only ever
         * produce alternating pairs — v1/v2/v1 and v2/v1/v2 — which is two more fixtures rather than
         * a sample.
         *
         * `taken.size` rather than `slot` is the bit position on purpose: `lineupAgainst` calls this
         * function TWICE for a favourable arm (once for the counter element, once for the filler),
         * and `slot` restarts at 0 on the second call. `taken` is threaded across both, so it is the
         * only counter that is monotonic over the whole party.
         *
         * `blind` is untouched — it goes through `lineupFor`, not here — so every pre-ruling number
         * still reproduces.
         */
        out.push(firmwares[(index >>> taken.size) % firmwares.length]);
        taken.add(name);
    }
    return out;
}

/**
 * The lineup for one sample under one matchup mode. See `MatchupMode` for the argument.
 *
 * Falls back to `lineupFor`'s stride for any slot the rules above cannot fill — which cannot happen
 * with the EA six, and is here so that adding a seventh species can never silently produce a short
 * party instead of a loud one.
 */
export function lineupAgainst(
    index: number,
    size: number,
    target: string,
    mode: MatchupMode,
): string[] {
    if (mode === 'blind') return lineupFor(index, size);

    const taken = new Set<string>();
    const lineup: string[] = [];

    if (mode === 'favourable') {
        for (const element of countersOf(target)) {
            lineup.push(...drawFromElement(element, size - lineup.length, index, taken));
        }
        // The remainder rides on the target's own element: 1.0x both ways, and the only neutral
        // choice the EA roster offers.
        lineup.push(...drawFromElement(target, size - lineup.length, index, taken));
    } else {
        lineup.push(...drawFromElement(target, size - lineup.length, index, taken));
        /*
         * Alternate the overflow so the arm averages neutral: even samples take the element that
         * BEATS the target, odd samples take the element the target beats.
         *
         * BUG FIXED 2026-08-30. This used to alternate the ORDER OF A FILTERED LIST — the two
         * non-target elements in `TUNED_OS_IDS` order — which cancels only while the target is
         * held fixed. It is not fixed: the gauntlet's target is the leader's element and
         * `sampleFight` strides the leader with the sample index, so WHICH END of that list was
         * the favourable one moved underneath the alternation. The result was a coin flip that
         * happened to land near even, not the cancellation the comment claimed, and it would tilt
         * a control band by a few points without ever failing loudly.
         *
         * Alternating on the MATCHUP is target-independent, so the two biases now cancel exactly:
         * over any even number of samples the control leans my way exactly as often as theirs.
         */
        const favourable = countersOf(target);
        const unfavourable = [...new Set(TUNED_OS_IDS.map(elementOf))]
            .filter((element) => element !== target && !favourable.includes(element));
        const ordered = index % 2 === 0
            ? [...favourable, ...unfavourable]
            : [...unfavourable, ...favourable];
        for (const element of ordered) {
            lineup.push(...drawFromElement(element, size - lineup.length, index, taken));
        }
    }

    /*
     * Backstop, for a roster this file does not have yet. With the EA six the rules above always
     * fill the party, so this walks zero times — it exists so that adding a seventh species can
     * produce a loud short-party bug rather than a silent one. Walked over `TUNED_OS_IDS` directly
     * rather than through `lineupFor`, because that function refuses a lineup holding two of one
     * species and a full-roster call is by definition one.
     */
    for (let step = 0; step < TUNED_OS_IDS.length && lineup.length < size; step += 1) {
        const id = TUNED_OS_IDS[(index + step) % TUNED_OS_IDS.length];
        if (taken.has(speciesOf(id))) continue;
        lineup.push(id);
        taken.add(speciesOf(id));
    }
    return lineup.slice(0, size);
}

/** A sampled lineup as roster instances, at the corpus's pinned IVs. */
function partyFor(lineup: ReadonlyArray<string>): IMingmingState[] {
    return lineup.map((osId, slot) => ({
        id: `run_gate_member_${slot}`,
        definitionId: speciesOf(osId),
        nickname: undefined,
        activeOS: osId,
        blueprintsCollected: 0,
        /*
         * The corpus's pinned midpoint (`balanceScenarios.BALANCE_IV` = 15), decorrelated per sample
         * by the `statJitter` on the composed setup. Pinning matters more here than in a matchup:
         * the ENEMY's IVs are rolled by the run itself, so if the player's rolled too, a band would
         * be measuring the convolution of two IV distributions and the same species pairing could
         * land on either side of the window depending on the draw.
         *
         * **15 IS THE PLAYER'S OWN MEAN, AND IT IS FIVE POINTS BELOW THE ENEMY'S.** That is a fact
         * about the game, not a handicap this file applies, and it is worth writing down because it
         * is invisible from either file alone:
         *
         *   - a player's mingming is minted by `gameTypes.createMingmingInstance` at
         *     `rng.nextInt(0, 31)` per stat — uniform on 0-31, **mean 15.5**;
         *   - a run enemy is rolled by `encounter.rollEncounter` and `gauntlet.buildEnemy` at
         *     `stream.nextInt(10, 31)` — uniform on 10-31, **mean 20.5**, with a floor of 10 the
         *     player has no equivalent of.
         *
         * So the average run enemy carries ~5 more IV in every stat than the average player
         * mingming, at every depth, in every band. Pinning the player at 15 puts this gate at the
         * player's own expected roll rather than at parity with the enemy, which is the honest
         * choice — but anyone reading a band as "too low" should look at that asymmetry first,
         * because it is upstream of every deck in the game.
         */
        attackIV: BALANCE_IV,
        defenseIV: BALANCE_IV,
        hpIV: BALANCE_IV,
    }));
}

const asSetupMember = (member: IMingmingState): PartyMemberSetup => ({
    definitionId: member.definitionId,
    activeOS: member.activeOS,
    attackIV: member.attackIV,
    defenseIV: member.defenseIV,
    hpIV: member.hpIV,
});

/**
 * The deck the run deals this party: **5 engine + 3 generics for the starter, 5 engine per recruit**
 * — 8 / 13 / 18 at one, two and three members.
 *
 * Built through `startDeckFor` and `recruitDeckFor` rather than transcribed, which is ticket 61's
 * own instruction and the reason the sizes below are checked instead of hardcoded. Two assertions
 * guard it, and they are not decoration:
 *
 * - against `minimumActiveDeck(size)`, the engine's own statement of a party's base contribution;
 * - against `createRun`'s `run.deck`, card id for card id. That second one is the interesting check:
 *   `createRun` mints every starting member through `startDeckFor(member, stream, index === 0)`, so
 *   if the "a recruit brings only its five engine cards" ruling and the "the first member carries
 *   the generics" ruling ever stopped agreeing, this gate would be dealing a deck the game does not,
 *   and it would say so on the spot rather than shifting a win rate by a few points in silence.
 */
function deckFor(run: IRunState, party: ReadonlyArray<IMingmingState>): string[] {
    const stream = new SeedStream(new SeedStream(run.seed).fork('run-gate-deck'));
    const cards = party.flatMap((member, index) =>
        index === 0 ? startDeckFor(member, stream, true) : recruitDeckFor(member, stream));
    const deck = cards.map((card) => card.dataId);

    const expected = minimumActiveDeck(party.length);
    if (deck.length !== expected) {
        throw new Error(
            `[run-gate] A ${party.length}-member party dealt ${deck.length} cards; ` +
            `minimumActiveDeck says ${expected}.`,
        );
    }

    const fromCreateRun = run.deck.map((card) => card.dataId);
    if (fromCreateRun.join(',') !== deck.join(',')) {
        throw new Error(
            '[run-gate] The deck this gate deals is not the deck createRun deals.\n' +
            `  createRun: ${fromCreateRun.join(', ')}\n` +
            `  run gate : ${deck.join(', ')}`,
        );
    }
    return deck;
}

// ---------------------------------------------------------------------------------------------
// The cells: which fights each band is made of
// ---------------------------------------------------------------------------------------------

/**
 * A biome, and the party the ticket says is standing in it.
 *
 * *"A run is three biomes (`REGION_PARAMS.biomesPerRun`). Party grows 1 → 2 → 3 across them
 * (`RECRUITS_PER_RUN`)"* — so the representative party at biome index `b` has `b + 1` members. That
 * is the ONLY coupling between depth and party size in this file, and it is deliberately an
 * assumption about the typical run rather than a rule the engine enforces: a player can decline both
 * workshop recruits and walk into the gym alone, and `GAUNTLET_ENEMY_COUNT` will still field three.
 * A solo-into-the-gym gate is a different (and much harsher) measurement, and ticket 61 did not ask
 * for it.
 */
const PARTY_SIZE_AT_BIOME = (biomeIndex: number): number => biomeIndex + 1;

/** One measurable fight shape. `iterations` samples are drawn per cell. */
export interface RunGateCell {
    readonly band: BandId;
    /** Stable id — it keys printed rows, so renaming one invalidates comparisons. */
    readonly id: string;
    readonly label: string;
    /** Which biome the fight happens in. The gauntlet is always the final biome's gym. */
    readonly biomeIndex: number;
    readonly partySize: number;
    /** `wild` / `elite` node kinds, or a gauntlet fight index. */
    readonly kind: 'wild' | 'elite' | 'gauntlet';
    /** 0/1/2 for the gauntlet, undefined otherwise. */
    readonly fightIndex?: number;
}

/**
 * **The nine cells, and the three arguments behind the list.**
 *
 * **WILDS is three cells, one per biome, weighted equally.** Ticket 08's table gives each depth a
 * different enemy loadout — biome 0 holds the same six cards you do and runs no firmware, biome 1
 * holds the species' five-card `startKit` and runs its own, biome 2 holds the full tuned per-OS list
 * — so "the WILDS band" is genuinely three different fights and a gate that sampled only one of them
 * would be reporting a third of the curve. Equal weighting is a claim about the route: a biome has
 * five layers of which three are middles, wild is 60% of the middle mix, and each biome contributes
 * one entry node, so a walked route meets roughly the same number of wilds in each of the three.
 *
 * **Wild means `kind === 'wild'` and nothing else.** `alpha` (one overtuned body) and `ambush`
 * (theirs 3 vs your 2) are ticket 07's two authored exceptions to symmetric party size and they live
 * on the one dead-end pocket per biome. They are not the ordinary fight the 95% is about, and
 * folding them in would move the band by however often the pocket rolls each of the four kinds.
 * They deserve a band of their own once someone rules one.
 *
 * **ELITES is three cells too, and biome 0's is the interesting one.** `kitFractionFor` gives every
 * elite `FULL_KIT_FRACTION` regardless of depth, so a biome-0 elite is a *solo player with eight
 * cards against a complete tuned per-OS deck* — the encounter file flags that clause as "a READING,
 * not a ruling" and asks for it to be confirmed. This gate is where that reading shows up as a
 * number: if the elite band fails, look at the per-cell rows before touching anything, because the
 * three cells are three quite different fights wearing one name.
 *
 * **THE GAUNTLET IS THREE SEPARATE FIGHTS AND THE BAND IS READ PER FIGHT.** Ticket 61's *"60%
 * against the GAUNTLET (the gym's three fights)"* could be read as "clears all three", but that
 * reading is incoherent against its own neighbours: 60% compounded over three fights implies ~84%
 * per fight, which would make the run's final exam *easier per fight than an elite at 75%*. Read per
 * fight, 95 / 75 / 60 is a difficulty ladder, which is plainly what it is. The script prints the
 * compound (the product of the three per-fight rates) beside the band anyway, unbanded, because it
 * is the number a player experiences and someone will want it.
 */
export const CELLS: ReadonlyArray<RunGateCell> = [
    ...Array.from({ length: REGION_PARAMS.biomesPerRun }, (_, biomeIndex): RunGateCell => ({
        band: 'wild',
        id: `wild:biome${biomeIndex}`,
        label: `wild @ biome ${biomeIndex}`,
        biomeIndex,
        partySize: PARTY_SIZE_AT_BIOME(biomeIndex),
        kind: 'wild',
    })),
    ...Array.from({ length: REGION_PARAMS.biomesPerRun }, (_, biomeIndex): RunGateCell => ({
        band: 'elite',
        id: `elite:biome${biomeIndex}`,
        label: `elite @ biome ${biomeIndex}`,
        biomeIndex,
        partySize: PARTY_SIZE_AT_BIOME(biomeIndex),
        kind: 'elite',
    })),
    ...Array.from({ length: GAUNTLET_FIGHTS }, (_, fightIndex): RunGateCell => ({
        band: 'gauntlet',
        id: `gauntlet:fight${fightIndex}`,
        label: `gauntlet fight ${fightIndex + 1}/${GAUNTLET_FIGHTS}${fightIndex === GAUNTLET_FIGHTS - 1 ? ' (boss)' : ''}`,
        biomeIndex: REGION_PARAMS.biomesPerRun - 1,
        partySize: PARTY_SIZE_AT_BIOME(REGION_PARAMS.biomesPerRun - 1),
        kind: 'gauntlet',
        fightIndex,
    })),
];

// ---------------------------------------------------------------------------------------------
// Building one sampled fight
// ---------------------------------------------------------------------------------------------

/**
 * How many fights the run has behind it when a sampled fight happens.
 *
 * **Only one thing about this number is load-bearing: that it is not zero.** `isOpeningFight` is
 * `run.fightsResolved === 0` and nothing else, and a zero would pin the sampled encounter to ticket
 * 24's scripted opener — one body, biome-0 loadout, at every depth and every node kind. That is the
 * *easy* fight a run is handed once, so letting it leak into the WILDS band would report the band
 * high; letting it leak into the ELITES band would report an elite that is not an elite at all.
 *
 * The value is otherwise cosmetic (nothing else in the engine reads `fightsResolved` — only
 * `runSlice`, `runLog` and `runSummary` do, and none of them is on this path), so it is written as a
 * plausible route count rather than a magic 1, so that a reader of a dumped run sees a coherent
 * state.
 */
const fightsResolvedAt = (biomeIndex: number): number => 1 + biomeIndex * 4;

/**
 * **THE BOSS ISOLATION OVERRIDES — ticket 67, rulings round 3 (Henry, 2026-08-27).**
 *
 * The prepared arm wins the gym boss 0 times in 60 (§10 of the research note), and the wall is a
 * *compound*: full lookahead, fixed 20/20/20 IVs, `boss_relic_*` firmware and 3v3 focus fire, all at
 * once. Ruling R3 asks which of those is load-bearing, as a measurement rather than a grilling —
 * lower the stats in one arm, neutralize the relics in the other, change nothing else, and see which
 * number moves.
 *
 * **These are RUN-SCOPED, and that is the whole point of them being flags.** Ruling R2 leaves
 * `BOSS_IVS` and the relic firmware open as levers and locks the AI grade, but nothing has been
 * ruled yet — so the shipped constants must not move while the question is being measured. A gate
 * that answered "which knob is the wall" by turning the knob would have destroyed the baseline it
 * was comparing against.
 *
 * **`relics: 'off'` costs the boss nothing but its hooks.** A boss's `activeOS` is a `boss_relic_*`
 * id, and no species keys a deck by one — `getDeckForOS` already falls back to `availableOS[0]`'s
 * tuned list (`gauntlet.buildEnemy` documents this). So swapping the firmware to that same
 * `availableOS[0]` leaves the DECK byte-identical and removes only the relic's hooks, which is
 * exactly the isolation asked for rather than an approximation of it.
 *
 * Applied to **boss fights only**. `BOSS_IVS` has no meaning outside one, and the gauntlet's first
 * two fights are elites carrying no relic.
 */
export interface BossOverride {
    /** Replace every boss slot's stat roll with this triple. Undefined leaves `BOSS_IVS` alone. */
    readonly ivs?: { readonly hp: number; readonly attack: number; readonly defense: number };
    /**
     * `'off'` strips the boss's SIGNATURE PASSIVE, leaving the species' own tuned OS and deck.
     *
     * **Ticket 68 widened what that means, deliberately.** When this flag was written every boss
     * wore a `boss_relic_*` as its `activeOS`, so stripping the passive and restoring the tuned OS
     * were the same edit. An authored gym's boss now runs its real OS already and carries a
     * side-level Driver instead, so the flag drops the Driver there. Both branches answer the same
     * question — *what is the anti-boss card pool actually being asked to beat?* — which is the
     * question §12 used it for, and which would have silently changed meaning if the field had been
     * left pointing at a mechanism only two of the three gyms still use.
     */
    readonly relics?: 'off';
}

/** Apply a run-scoped override to a sampled boss team. A no-op for every other fight. */
function withBossOverride(
    cell: RunGateCell,
    enemyParty: ReadonlyArray<IBattleEntity>,
    override: BossOverride | undefined,
): ReadonlyArray<IBattleEntity> {
    if (!override || cell.kind !== 'gauntlet') return enemyParty;
    if (!isBossFight(cell.fightIndex ?? 0, GAUNTLET_FIGHTS)) return enemyParty;
    if (override.ivs === undefined && override.relics === undefined) return enemyParty;

    return enemyParty.map((enemy) => {
        const stats = override.ivs
            ? { hpIV: override.ivs.hp, attackIV: override.ivs.attack, defenseIV: override.ivs.defense }
            : {};
        // TICKET 72: the `activeOS` swap that used to live here is GONE with the relics.
        //
        // It existed to replace a `boss_relic_*` id with the species' own first OS, so that turning
        // the signature passive off left the boss with real firmware instead of none. Every gym is
        // authored now, so a boss member ALREADY runs its own tuned OS — and the swap had quietly
        // become harmful: it would have replaced an authored `skoll_v2` with `availableOS[0]`
        // (`skoll_v1`), changing the boss's DECK in an arm that is supposed to change one thing.
        // The Driver strip below is the whole of the lever now.
        return { ...enemy, ...stats };
    });
}

/** A one-line description of the override, for a report header that must not lose its provenance. */
export function describeBossOverride(override: BossOverride | undefined): string {
    if (!override || (override.ivs === undefined && override.relics === undefined)) {
        return 'boss as shipped';
    }
    const parts: string[] = [];
    if (override.ivs) parts.push(`BOSS_IVS ${override.ivs.hp}/${override.ivs.attack}/${override.ivs.defense}`);
    if (override.relics === 'off') parts.push('boss signature passive OFF (the gym Driver; tuned OS and deck untouched)');
    return `ISOLATION — ${parts.join(' + ')}`;
}

export interface SampledFight {
    readonly setup: ComposedSetup;
    /** The player's OS ids, in party order. */
    readonly lineup: ReadonlyArray<string>;
    /** One `species(firmware)` per enemy — `(no firmware)` where ticket 08 strips it. */
    readonly enemy: ReadonlyArray<string>;
    /**
     * TICKET 68: the Drivers this fight's enemy SIDE runs. Empty for every fight but Emberfall's
     * boss and the elites guarding its approach.
     *
     * Reported separately from `enemy` on purpose: a Driver is not a member's firmware, and folding
     * it into the per-enemy string would print it three times and read as though each body carried
     * its own — which is exactly the shape ruling 1 retired.
     */
    readonly enemyDrivers: ReadonlyArray<string>;
    /** The node this was rolled at, for a repro. */
    readonly nodeId: string;
    readonly biomeElements: ReadonlyArray<string>;
    /** Which arm this sample belongs to, and the element it was chosen against. */
    readonly matchup: MatchupMode;
    readonly targetElement: string;
    /** The run-scoped boss override this sample was built under, if any. */
    readonly bossOverride?: BossOverride;
    /** Which leader this sample walked toward — ticket 68 made that matter (`sampleFight`'s `gymId`). */
    readonly gymId: string;
    /**
     * Which grade of `TacticalAI` the enemies play at — ticket 60's ladder, third column.
     *
     * Read off the encounter rather than derived from the cell, for the reason the encounter carries
     * it at all: getting it right needs the node kind, the run's tier and the opening-fight rule
     * together, and a harness holding a second opinion about any of the three would silently measure
     * a ladder the game does not field.
     */
    readonly enemyAiTier: AiTier;
}

/**
 * The `IRunEncounter` -> `ComposedSetup` translation.
 *
 * **The whole enemy deck rides on `enemies[0]`, and that is not a shortcut.** `IRunEncounter` gives
 * one flat `enemyDeckIds` because a side's deck is shared, and `buildScenarioState` rebuilds the
 * enemy pile as `setup.enemies.flatMap(e => e.deck ?? [])` — precisely as `createBattleState` does.
 * So one enemy carrying the list and the rest carrying nothing reproduces the run's shared pile
 * exactly, while splitting it per member would only invent an ownership the run does not have.
 *
 * `statJitter` is the corpus's `BALANCE_STAT_JITTER` (ticket 19): one roll per sample, applied
 * identically to both sides, so a battle stays fair while the absolute HP and damage numbers move
 * off the pinned frame that used to make single power points flip 37-point cliffs. Here it does a
 * second job — it is the only thing that varies the PLAYER's stats between samples, since the
 * player's IVs are pinned and the enemy's are rolled by the run.
 */
function setupForEncounter(
    seed: string,
    party: ReadonlyArray<IMingmingState>,
    deck: ReadonlyArray<string>,
    enemyParty: ReadonlyArray<{ definitionId: string; activeOS?: string; attackIV: number; defenseIV: number; hpIV: number }>,
    enemyDeckIds: ReadonlyArray<string>,
    /** Ticket 68: the fight's enemy-side Drivers, carried on the encounter. */
    enemyDrivers: ReadonlyArray<string> = [],
): ComposedSetup {
    const enemies: EnemySetup[] = enemyParty.map((enemy, index) => ({
        definitionId: enemy.definitionId,
        activeOS: enemy.activeOS ?? NO_FIRMWARE_OS,
        attackIV: enemy.attackIV,
        defenseIV: enemy.defenseIV,
        hpIV: enemy.hpIV,
        deck: index === 0 ? [...enemyDeckIds] : [],
    }));

    return {
        seed,
        // `rollEncounter`'s own ruling, re-exported by the encounter module so this cannot drift:
        // a run enemy plays cards, not telegraphed intents. `runBatch` rejects anything else.
        enemyMode: RUN_ENEMY_MODE,
        player: { party: party.map(asSetupMember), deck: [...deck], relics: [] },
        enemies,
        // Ticket 68. Omitted rather than sent empty so that every setup written before this ticket
        // serializes byte-identically — the gate's own repros are compared as JSON.
        ...(enemyDrivers.length > 0 ? { enemyDrivers: [...enemyDrivers] } : {}),
        statJitter: BALANCE_STAT_JITTER,
    };
}

const describeEnemy = (definitionId: string, activeOS?: string): string =>
    `${definitionId}(${activeOS ?? 'no firmware'})`;

/**
 * Build sample `index` of `cell`: a whole run, a node in it, and the fight that node rolls.
 *
 * Every sample gets its **own run seed**, and that is the load-bearing choice in this function.
 * `rollEncounter` is deterministic in `(run.seed, node.id, node.visited)` — NOT in the battle seed —
 * so running one setup for 50 iterations would replay the same three enemies fifty times with only
 * the shuffle moving. Varying the run seed instead varies the region graph, which biomes stand in
 * for each element, which node the sample lands on, and the species and IVs the node rolls. That is
 * what makes a pooled cell a statement about "a wild at biome 1" rather than about one particular
 * pair of huldras.
 *
 * The gym offer is chosen as `index % 3` rather than randomly, so a run of `--iterations 3k` covers
 * the three leaders evenly. It matters more than it looks: since Henry's 2026-08-30 ruling the
 * leader alone fixes the whole element ORDER of the run — gym element first, then twice along the
 * counter-chain — and with it which counter matchups the player meets at which depth. The walk
 * order is no longer a rolled quantity, so striding the leaders evenly is now the ONLY thing
 * spreading this harness across the three orderings.
 */
export function sampleFight(
    cell: RunGateCell,
    index: number,
    matchup: MatchupMode = 'blind',
    bossOverride?: BossOverride,
    /**
     * TICKET 68: pin every sample to ONE gym leader.
     *
     * Unpinned, the offer is `index % 3` so a cell walks all three leaders evenly, which is right
     * for a band verdict about "the gauntlet" and wrong the moment the three leaders stop being the
     * same fight. Ticket 68 authored Emberfall and left Tidewrack and Rootfall on ticket 18's
     * formula boss (ruling 6), so an unpinned `gauntlet:fight2` at 60 iterations now measures
     * twenty rebuilt bosses blended with forty unchanged ones and reports the average as a number
     * about neither.
     *
     * A pinned arm is therefore NOT comparable to §12's 0/60 — it is a different population, and
     * §13 says so where it reports one. Both are worth having: pinned answers "is the rebuilt
     * Emberfall beatable", unpinned answers "did the gauntlet band move".
     */
    gymId?: string,
    /**
     * A party and deck somebody DESIGNED, in place of the arm's generated lineup.
     *
     * Substitutes the lineup, the party instances and the deck — and nothing else. The offer, run
     * seed, region graph, node, encounter roll, boss, Driver, IVs and AI tier are all still built by
     * the code below from the same seed stride, so a hand-built number is directly comparable to the
     * `favourable` and `control` numbers at the same cell and gym.
     *
     * `matchup` is ignored when this is set — the lineup is given rather than chosen — but
     * `targetElement` is still reported, because it is a property of the gym rather than of the arm.
     */
    handbuilt?: HandbuiltParty,
    /** Which shopping policy the party arrives on — see `ToolboxMode` and the block below. */
    toolbox?: ToolboxMode,
    /**
     * Named, uncommitted balance knobs — see `experimentalTweaks.ts`.
     *
     * Only the ENEMY-PILE knob is read here; the registry-level ones (`ink-power-N`, `thorn-target`)
     * were already applied process-wide before this ran. The whole list is carried anyway so the
     * knobs thread through ONE parameter and a knob added later cannot be forgotten at this call.
     */
    tweaks?: ReadonlyArray<string>,
    /** Build the party around this element instead of the gym's counter — see `LEAN_TARGET`. */
    lean?: string,
    /** How much of its own kit the party has assembled — ticket 77 Track A. See `DeckMode`. */
    deckMode?: DeckMode,
): SampledFight {
    const seed = `run-gate:${cell.id}:${index}`;

    /*
     * THE OFFER IS PICKED BEFORE THE PARTY, AND THAT ORDER IS THE WHOLE TRICK.
     *
     * A prepared player chooses their team knowing where they are going, and the biome elements live
     * on the gym OFFER — `offerGyms` decides them, `createRun` only copies them onto the run. So the
     * offer is rolled first, the target element read off it, and the lineup chosen against that.
     * `blind` ignores the target entirely and reproduces the original stride, which is what keeps
     * every number taken before this ruling reproducible.
     */
    const offers = offerGyms(seed);
    // Pinned: the offer for the named leader, which `offerGyms` guarantees is present exactly once
    // (rule 3 — every run is offered all three). Unpinned: the even stride over all three.
    const offer = gymId
        ? offers.find((candidate) => candidate.gym.id === gymId) ?? offers[index % offers.length]
        : offers[index % offers.length];
    const target = targetElementFor(cell, offer.gym, offer.biomes);

    /*
     * `--lean` moves ONLY the element the picker is aimed at. The gym, the biomes, the enemy roll,
     * the seed and `targetElement` in the report are all still the gym's own, so a leaned arm is
     * directly paired against an unleaned one at the same cell.
     */
    const lineupTarget = lean !== undefined ? (LEAN_TARGET[lean] ?? target) : target;
    const lineup = handbuilt
        ? [...handbuilt.lineup]
        : lineupAgainst(index, cell.partySize, lineupTarget, lean !== undefined ? 'favourable' : matchup);
    const party = partyFor(lineup);

    const created = createRun({ seed, offer, party, startedAt: 0 });
    /*
     * `deckFor` cross-checks against `createRun`'s own deal and throws on any mismatch, which is
     * right for a generated arm and wrong for a hand-built one: the whole point of a hand-built deck
     * is that it is NOT the start deck. Taken verbatim instead, and the length is deliberately not
     * validated — a designed deck is 26 cards where the start deal is 18.
     *
     * A handbuilt party with NO `deck` falls through to the run-dealt one on purpose: that is the
     * shape for measuring a PARTY rather than a deck list. See `HandbuiltParty.deck`.
     */
    let deck = handbuilt?.deck ? [...handbuilt.deck] : deckFor(created, party);

    /*
     * `--toolbox`: the party arrives holding the gym's three ruled counter answers.
     *
     * # WHAT THIS MODELS, STATED PLAINLY, BECAUSE IT IS NOT THE AVERAGE PLAYER
     *
     * This is a CEILING, not a typical run. The neutral slot offers ONE card per market visit drawn
     * from an eleven-entry list, so three specific answers across three visits is a lucky run, not a
     * median one. Modelling the median would fold acquisition luck into a boss verdict and answer
     * two questions at once.
     *
     * The ceiling is the right question for the HELD Tidewrack verdict specifically: *if the boss is
     * still unbeatable by a player holding its designed counters, the counters are not the answer and
     * the boss's own numbers are.* If it IS beatable, the open question becomes acquisition
     * probability — a different measurement, on the market rather than on the gym.
     *
     * Read off `GYM_COUNTER_ANSWERS` rather than a list here, so the arm and the shop cannot drift.
     *
     * # TICKET 75: THREE SHOPPING POLICIES, NOT ONE
     *
     * `all` is the original ceiling above. The other two exist because research/75 measured that
     * ceiling costing the player 11.5 points at every gym, and Henry ruled the -11.5 be DIAGNOSED
     * rather than acted on: it cannot distinguish a bad SHOPPING POLICY from bad PRINTINGS.
     *
     *  - **`selective`** — the two answers a player would actually prioritise (`GYM_SELECTIVE_ANSWERS`,
     *    cheapest-first). If the basket is the problem, this arm recovers most of the loss.
     *  - **`card:<id>`** — exactly ONE card into the bare deck. This is the arm that lets a reprice be
     *    ruled on a card's own number instead of the basket's, which is ruling 1b's whole point. The
     *    id is NOT checked against the gym's answer set on purpose: asking what `scrubber` costs at
     *    Emberfall is a legitimate question and the harness should not have an opinion about it.
     */
    /*
     * TICKET 77 TRACK A, applied BEFORE the toolbox so the two compose in the obvious order: the
     * progression mode says what kit you assembled, the toolbox says what you then bought. A
     * handbuilt party's declared deck is left alone — `deckForMode` returns undefined for `bare`.
     */
    const progressed = deckForMode(deckMode, party, deck);
    if (progressed !== undefined) deck = [...progressed];

    const answers = toolboxAnswersFor(toolbox, offer.gym.id);
    if (answers.length > 0) deck = [...deck, ...answers];

    // Not the opening fight — see `fightsResolvedAt`. Written as a spread rather than mutated
    // because `IRunState` is deeply readonly, which is right for every consumer but this one.
    const run: IRunState = { ...created, fightsResolved: fightsResolvedAt(cell.biomeIndex) };

    const node = pickNode(run, cell, index);
    // `encounterSeed` folds the visit count in, and both roll functions document that the node they
    // are handed must ALREADY be visit-incremented — `runSlice.enterNode` does the increment and the
    // caller reads the node back out. This is that increment.
    const entered: IRegionNode = { ...node, visited: node.visited + 1 };

    const encounter = cell.kind === 'gauntlet'
        ? rollGauntletFight({ run, node: entered, fightIndex: cell.fightIndex! })
        : rollEncounter({ run, node: entered, party });

    // Run-scoped, and applied AFTER the roll so the enemies, the deck and the seed are the ones the
    // shipped game would field — only the named knob differs from the 0/60 baseline.
    const enemyParty = withBossOverride(cell, encounter.enemyParty, bossOverride);

    // `--boss-relics off` means "the boss without its signature passive". Ticket 68 moved where that
    // passive lives for an authored gym, so the flag follows it — see `BossOverride.relics`.
    const stripSignature = bossOverride?.relics === 'off'
        && cell.kind === 'gauntlet'
        && isBossFight(cell.fightIndex ?? 0, GAUNTLET_FIGHTS);
    const enemyDrivers = stripSignature ? [] : (encounter.enemyDrivers ?? []);

    /*
     * The enemy-pile knob, applied AFTER the roll for the same reason `withBossOverride` is: the
     * seed, the node, the bodies and the Drivers must all be the ones the unmodified arm rolled, or
     * the paired comparison is measuring the knob plus a different fight. See `experimentalTweaks`.
     */
    const enemyDeckIds = tweakEnemyDeck(encounter.enemyDeckIds, tweaks ?? []);

    return {
        setup: setupForEncounter(encounter.seed, party, deck, enemyParty, enemyDeckIds, enemyDrivers),
        lineup,
        enemyDrivers,
        enemyAiTier: encounter.enemyAiTier,
        enemy: enemyParty.map((e) => describeEnemy(e.definitionId, e.activeOS)),
        nodeId: entered.id,
        biomeElements: run.biomes.map((b) => b.elements.join('/')),
        matchup,
        targetElement: target,
        bossOverride,
        gymId: offer.gym.id,
    };
}

/**
 * Which node in the generated graph this sample fights at.
 *
 * **Biome 0's layer-0 entry is excluded from the wild pool, and it is the only exclusion.** That node
 * is a `wild` by kind (`NODE_KINDS` has no `'entry'`) but the player starts the run standing on it
 * and `generateRegionGraph` marks it `visited: 1` precisely so the entry-trigger rule does not fire a
 * fight before the run has begun. It is the one wild node in a run that is never fought. Biomes 1 and
 * 2 open on an entry wild the player genuinely does fight, so those stay in.
 *
 * The choice among the eligible nodes is a seeded draw rather than "the first one", because layer
 * position is not neutral: taking `nodes[0]` every time would sample the same layer of every graph.
 *
 * A biome with no node of the wanted kind is possible and is not an error — `elite` is 10% of the
 * middle mix and biome 2's exit is the gym, not an elite, so a biome-2 graph can genuinely contain no
 * elite at all. The sample is then re-rolled at the next index rather than the cell being dropped;
 * `measure` handles that by walking indices until it has the samples it asked for.
 */
function eligibleNodes(run: IRunState, cell: RunGateCell): ReadonlyArray<IRegionNode> {
    if (cell.kind === 'gauntlet') return run.nodes.filter((n) => n.kind === 'gym');
    return run.nodes.filter((n) =>
        n.kind === cell.kind
        && n.biomeIndex === cell.biomeIndex
        && !(n.biomeIndex === 0 && n.layer === 0));
}

function pickNode(run: IRunState, cell: RunGateCell, index: number): IRegionNode {
    const eligible = eligibleNodes(run, cell);
    if (eligible.length === 0) {
        throw new NoSuchNodeError(`[run-gate] ${cell.id} sample ${index}: no ${cell.kind} node.`);
    }
    const stream = new SeedStream(`run-gate:node:${cell.id}:${index}`);
    return eligible[stream.nextInt(0, eligible.length - 1)];
}

/** Thrown when a generated graph happens to contain no node of the wanted kind. Not a failure. */
class NoSuchNodeError extends Error {}

// ---------------------------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------------------------

/**
 * PAYOFF CARDS — every card whose damage depends on setup, derived from the registry rather than
 * listed here.
 *
 * Ticket 77 asks each arm to report **payoff casts per fight**: how often a member's engine actually
 * assembled. "Engine" needs a definition that is not an opinion, and the registry already carries
 * one — a card with a `scaling` field is precisely a card whose value comes from what the rest of
 * the deck did first (`hexbloom` on Weakened, `ink_stream` on triggered draws, `serpents_coil` on
 * cards played). A transcribed list here would drift from `programs.json` the moment a printing
 * moved, which is the `GYM_COUNTER_ANSWERS` lesson.
 *
 * This is the number ticket 77 is really about. A win rate says a deck lost; payoff casts say
 * whether it ever got to do the thing it was built to do.
 */
const PAYOFF_CARDS: ReadonlySet<string> = new Set(
    Object.entries(ProgramRegistry)
        .filter(([, card]) => card.actions?.some((a) => a.scaling !== undefined))
        .map(([id]) => id),
);

/** Per-cell player-side diagnostics — ticket 77. Undefined when telemetry was not collected. */
export interface CellDiagnostics {
    /** Fraction of card instances that reached the player's hand and were never played. */
    readonly deadCardRatio: number;
    /** Player casts of a `scaling` card, per fight. See `PAYOFF_CARDS`. */
    readonly payoffCastsPerFight: number;
    /** Total damage the player dealt, per turn of battle. */
    readonly playerDamagePerTurn: number;
    /** Total damage the enemy dealt, per turn of battle. */
    readonly enemyDamagePerTurn: number;
    /** Cards the player's deck held, averaged over samples — the dilution denominator. */
    readonly deckSize: number;
}

/** Pull ticket 77's four player-side numbers out of a cell's raw runs. */
function diagnose(runs: ReadonlyArray<RunResult>, deckSizes: ReadonlyArray<number>): CellDiagnostics | undefined {
    const withTelemetry = runs.filter((r) => r.telemetry !== undefined);
    if (withTelemetry.length === 0) return undefined;

    let payoff = 0;
    let playerDamage = 0;
    let enemyDamage = 0;
    let turns = 0;
    for (const run of withTelemetry) {
        const played = run.telemetry!.PLAYER.played;
        for (const [id, count] of Object.entries(played)) {
            if (PAYOFF_CARDS.has(id)) payoff += count;
        }
        playerDamage += run.telemetry!.PLAYER.totalDamage;
        enemyDamage += run.telemetry!.ENEMY.totalDamage;
        turns += run.turns;
    }

    let dead = 0;
    let seen = 0;
    for (const run of runs) {
        dead += run.deadCards.player * run.cardsSeen.player;
        seen += run.cardsSeen.player;
    }

    return {
        deadCardRatio: seen === 0 ? 0 : dead / seen,
        payoffCastsPerFight: payoff / withTelemetry.length,
        playerDamagePerTurn: turns === 0 ? 0 : playerDamage / turns,
        enemyDamagePerTurn: turns === 0 ? 0 : enemyDamage / turns,
        deckSize: deckSizes.length === 0 ? 0 : deckSizes.reduce((a, b) => a + b, 0) / deckSizes.length,
    };
}

export interface CellMeasurement extends RunGateCell {
    readonly samples: number;
    readonly battles: number;
    readonly wins: number;
    readonly winRate: number;
    readonly decisiveWinRate: number;
    readonly averageTurns: number;
    readonly ftkCount: number;
    readonly truncatedCount: number;
    readonly elapsedMs: number;
    /** `species(firmware)` lists, one entry per sample, in sample order. */
    readonly enemiesSeen: ReadonlyArray<string>;
    /** Player OS lineups, one entry per sample, in sample order. */
    readonly lineupsSeen: ReadonlyArray<string>;
    /** Ticket 77's player-side numbers. Present whenever telemetry was collected. */
    readonly diagnostics?: CellDiagnostics;
}

export interface BandMeasurement {
    readonly band: BandId;
    readonly target: number;
    readonly measured: number;
    /** Wilson 95% interval on `measured`. Wide at small samples, which is the point of printing it. */
    readonly low: number;
    readonly high: number;
    readonly wins: number;
    readonly battles: number;
    /**
     * GAUNTLET ONLY: the product of the three fights' rates — the chance of clearing the gym, which
     * is the quantity the 60% target is about. Present only on the gauntlet band, and it is the
     * number `inBand` grades there. See `measureBand`.
     */
    readonly compound?: number;
    /**
     * Whether the band met its target. **For the gauntlet this grades `compound`, not `measured`**
     * (Henry, 2026-08-30); for a wild or an elite the two are the same quantity.
     */
    readonly inBand: boolean;
    readonly elapsedMs: number;
    readonly cells: ReadonlyArray<CellMeasurement>;
}

/**
 * Wilson score interval — the right one for this job and not the textbook `p ± 1.96·sqrt(pq/n)`.
 *
 * The normal approximation degenerates exactly where this gate lives: at a WILDS band near 95% with a
 * few dozen battles it produces an upper bound above 1.0, and at a clean sweep (`p = 1`) it produces
 * a zero-width interval that claims certainty from a handful of games. Wilson is bounded in [0,1] and
 * stays finite at `p = 0` and `p = 1`, so a "17/17, so 100%" cell prints an honest floor instead of a
 * fake certainty.
 */
export function wilson(wins: number, n: number, z = 1.96): { low: number; high: number } {
    if (n === 0) return { low: 0, high: 1 };
    const p = wins / n;
    const denominator = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return { low: (centre - spread) / denominator, high: (centre + spread) / denominator };
}

export interface MeasureOptions {
    /** Samples per cell. Each sample is one battle — see the header on why this is not paired. */
    readonly iterations: number;
    readonly maxTurns?: number;
    /** Called once per finished sample, so a half-hour run is not a silent one. */
    readonly onProgress?: (cell: RunGateCell, sampleIndex: number, elapsedMs: number, won: boolean) => void;
    /** Which player to model. Defaults to `blind` — see `MatchupMode`. */
    readonly matchup?: MatchupMode;
    /** Run-scoped boss isolation, ticket 67 R3. Undefined ships the boss as authored. */
    readonly bossOverride?: BossOverride;
    /**
     * Ticket 68: pin every sample to one gym leader. Undefined walks all three evenly, which is the
     * band's own stride and the only arm comparable to the numbers taken before this ticket. See
     * `sampleFight`'s `gymId` for why the two are different populations.
     */
    readonly gymId?: string;
    /** A designed party and deck in place of the arm's generated one — see `HandbuiltParty`. */
    readonly handbuilt?: HandbuiltParty;
    /** Which shopping policy the party arrives on — see `ToolboxMode`. Bare is the GRADING arm. */
    readonly toolbox?: ToolboxMode;
    /** Build the party around this element instead of the gym's counter — ticket 76's lean bracket. */
    readonly lean?: string;
    /** How much of its own kit the party has assembled — ticket 77 Track A. See `DeckMode`. */
    readonly deckMode?: DeckMode;
    /**
     * Named, uncommitted balance knobs for THIS measurement only — see `experimentalTweaks.ts`.
     *
     * A number taken with these set is not a baseline, and the report banner says so. The
     * registry-level knobs are applied by the CLI before anything is built; only the enemy-pile knob
     * is read down in `sampleFight`.
     */
    readonly tweaks?: ReadonlyArray<string>;
}

/**
 * Play every sample of one cell and pool the results.
 *
 * `runBatch(setup, { iterations: 1 })` per sample rather than one batch of N, because the enemies are
 * a property of the SAMPLE (see `sampleFight`) and a batch would replay one roll N times. The pooling
 * is `aggregate`'s, shared with every other suite here, so a cell's `winRate`, `averageTurns` and
 * `truncatedCount` mean exactly what they mean in `balance_report.json`.
 *
 * **A skipped sample is re-rolled, never counted.** `pickNode` throws `NoSuchNodeError` when a
 * generated graph has no node of the wanted kind (a biome-2 elite is a 10%-weighted middle node and
 * can genuinely be absent), so the loop walks forward through sample indices until it has the
 * `iterations` it was asked for. The alternative — counting a missing node as a skipped cell — would
 * quietly shrink the sample and make `--iterations` mean different things in different bands. The
 * walk is bounded so a cell that can never be sampled fails loudly instead of spinning.
 */
export function measureCell(cell: RunGateCell, options: MeasureOptions): CellMeasurement {
    const started = Date.now();
    const runs: RunResult[] = [];
    const enemiesSeen: string[] = [];
    const lineupsSeen: string[] = [];
    const deckSizes: number[] = [];

    const limit = options.iterations * 8 + 16;
    let index = 0;
    while (runs.length < options.iterations) {
        if (index >= limit) {
            throw new Error(
                `[run-gate] ${cell.id}: only ${runs.length} of ${options.iterations} samples in ` +
                `${limit} attempts — the graph is not producing '${cell.kind}' nodes at biome ` +
                `${cell.biomeIndex}.`,
            );
        }
        const at = index;
        index += 1;

        let fight: SampledFight;
        try {
            /*
             * EVERY option is threaded here, and the completeness of this line is load-bearing.
             *
             * `handbuilt` and `toolbox` were both declared on `MeasureOptions`, accepted by the CLI,
             * printed in the report banner — and DROPPED at this call. The arms ran, the banner said
             * TOOLBOX, and the measurement was of the bare arm: 30 battles whose outcome sequence was
             * byte-identical to the control, which is the only reason it was caught at all.
             *
             * `optionsThreading.test.ts` now asserts that a `measureCell` option actually reaches
             * `sampleFight`, because the failure is silent, survives a full green suite, and costs
             * whatever the run cost.
             */
            fight = sampleFight(
                cell, at, options.matchup ?? 'blind', options.bossOverride, options.gymId,
                options.handbuilt, options.toolbox, options.tweaks, options.lean, options.deckMode,
            );
        } catch (error) {
            if (error instanceof NoSuchNodeError) continue;
            throw error;
        }

        const batch = quietly(() => runBatch(fight.setup, {
            iterations: 1,
            maxTurns: options.maxTurns ?? DEFAULT_MAX_TURNS,
            startingSide: 'PLAYER',
            // Ticket 60's ladder. Without this the gate would play every rung at the process
            // default — full lookahead everywhere — and report a game the run does not field.
            enemyAiTier: fight.enemyAiTier,
            // Ticket 77: the arms are judged on whether the player's ENGINE assembled, not only on
            // whether it won, and `played`/`totalDamage` are where that lives.
            telemetry: true,
        }));
        runs.push(...batch.runs);
        enemiesSeen.push(fight.enemy.join(' + '));
        deckSizes.push(fight.setup.player.deck.length);
        lineupsSeen.push(fight.lineup.join(' + '));
        options.onProgress?.(cell, runs.length, Date.now() - started, batch.playerWins > 0);
    }

    const pooled = aggregate(runs);
    return {
        ...cell,
        samples: runs.length,
        battles: pooled.iterations,
        wins: pooled.playerWins,
        winRate: pooled.winRate,
        decisiveWinRate: pooled.decisiveWinRate,
        averageTurns: pooled.averageTurns,
        ftkCount: pooled.ftkCount,
        truncatedCount: pooled.truncatedCount,
        elapsedMs: Date.now() - started,
        enemiesSeen,
        lineupsSeen,
        diagnostics: diagnose(runs, deckSizes),
    };
}

/**
 * Measure one band: every cell in it, pooled.
 *
 * **The band reads `winRate`, not `decisiveWinRate`, and that is a deliberate departure from the rest
 * of this directory.** §2's redlines are read against `decisiveWinRate` because a draw is symmetric —
 * neither deck won — and counting it as a loss manufactures a bias when comparing two decks. A run
 * gate is not comparing decks: it is asking whether the player's run continues, and a run in which
 * both sides die does not continue. So a draw is a loss here, and `decisiveWinRate` is printed beside
 * it so the gap between the two is visible when a band stalls.
 */
export function measureBand(
    band: BandId,
    cells: ReadonlyArray<RunGateCell>,
    options: MeasureOptions,
): BandMeasurement {
    const started = Date.now();
    const measured = cells.filter((cell) => cell.band === band).map((cell) => measureCell(cell, options));

    const wins = measured.reduce((sum, cell) => sum + cell.wins, 0);
    const battles = measured.reduce((sum, cell) => sum + cell.battles, 0);
    const rate = battles === 0 ? 0 : wins / battles;
    const { low, high } = wilson(wins, battles);

    const result: BandMeasurement = {
        band,
        target: RUN_GATE_TARGETS[band],
        measured: rate,
        low,
        high,
        wins,
        battles,
        inBand: bandVerdict(rate, RUN_GATE_TARGETS[band]),
        elapsedMs: Date.now() - started,
        cells: measured,
    };

    /*
     * THE GAUNTLET IS GRADED ON ITS COMPOUND — Henry, 2026-08-30, ratified in
     * `research/69-toolbox-printings.md`.
     *
     * 60% is the chance of CLEARING THE GYM, which is three fights on one HP pool. Grading it
     * against the pooled per-fight rate compares a per-fight number to a whole-gauntlet target, and
     * they are not the same quantity: a uniform gauntlet needs `0.60^(1/3)` = **84.3% per fight** to
     * clear at 60%.
     *
     * That mistake had a cost. Emberfall's three fights measured **83.3 / 90.0 / 80.0**, whose
     * product is **60.0% — exactly on target** — and the gate called it FAIL by 23 points for
     * several sessions running, which is where the HELD "the boss is 15pt ABOVE target" ruling came
     * from. Those historical FAILs are re-read, not re-run.
     *
     * The compound was ALREADY computed here (`gauntletCompound`) and printed as a footnote. Only
     * the verdict read the wrong number. Both are reported either way; the graded one is now the
     * one the target is about, and `runRunGate` says which is which so the table cannot be misread
     * the same way twice.
     *
     * The other two bands are unchanged: a wild and an elite are single fights, so their pooled rate
     * IS the quantity their target describes.
     */
    if (band !== 'gauntlet') return result;

    /*
     * ...but ONLY when all three fights were actually measured. A compound over a partial cell set is
     * not a clear rate — `--cells gauntlet:fight2` alone would report the boss's own win rate as "the
     * chance of clearing all three fights", which is a worse misreading than the one this change
     * fixes, and a more confident-sounding one.
     *
     * With a partial set the band falls back to the pooled rate and `compound` stays undefined, which
     * is what `runRunGate` keys its wording off.
     */
    const measuredFights = new Set(measured.map((cell) => cell.id));
    const complete = Array.from({ length: GAUNTLET_FIGHTS })
        .every((_, i) => measuredFights.has(`gauntlet:fight${i}`));
    if (!complete) return result;

    const compound = gauntletCompound(result);
    return { ...result, compound, inBand: bandVerdict(compound, RUN_GATE_TARGETS[band]) };
}

/**
 * The gauntlet's compound: the chance a party clears all three fights, if the three were independent
 * and it arrived at each one whole.
 *
 * **Both of those conditions are false, so this is an UPPER BOUND and is printed unbanded.** The
 * gauntlet carries HP between fights with no heal (`IGauntletProgress.persistedHp`), which is the
 * single largest thing this harness cannot model — `ComposedSetup` has no gauntlet HP carry, and
 * `gauntlet-boss.balance.ts` reached the same wall in the same words ("inventing one would make the
 * number mean something else again"). A party that wins fight 1 at 40 HP is not the party this gate
 * sends into fight 2. Every gauntlet number here is therefore measured from full HP and reads HIGH
 * against a played run; the per-fight rates are the honest part, the product is the optimistic
 * ceiling, and the gap between this and a playtest is exactly the size of the HP carry.
 */
export function gauntletCompound(band: BandMeasurement): number {
    return band.cells.reduce((product, cell) => product * cell.winRate, 1);
}
