/**
 * THE GYM GAUNTLET — ticket 18 (steam-release map).
 *
 * `exploration-map.md`: *"The gym is a GAUNTLET: three fights, NO healing between them"*, against
 * *"FULL HEAL between regular nodes"*. This module owns what is in each of those three fights;
 * `ui/store/runSlice.ts` owns the progress between them (`IGauntletProgress`), and the two meet at
 * `battleSetup.buildBattleSetup`, which is the only place HP is ever carried into a battle.
 *
 * # WHY THIS IS NOT `rollEncounter`
 *
 * A region node rolls one fight sized to your party, from its own biome, at its own depth
 * (`encounter.ts`). A gauntlet is three fights in a row, always three enemies whatever the player
 * brings, drawn from **all three** of the run's biomes rather than the one you are standing in, and
 * its last fight is a boss team with signature firmware. Four of those five properties are things
 * `rollEncounter` deliberately does not have a parameter for, so this is a sibling of that function
 * rather than a flag on it. What it *does* reuse is everything that would otherwise drift: the seed
 * derivation (`nodeSeed`), the ruled kit fraction (`kitFractionFor`, which pins the gym to ticket
 * 08's deepest row), the species pools (`encounterSpeciesPool`), and the same 10-31 IV band.
 *
 * # THE THREE FIGHTS
 *
 * | fight | who | firmware |
 * |---|---|---|
 * | 1 | the leader's team, drawn from the run's three biomes | its own, tuned deck |
 * | 2 | the same, re-rolled | its own, tuned deck |
 * | 3 | **the boss team: one species per biome, in biome order** | `boss_relic_*` |
 *
 * Ticket 18: *"the BOSS team draws one species from each of the run's three biomes — the run trains
 * you for its own exam"*, which `runTypes.ts` already states from the other end: the biome elements
 * are *"the final exam's syllabus"*. Fights 1 and 2 draw from the same union rather than from one
 * biome each, so the exam is not a three-part quiz with a predictable order — what is fixed is that
 * everything you meet here is something the region taught you.
 *
 * # NO SCALING, HERE LEAST OF ALL (ticket 21)
 *
 * The branch this module replaces gave its boss `maxHp * 1.5`. Nothing here multiplies a stat.
 * `vision.md`'s "never bigger numbers" is hardest to keep at the one fight a run is aimed at, which
 * is exactly why it is kept: the boss is harder because it fields a full tuned deck behind signature
 * firmware and because you arrive at it on whatever HP the first two fights left you, not because
 * its health bar was multiplied.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()` — everything procedural threads through `SeedStream` so a resumed gauntlet rebuilds
 * the identical opponents.
 */

import { SeedStream } from '../core/SeedStream';
import { GetMingmingData, getDeckForOS } from '../data/mingmingRegistry';
import { initializeBattleEntity } from '../types';
import type { IBattleEntity, IMingmingState } from '../types';
import type { IRegionNode, IRunState } from '../runTypes';
import { encounterSpeciesPool } from './encounter';
import type { IRunEncounter } from './encounter';
import { GYM_REGISTRY } from './gyms';
import { nodeSeed } from './nodeSeed';

// ---------------------------------------------------------------------------------------------
// The shape of a gauntlet
// ---------------------------------------------------------------------------------------------

/**
 * Three fights, ruled by `exploration-map.md` and written into `IGauntletProgress.totalFights` by
 * `runSlice.beginGauntlet`. It is a constant rather than a literal at the reducer because the last
 * fight is the boss fight, and "which index is the boss" is a fact two modules have to agree on.
 */
export const GAUNTLET_FIGHTS = 3;

/**
 * **Always three enemies, whatever the player brings** — ticket 18: *"always full 3v3 curated (if
 * the player has fewer than 3, the fight is still 3 vs N)"*.
 *
 * **RATIFIED** by ticket 56 ruling 4 (*"gauntlet boss is always 3 — 3 vs N"*), and re-confirmed by
 * ticket 60's difficulty pass, which changed how hard the gauntlet's three ARE (they gain an OS and
 * a Driver and the full-lookahead AI) without changing how many there are. This block was a
 * "FLAGGED FOR HENRY, reading not ruling" note until 2026-08-25; the reading was correct and the
 * ruling agreed with it, so it is recorded as settled rather than left looking open.
 *
 * The argument, kept because it is why the answer is what it is:
 * the run's own economy. `exploration-map.md` gives a run two workshops and
 * ticket 14 makes each one a real recruit, so arriving at the gym with one or two members is a
 * *choice with a consequence* rather than a shortfall the game should paper over. That is what makes
 * ticket 06's "recruiting IS drafting" mean anything — if the exam shrank to match the party, the
 * scrap spent on a third member would have bought nothing but a spare body. It is nevertheless a
 * difficulty decision, and a solo run into a 1-vs-3 gauntlet is the harshest single moment in the
 * game as it stands; softening it (a scaled boss team, or a floor on the player's side) is one line
 * here plus one in `enemyPartySize`.
 */
export const GAUNTLET_ENEMY_COUNT = 3;

/** Is this fight index the boss fight — the last one? */
export function isBossFight(fightIndex: number, totalFights: number = GAUNTLET_FIGHTS): boolean {
    return fightIndex >= totalFights - 1;
}

// ---------------------------------------------------------------------------------------------
// Signature firmware (ticket 28 authors the real bosses)
// ---------------------------------------------------------------------------------------------

/**
 * The three `boss_relic_*` firmwares that exist in `lib/hooks.json`, in a stable order.
 *
 * They are the ones ticket 18 names — *"carries signature firmware (the `boss_relic_*` OSes
 * exist; authored bosses are ticket 28)"* — and they are the reason a boss reads differently from
 * an overtuned wild: FIRE ignites the field at end of turn, WATER heals the whole enemy side
 * whenever it is hit, ICE taxes programs aimed at a poisoned target.
 */
export const BOSS_RELIC_IDS: ReadonlyArray<string> = [
    'boss_relic_fire',
    'boss_relic_water',
    'boss_relic_ice',
];

/**
 * Which signature a boss drawn from a given biome runs.
 *
 * **Two of the three launch elements have a relic named after them and Nature does not**, so Nature
 * takes the ice relic — and that is less arbitrary than it looks: `boss_relic_ice` is the only one of
 * the three whose effect contains no element at all (it is an Energy tax on programs aimed at a
 * poisoned target, where FIRE deals Fire damage and WATER heals). Handing the element-neutral
 * signature to the element with no signature of its own is the assignment that costs the least
 * fiction, and it keeps the boss team's three firmwares **distinct**, which is what makes the fight
 * read as three threats rather than one tripled.
 *
 * **This is placeholder casting, exactly like `GYM_REGISTRY`'s leader names.** [Ticket
 * 28](../../../docs/wayfinder/steam-release/tickets/28-gym-leaders.md) authors the real gym leaders
 * and their teams, and should replace this table wholesale; what it should keep is the property
 * below, that no two members of one boss team run the same signature.
 */
const BOSS_RELIC_BY_ELEMENT: Readonly<Record<string, string>> = {
    Fire: 'boss_relic_fire',
    Water: 'boss_relic_water',
    Nature: 'boss_relic_ice',
    // Not reachable at Early Access (ticket 05 ships the three above), but a post-launch biome must
    // not fall through to "no firmware at all", which would field a boss weaker than the elite two
    // nodes back. Ice matches by name; everything else takes the fallback below.
    Ice: 'boss_relic_ice',
};

/**
 * The signature for a biome's element, avoiding one already taken by an earlier member of the same
 * boss team.
 *
 * The de-duplication is the interesting half. At Early Access every run walks all three launch
 * elements exactly once (`gyms.offerGyms` rule 3), so the table alone already yields three different
 * relics — but `IBiome.elements` is a 1-or-2 list precisely because that is *not* permanent
 * (`runTypes.ts`, `IBiome`), and two biomes sharing an element would otherwise put two identical
 * WATER relics on one side, stacking a team-wide heal on every hit. Falling through to the first
 * unused relic makes that unrepresentable rather than merely unlikely.
 */
export function bossFirmwareFor(element: string, taken: ReadonlyArray<string>): string {
    const preferred = BOSS_RELIC_BY_ELEMENT[element];
    if (preferred && !taken.includes(preferred)) return preferred;
    const free = BOSS_RELIC_IDS.find((id) => !taken.includes(id));
    // Every relic taken means a boss team larger than the relic list, which `GAUNTLET_ENEMY_COUNT`
    // forbids. Repeating the preferred one is a better answer than an entity with no firmware.
    return free ?? preferred ?? BOSS_RELIC_IDS[0];
}

// ---------------------------------------------------------------------------------------------
// The seed
// ---------------------------------------------------------------------------------------------

/**
 * The seed one gauntlet fight is rolled from: **run seed + node id + visit count + fight index**.
 *
 * The first three are `nodeSeed`'s (ticket 07's re-roll rule, unchanged). The **fight index folded
 * into the purpose label** is what this ticket adds, and it buys both halves of the ticket's
 * determinism requirement at once: fight 2 is not fight 1 (different label, different stream), and a
 * gauntlet resumed after an app close rebuilds the identical opponents (same run, same node, same
 * index, same string). Nothing about the three fights is ever stored — `IGauntletProgress` carries
 * an index, not an enemy list — for the same reason a node's contents are not: a pre-rolled team in
 * the save file is a team that leaks through any save-file inspector.
 */
export function gauntletFightSeed(run: IRunState, node: IRegionNode, fightIndex: number): string {
    return nodeSeed(run, node, `gauntlet:${fightIndex}`);
}

// ---------------------------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------------------------

export interface GauntletFightInput {
    readonly run: IRunState;
    /** The gym node, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    /** 0, 1 or 2 — `IGauntletProgress.fightIndex`. */
    readonly fightIndex: number;
}

/**
 * Every species the run's biomes can field, in biome order, de-duplicated.
 *
 * This is the leader's recruiting ground for fights 1 and 2 and it is deliberately the *union* of the
 * three biome pools rather than the gym biome's alone: the gauntlet is the run's final exam, and an
 * exam set only on the last chapter would make the first two biomes route decoration.
 */
function regionSpeciesPool(run: IRunState, node: IRegionNode): string[] {
    const ids: string[] = [];
    for (let biomeIndex = 0; biomeIndex < run.biomes.length; biomeIndex += 1) {
        // `encounterSpeciesPool` reads the element off the node's biome, so each biome is asked
        // about through a node pointed at it. Reusing it rather than re-deriving the pool is what
        // keeps the gauntlet drawing from exactly the species a wild in that biome could have
        // fielded — including its empty-pool fallback and the warning that goes with it.
        for (const id of encounterSpeciesPool(run, { ...node, biomeIndex })) {
            if (!ids.includes(id)) ids.push(id);
        }
    }
    return ids;
}

/** Draw one species, preferring one not already on this team (map § Notes: one of each species). */
function drawSpecies(pool: ReadonlyArray<string>, taken: ReadonlyArray<string>, stream: SeedStream): string {
    const fresh = pool.filter((id) => !taken.includes(id));
    const from = fresh.length > 0 ? fresh : pool;
    return from[stream.nextInt(0, from.length - 1)];
}

/**
 * Build one enemy. Shared by all three fights so that the boss differs from the leader's team in
 * exactly the two ways the ticket names — which species pool it was drawn from, and its firmware —
 * and in no other way. Nothing here scales with the fight index.
 */
function buildEnemy(
    definitionId: string,
    nickname: string,
    firmware: string | null,
    stream: SeedStream,
): { entity: IBattleEntity; deck: string[] } {
    const definition = GetMingmingData(definitionId);

    // Ticket 21: IVs are the only per-individual variance left, and the band is the same one
    // `rollEncounter` uses at every depth. The gym does not roll hotter individuals; it fields
    // better teams.
    const hpIV = stream.nextInt(10, 31);
    const attackIV = stream.nextInt(10, 31);
    const defenseIV = stream.nextInt(10, 31);

    // Drawn even when a signature overrides it, so that adding or removing a boss relic cannot shift
    // which species the *next* member of the team is — the same stream-position discipline
    // `rollEncounter` keeps between depths.
    const nativeOS = definition.availableOS[stream.nextInt(0, definition.availableOS.length - 1)];
    const activeOS = firmware ?? nativeOS;

    const state: IMingmingState = {
        id: stream.nextId(`gym_${definitionId}`),
        definitionId,
        nickname,
        activeOS,
        blueprintsCollected: 0,
        hpIV,
        attackIV,
        defenseIV,
    };

    /**
     * Ticket 08's deepest row, `{ deck: 'tuned', os: true }` — `encounter.kitFractionFor` gives
     * every gym node `FULL_KIT_FRACTION`, and `gauntlet.test.ts` pins that rather than letting this
     * file hold a second opinion about the gym's depth. So the enemy holds the full per-OS list the
     * balance corpus is calibrated on, and it runs its firmware.
     *
     * For a boss, `activeOS` is a `boss_relic_*` id and no species has a deck keyed by one, so
     * `getDeckForOS` resolves to `availableOS[0]`'s tuned list by its documented fallback. That is
     * load-bearing rather than incidental: it means a shipped boss is reproducible in the balance
     * harness as nothing more than `[species, boss_relic_x]` (`debug/balance/teamComps.ts`,
     * `BOSS_COMPS`), with no new machinery on either side to keep in step.
     */
    const deck = getDeckForOS(definitionId, activeOS);

    return { entity: initializeBattleEntity(state, definition), deck };
}

/**
 * Roll one fight of the gauntlet. Pure, and deterministic in
 * (`run.seed`, `node.id`, `node.visited`, `fightIndex`).
 *
 * Returns the same `IRunEncounter` a region node produces, because it is consumed by the same code
 * path: `buildBattleSetup(ranch, run, encounter)` → `createBattleState`. The gauntlet does not get a
 * branch inside the battle factory — the one it used to have is what this ticket deleted.
 */
export function rollGauntletFight(input: GauntletFightInput): IRunEncounter {
    const { run, node, fightIndex } = input;

    const seed = gauntletFightSeed(run, node, fightIndex);
    /*
     * ONE labelled stream, where `rollEncounter` forks two.
     *
     * That function splits "who the enemies are" from "what they are holding" because its deck rule
     * varies by depth and one of the three arms mints card instance ids — so a shared stream would
     * let the kit fraction shift which species appeared. Here the deck is a pure lookup
     * (`getDeckForOS`) that draws nothing, so there is no second consumer to isolate, and a second
     * fork would be ceremony that implies a hazard this function does not have. The label is still
     * there so the gauntlet never draws the same numbers as anything else reading this node.
     */
    const roster = new SeedStream(new SeedStream(seed).fork('gauntlet-roster'));

    const gym = GYM_REGISTRY[run.gymId];
    // A run always names a gym in the registry (`createRun` copies it off the offer), so this is the
    // label for a state nothing can produce rather than a case with behaviour of its own.
    const gymName = gym?.name ?? 'Gym';

    const boss = isBossFight(fightIndex, GAUNTLET_FIGHTS);

    const enemyParty: IBattleEntity[] = [];
    const enemyDeckIds: string[] = [];
    const species: string[] = [];
    const firmwares: string[] = [];

    for (let slot = 0; slot < GAUNTLET_ENEMY_COUNT; slot += 1) {
        // The boss team is one species per biome, IN BIOME ORDER, so the member fought last in the
        // fight's line-up is the one from the biome the gym itself stands in (`gyms.offerGyms` rule
        // 4). The leader's earlier teams draw from the whole region instead.
        const biomeIndex = boss ? Math.min(slot, run.biomes.length - 1) : -1;
        const pool = boss
            ? encounterSpeciesPool(run, { ...node, biomeIndex })
            : regionSpeciesPool(run, node);

        const definitionId = drawSpecies(pool, species, roster);
        species.push(definitionId);

        const firmware = boss
            ? bossFirmwareFor(run.biomes[biomeIndex]?.elements[0] ?? '', firmwares)
            : null;
        if (firmware) firmwares.push(firmware);

        // Ticket 28 authors the real names. Until it does, the nickname says which gym's team this
        // is and whether it is the leader's own — a player who cannot tell fight 3 from fight 2 by
        // looking at it has been given no reason to spend a Revive on the way in.
        const nickname = boss
            ? `${gymName} Champion ${GetMingmingData(definitionId).name}`
            : `${gymName} ${GetMingmingData(definitionId).name}`;

        const built = buildEnemy(definitionId, nickname, firmware, roster);
        enemyParty.push(built.entity);
        enemyDeckIds.push(...built.deck);
    }

    return { enemyParty, enemyDeckIds, seed };
}

/**
 * What the Pit Stop is allowed to print about the fight ahead: **its elements, and nothing else**.
 *
 * `exploration-map.md`'s visibility rule is *"types visible, contents hidden"*, and it does not stop
 * being true because the fight is the last one — a species list would tell the player exactly which
 * counter to hold, which is the decision the gauntlet is asking them to have already made. So the
 * between-fights screen gets the elements it needs to price a Revive against a Mend, and no roster.
 *
 * Rolled from the same seed as the fight itself rather than sampled from the biomes, so what the
 * screen promises is what walks out: the same call, one turn earlier.
 */
export function gauntletOpponentElements(input: GauntletFightInput): string[] {
    return rollGauntletFight(input).enemyParty.map((enemy) => enemy.primaryElement as string);
}

