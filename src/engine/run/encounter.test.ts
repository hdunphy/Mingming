/**
 * What is in a node — ticket 11, part 2.
 *
 * Four rulings meet in `rollEncounter`, and each of them is a claim that can be false without
 * anything crashing, which is what makes them worth a test rather than a comment:
 *
 * - **Ticket 07's re-roll.** "Entering a node triggers it again, always... contents are rolled at
 *   node entry from the node's seed + visit count." A cache would look identical until the second
 *   visit, and then it would look like farming was intended to be boring.
 * - **Ticket 11's symmetric sizing**, with ticket 07's two authored exceptions.
 * - **Ticket 08's kit fraction by depth** — the one that decides whether the difficulty curve is a
 *   deck or a coefficient.
 * - **Ticket 21's freeze.** No stat, IV band or HP pool moves with depth. The test for this builds
 *   the *same* encounter at biome 0 and biome 2 and demands the entities be identical, because the
 *   easy way to fail ticket 21 is not to add a multiplier on purpose — it is to let one in through
 *   a "difficulty" parameter that seemed harmless.
 *
 * Plus the full-heal claim from `exploration-map.md`, which is the reason there are no rest nodes.
 */

import { describe, expect, it, vi } from 'vitest';

import {
    FIGHT_KINDS,
    ENEMY_LADDER,
    encounterSeed,
    enemyPartySize,
    isFightNode,
    isOpeningFight,
    enemyLoadoutFor,
    gradeFor,
    rollEncounter,
} from './encounter';
import { buildBattleSetup, toMingmingState } from './battleSetup';
import { STARTER_GENERICS, START_KIT_SIZE, createRun, startKitIdsFor } from './createRun';
import { GYM_REGISTRY, type IGymOffer } from './gyms';
import { createBattleState } from '../data/battleFactories';
import { GENERIC_HIT, GetMingmingData, getDeckForOS } from '../data/mingmingRegistry';
import { GetProgramData } from '../data/programRegistry';
import type { IBiome, IRanchMember, IRanchState, IRegionNode, IRunState, NodeKind } from '../runTypes';
import type { IBattleEntity, IMingmingState } from '../types';

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const member = (id: string, definitionId: string): IMingmingState => ({
    id,
    definitionId,
    activeOS: GetMingmingData(definitionId).availableOS[0],
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
});

/** Three launch species, one per launch element — so every party below is species-unique. */
const KRAKEN = member('mm1', 'kraken');
const FENRIR = member('mm2', 'fenrir');
const RATATOSKR = member('mm3', 'ratatoskr');

const biome = (element: string, index: number): IBiome => ({
    id: `biome_${element.toLowerCase()}_${index}`,
    name: `${element} ${index}`,
    elements: [element],
});

/**
 * A real run, built the way the game builds one. Going through `createRun` rather than hand-writing
 * an `IRunState` literal means these tests exercise the seed the game actually threads, graph
 * included, and cannot drift from `IRunState`'s shape.
 */
function makeRun(elements: ReadonlyArray<string>, seed = 'encounter-test-seed'): IRunState {
    const offer: IGymOffer = {
        gym: GYM_REGISTRY.gym_emberfall,
        biomes: elements.map((element, index) => biome(element, index)),
    };
    // `fightsResolved: 1` — an ORDINARY mid-run state, which is what every suite in this file
    // except the opening-fight block is about. Since 2026-08-23 a run's *first* fight is scripted
    // easy (`isOpeningFight`), so a fresh `createRun` would put every assertion below into the
    // floor case and measure the tutorial instead of the rule it is testing.
    return { ...createRun({ seed, offer, party: [KRAKEN], startedAt: 0 }), fightsResolved: 1 };
}

/** A node, positioned by hand — the graph's own nodes are a different test's subject (ticket 07). */
function node(over: Partial<IRegionNode> = {}): IRegionNode {
    return {
        id: 'b0l2n0',
        kind: 'wild',
        biomeIndex: 0,
        layer: 2,
        pocket: false,
        edges: [],
        visited: 1,
        ...over,
    };
}

/** What identifies an individual, minus anything the kit fraction is allowed to change. */
const identityOf = (entity: IBattleEntity) => ({
    definitionId: entity.definitionId,
    hpIV: entity.hpIV,
    attackIV: entity.attackIV,
    defenseIV: entity.defenseIV,
    maxHp: entity.maxHp,
    attack: entity.attack,
    defense: entity.defense,
    maxEnergy: entity.maxEnergy,
    cardDraw: entity.cardDraw,
});

// ---------------------------------------------------------------------------------------------
// Ticket 07 — the seed, and the re-roll
// ---------------------------------------------------------------------------------------------

describe('encounterSeed', () => {
    it('is a pure function of (run seed, node id, visit count)', () => {
        const run = makeRun(['Fire', 'Water', 'Nature']);
        const twin = makeRun(['Fire', 'Water', 'Nature']);

        expect(encounterSeed(run, node())).toBe(encounterSeed(twin, node()));
    });

    it('changes when any one of the three changes', () => {
        const run = makeRun(['Fire', 'Water', 'Nature']);
        const base = encounterSeed(run, node());

        expect(encounterSeed(makeRun(['Fire', 'Water', 'Nature'], 'other-seed'), node())).not.toBe(base);
        expect(encounterSeed(run, node({ id: 'b0l2n1' }))).not.toBe(base);
        expect(encounterSeed(run, node({ visited: 2 }))).not.toBe(base);
    });
});

describe('rollEncounter — ticket 07: entering a node triggers it AGAIN', () => {
    const run = makeRun(['Fire', 'Water', 'Nature']);
    const party = [KRAKEN, FENRIR];

    it('re-rolls the same visit identically', () => {
        // The resume contract (ticket 23): an app close mid-fight comes back to the same fight.
        const first = rollEncounter({ run, node: node({ visited: 1 }), party });
        const second = rollEncounter({ run, node: node({ visited: 1 }), party });

        expect(second).toEqual(first);
    });

    it('rolls a DIFFERENT fight on the second visit to the same node', () => {
        // "Wilds re-fight (full rewards — farming is fine)" only reads as farming if the fight
        // actually changes; replaying a cached encounter would be a treadmill with a fixed answer.
        const first = rollEncounter({ run, node: node({ visited: 1 }), party });
        const second = rollEncounter({ run, node: node({ visited: 2 }), party });

        expect(second.seed).not.toBe(first.seed);
        expect(second.enemyParty.map(identityOf)).not.toEqual(first.enemyParty.map(identityOf));
    });

    it('rolls different fights for two nodes entered for the first time', () => {
        const here = rollEncounter({ run, node: node({ id: 'b0l2n0' }), party });
        const there = rollEncounter({ run, node: node({ id: 'b0l2n1' }), party });

        expect(there.enemyParty.map(identityOf)).not.toEqual(here.enemyParty.map(identityOf));
    });
});

// ---------------------------------------------------------------------------------------------
// Ticket 11 — party size
// ---------------------------------------------------------------------------------------------

describe('enemy party size', () => {
    const run = makeRun(['Fire', 'Water', 'Nature']);
    const sizeAt = (kind: NodeKind, party: ReadonlyArray<IMingmingState>): number =>
        rollEncounter({ run, node: node({ kind }), party }).enemyParty.length;

    it('mirrors the player party for ordinary fights', () => {
        // Not `1..n`. That was the pre-run generator's roll, and it meant a third of a three-member
        // team's fights were against a single enemy.
        expect(sizeAt('wild', [KRAKEN])).toBe(1);
        expect(sizeAt('wild', [KRAKEN, FENRIR])).toBe(2);
        expect(sizeAt('wild', [KRAKEN, FENRIR, RATATOSKR])).toBe(3);
        expect(sizeAt('elite', [KRAKEN, FENRIR])).toBe(2);
        expect(sizeAt('gym', [KRAKEN, FENRIR])).toBe(2);
    });

    it('gives an ambush one more body than you, capped at three (ticket 07: "their 3 vs your 2")', () => {
        expect(sizeAt('ambush', [KRAKEN])).toBe(2);
        expect(sizeAt('ambush', [KRAKEN, FENRIR])).toBe(3);
        expect(sizeAt('ambush', [KRAKEN, FENRIR, RATATOSKR])).toBe(3);
    });

    it('gives an alpha exactly one, whatever you bring', () => {
        expect(sizeAt('alpha', [KRAKEN])).toBe(1);
        expect(sizeAt('alpha', [KRAKEN, FENRIR, RATATOSKR])).toBe(1);
    });

    it('never fields an empty enemy side', () => {
        // A battle with no enemies renders a ghost arena and `createBattleState` throws on one.
        expect(enemyPartySize('wild', 0)).toBe(1);
    });
});

describe('isFightNode', () => {
    it('names the five kinds that start a battle, and only those', () => {
        expect([...FIGHT_KINDS].sort()).toEqual(['alpha', 'ambush', 'elite', 'gym', 'wild']);
        for (const kind of ['marketplace', 'workshop', 'event'] as NodeKind[]) {
            expect(isFightNode(kind)).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------------------------
// Species come from the biome
// ---------------------------------------------------------------------------------------------

describe('species come from the biome element', () => {
    const run = makeRun(['Fire', 'Water', 'Nature']);
    const party = [KRAKEN, FENRIR, RATATOSKR];

    it('draws only from the element of the biome the node sits in', () => {
        for (const [biomeIndex, element] of ['Fire', 'Water', 'Nature'].entries()) {
            const { enemyParty } = rollEncounter({ run, node: node({ biomeIndex }), party });
            expect(enemyParty).toHaveLength(3);
            for (const enemy of enemyParty) {
                expect(GetMingmingData(enemy.definitionId).primaryElement).toBe(element);
            }
        }
    });

    it('handles a two-element biome by unioning both pools', () => {
        // Mono at Early Access (ticket 05) but `IBiome.elements` admits a pair, and a biome whose
        // second element was silently ignored would be a lie the map tells.
        const paired = makeRun(['Fire', 'Water', 'Nature']);
        const pairRun: IRunState = {
            ...paired,
            biomes: [{ id: 'pair', name: 'Pair', elements: ['Fire', 'Water'] }, ...paired.biomes.slice(1)],
        };

        const elements = new Set<string>();
        for (let visit = 1; visit <= 12; visit += 1) {
            const { enemyParty } = rollEncounter({ run: pairRun, node: node({ visited: visit }), party });
            for (const enemy of enemyParty) elements.add(GetMingmingData(enemy.definitionId).primaryElement);
        }

        expect([...elements].sort()).toEqual(['Fire', 'Water']);
    });

    it('falls back to the whole playable roster and warns when a biome has no species', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const empty = makeRun(['Void', 'Water', 'Nature']);
            const { enemyParty } = rollEncounter({ run: empty, node: node(), party: [KRAKEN] });

            expect(enemyParty).toHaveLength(1);
            expect(warn).toHaveBeenCalled();
            expect(warn.mock.calls.flat().join(' ')).toContain('Void');
        } finally {
            warn.mockRestore();
        }
    });
});

// ---------------------------------------------------------------------------------------------
// Ticket 08 — the kit fraction
// ---------------------------------------------------------------------------------------------

describe('ticket 08: the enemy deck is the player’s kit fraction at that depth', () => {
    const run = makeRun(['Fire', 'Water', 'Nature']);
    const party = [KRAKEN, FENRIR];

    /** The tuned list the enemy side would hold if the deepest rule applied. */
    const tunedDeckFor = (enemies: ReadonlyArray<IBattleEntity>): string[] =>
        enemies.flatMap((enemy) => getDeckForOS(enemy.definitionId, enemy.activeOS));

    it('every rung fields the FULL tuned deck — depth stopped being the axis (ticket 60)', () => {
        /*
         * The claim ticket 60 replaced ticket 08's table with, and it is a strong one: **the enemy
         * in front of you is holding the list the balance corpus is calibrated on, in every fight of
         * the run.** Not "about the right size" — the actual list, card for card and in order, at
         * all three depths and at both non-wild kinds.
         *
         * The old table indexed on biome and the run gate measured what that produced: biome 1
         * wilds at 26.7% against biome 2's 50.0%, because the middle row's "startKit alone" is a
         * SHARPER list than the tuned one, not a weaker one. A difficulty curve whose middle was
         * its hardest point was tuning the wrong axis, so the axis is gone.
         *
         * What separates the rungs now is firmware and lookahead, asserted below.
         */
        for (const biomeIndex of [0, 1, 2]) {
            const wild = rollEncounter({ run, node: node({ biomeIndex }), party });
            expect(wild.enemyDeckIds).toEqual(tunedDeckFor(wild.enemyParty));
        }
        const elite = rollEncounter({ run, node: node({ kind: 'elite', biomeIndex: 0 }), party });
        expect(elite.enemyDeckIds).toEqual(tunedDeckFor(elite.enemyParty));
    });

    it('a wild runs NO firmware and plays greedy, at every depth', () => {
        /*
         * The bottom rung, and the reason a wild is beatable while holding a gym leader's deck: it
         * cannot cash the engine. Under ticket 61's five-card table that contrast is sharper than it
         * used to be — the tuned list LEADS with the species' payoff, so the wild is holding the
         * good card and running none of the hooks that make it good.
         *
         * `activeOS` is `undefined` on the ENTITY rather than absent from the state, which is the
         * distinction `IEnemyLoadout.os` documents: `initializeBattleEntity` resolves a missing
         * `activeOS` to the definition's first firmware, so "no OS" has to be applied after the
         * factory has had its say or it silently becomes "the default OS".
         */
        for (const biomeIndex of [0, 1, 2]) {
            const { enemyParty, enemyAiTier } = rollEncounter({ run, node: node({ biomeIndex }), party });
            expect(enemyAiTier).toBe('greedy');
            for (const enemy of enemyParty) expect(enemy.activeOS).toBeUndefined();
        }
    });

    it('an elite is the biome’s exam at any depth: firmware ON, and a lite lookahead', () => {
        // The elite rung used to need a special case (*"elites use the deepest rule regardless of
        // depth"*) because the table indexed on biome. It falls out of the shape now — the grade is
        // the node's KIND — and the assertion is that a biome-0 elite is the same fight a biome-2
        // one is, which is what makes it legible as a checkpoint rather than as one more body.
        for (const biomeIndex of [0, 1, 2]) {
            const { enemyParty, enemyAiTier } = rollEncounter({
                run, node: node({ kind: 'elite', biomeIndex }), party,
            });
            expect(enemyAiTier).toBe('lite');
            for (const enemy of enemyParty) {
                expect(enemy.activeOS).toBeDefined();
                expect(GetMingmingData(enemy.definitionId).availableOS).toContain(enemy.activeOS);
            }
        }
    });

    it('the grade is by KIND, and ambush and alpha are wilds', () => {
        // Ticket 07 makes those two special by varying the enemy COUNT, which is `enemyPartySize`'s
        // job. Giving them a rung of their own as well would be two knobs for one idea, and the
        // ladder is deliberately three rungs wide.
        expect(gradeFor('wild')).toBe('wild');
        expect(gradeFor('ambush')).toBe('wild');
        expect(gradeFor('alpha')).toBe('wild');
        expect(gradeFor('elite')).toBe('elite');
        expect(gradeFor('gym')).toBe('gauntlet');
    });

    it('THE TIER RAISES THE WILD RUNG AND NOTHING ELSE — ticket 60', () => {
        /*
         * *"tier 2 = wild OS on; tier 3 = wild AI lite"*, against `exploration-map.md`'s standing
         * law that harder tiers bring *"meaner curated teams, more elites, enemy relics; never
         * bigger numbers."*
         *
         * The half worth pinning is what does NOT move. An elite already runs its firmware and a
         * gauntlet already thinks a turn ahead, so a tier that touched them would have nothing left
         * to give but a number — which is the one thing the law forbids. A tier makes the ORDINARY
         * fight play like the exam did one tier ago, and stops there.
         */
        expect(enemyLoadoutFor('wild', 1)).toMatchObject({ os: false, ai: 'greedy' });
        expect(enemyLoadoutFor('wild', 2)).toMatchObject({ os: true, ai: 'greedy' });
        expect(enemyLoadoutFor('wild', 3)).toMatchObject({ os: true, ai: 'lite' });
        // Clamped, not extrapolated: there is no fourth grade, and inventing one at tier 4 would be
        // a scaling knob wearing a ladder's clothes.
        expect(enemyLoadoutFor('wild', 9)).toEqual(enemyLoadoutFor('wild', 3));

        for (const tier of [1, 2, 3, 9]) {
            expect(enemyLoadoutFor('elite', tier)).toEqual(ENEMY_LADDER.elite);
            expect(enemyLoadoutFor('gym', tier)).toEqual(ENEMY_LADDER.gauntlet);
        }
    });

    it('a wild rolls BELOW the player and an elite rolls level with them — ticket 67’s IV flip', () => {
        /*
         * The finding the run gate surfaced, and the flip Henry ruled on it. Before this, every
         * enemy in the game rolled `nextInt(10, 31)` — mean 20.5 — against the player's
         * `nextInt(0, 31)` — mean 15.5. Five points of every stat, in the enemy's favour, upstream
         * of every band and every biome.
         *
         * Now: a wild rolls 0-20 (mean 10, *below* the player, a bounded edge and no more god-roll
         * wilds wiping an early run) and an elite rolls the player's own 0-31 uncapped (*"elite
         * variance is the elite's spice"*).
         *
         * Sampled across many nodes rather than asserted on one, because a band is a claim about a
         * distribution: a single roll of 14 is inside both bands and proves nothing. The ceiling is
         * the assertion that bites — a wild that ever rolls 21 is a wild on the wrong band.
         */
        const ivsOf = (kind: 'wild' | 'elite'): number[] => {
            const out: number[] = [];
            for (let i = 0; i < 40; i += 1) {
                const rolled = rollEncounter({
                    run: { ...run, seed: `iv-band-${i}` },
                    node: node({ kind, biomeIndex: i % 3, id: `n${i}` }),
                    party,
                });
                for (const enemy of rolled.enemyParty) {
                    out.push(enemy.attackIV, enemy.defenseIV, enemy.hpIV);
                }
            }
            return out;
        };

        const wild = ivsOf('wild');
        expect(Math.max(...wild)).toBeLessThanOrEqual(20);
        expect(Math.min(...wild)).toBeGreaterThanOrEqual(0);
        // The band is actually exercised rather than merely respected: a hard-coded 10 everywhere
        // would satisfy the two bounds above.
        expect(Math.max(...wild)).toBeGreaterThan(15);

        const elite = ivsOf('elite');
        expect(Math.max(...elite)).toBeGreaterThan(20);
        expect(Math.max(...elite)).toBeLessThanOrEqual(31);
    });

    it('holds real cards, not ids nothing can resolve', () => {
        for (const biomeIndex of [0, 1, 2]) {
            const { enemyDeckIds } = rollEncounter({ run, node: node({ biomeIndex }), party });
            expect(enemyDeckIds.length).toBeGreaterThan(0);
            for (const id of enemyDeckIds) expect(GetProgramData(id).id).not.toBe('missing');
        }
    });
});

// ---------------------------------------------------------------------------------------------
// Ticket 21 — the freeze
// ---------------------------------------------------------------------------------------------

describe('ticket 21: depth changes the deck and the firmware, never a number', () => {
    it('builds the identical FIGHT at biome 0 and biome 2 — depth is no longer an axis at all', () => {
        /*
         * Ticket 21's law used to be "same individuals, different deck and firmware". Ticket 60's
         * ladder makes it stronger: depth changes NOTHING about a wild. Same species, same IVs, same
         * tuned deck, same absent firmware, same greedy AI — biome 2 is not a harder place, it is a
         * place you arrive at with a bigger deck and two more party members.
         *
         * The old table is what made the weaker version necessary, and the run gate is what
         * condemned it: it indexed difficulty on biome and produced a curve whose MIDDLE was its
         * hardest point (26.7% at biome 1, against 67.1% at biome 0 and 50.0% at biome 2).
         */
        const run = makeRun(['Fire', 'Fire', 'Fire']);
        const party = [KRAKEN, FENRIR];

        const shallow = rollEncounter({ run, node: node({ biomeIndex: 0 }), party });
        const deep = rollEncounter({ run, node: node({ biomeIndex: 2 }), party });

        expect(deep.enemyParty.map(identityOf)).toEqual(shallow.enemyParty.map(identityOf));
        expect(deep.enemyDeckIds).toEqual(shallow.enemyDeckIds);
        expect(deep.enemyAiTier).toBe(shallow.enemyAiTier);
        expect(shallow.enemyParty.every((e) => e.activeOS === undefined)).toBe(true);
        expect(deep.enemyParty.every((e) => e.activeOS === undefined)).toBe(true);
    });

    it('rolls a wild’s IVs from the same band at every depth, and that band is 0-20', () => {
        // The band moved (ticket 67's flip) but the LAW did not: it is the same band everywhere, so
        // a biome-2 enemy is never rolled hotter than a biome-0 one. Both halves are asserted,
        // because a change that raised the ceiling with depth would still pass a bounds check
        // written against the deepest biome alone.
        const run = makeRun(['Fire', 'Fire', 'Fire']);
        const seenPerBiome: number[][] = [[], [], []];
        for (let biomeIndex = 0; biomeIndex <= 2; biomeIndex += 1) {
            for (let visit = 1; visit <= 8; visit += 1) {
                const { enemyParty } = rollEncounter({
                    run,
                    node: node({ biomeIndex, visited: visit }),
                    party: [KRAKEN, FENRIR, RATATOSKR],
                });
                for (const enemy of enemyParty) {
                    for (const iv of [enemy.hpIV, enemy.attackIV, enemy.defenseIV]) {
                        expect(iv).toBeGreaterThanOrEqual(0);
                        expect(iv).toBeLessThanOrEqual(20);
                        seenPerBiome[biomeIndex].push(iv);
                    }
                }
            }
        }
        // Every depth reached the same ceiling, which is the "no scaling" claim stated as a number
        // rather than as an absence.
        const ceilings = seenPerBiome.map((ivs) => Math.max(...ivs));
        expect(new Set(ceilings).size).toBe(1);
    });
});

// ---------------------------------------------------------------------------------------------
// exploration-map.md — FULL HEAL between regular nodes
// ---------------------------------------------------------------------------------------------

describe('full heal between nodes', () => {
    /**
     * `exploration-map.md` rules a full heal between regular nodes, and ticket 07 cites it as the
     * reason **there are no rest nodes**. This is already true by construction rather than by a
     * heal step, and the construction is worth naming because it is easy to break by accident:
     *
     * - `IRunState` has **nowhere to put HP** outside `gauntlet.persistedHp`. There is no
     *   `partyHp`, no per-member `currentHp` on `IRanchMember` — a member is a definition plus a
     *   stat roll, and its HP only exists for the length of a battle.
     * - `initializeBattleEntity` sets `currentHp = maxHp` and `statusEffects = []` every time.
     * - `buildBattleSetup` passes `persistedHp: {}` whenever `run.gauntlet` is null, which is every
     *   node outside the gym.
     *
     * So the assertion is on the behaviour, not on a code path: fight, take damage, fight again,
     * and arrive whole. Anything that added HP carry-over between nodes would have to add a field
     * to `IRunState` first, and this test is what would catch it if it did.
     */
    const ranchMember = (m: IMingmingState): IRanchMember => ({
        id: m.id,
        definitionId: m.definitionId,
        activeOS: m.activeOS!,
        attackIV: m.attackIV!,
        defenseIV: m.defenseIV!,
        hpIV: m.hpIV!,
    });

    const ranch: IRanchState = {
        roster: [ranchMember(KRAKEN), ranchMember(FENRIR)],
        blueprints: {},
        codex: { seen: [], played: [] , species: [], assembled: [], os: [] },
        gymsCleared: [],
        highestTierCleared: 0,
        seenTips: [],
        codexMilestones: [],
    };

    it('starts every node’s battle at full HP with no statuses, however the last one went', () => {
        const run = makeRun(['Fire', 'Water', 'Nature']);
        const party = run.partyIds
            .map((id) => ranch.roster.find((m) => m.id === id))
            .filter((m): m is IRanchMember => m !== undefined)
            .map(toMingmingState);

        const first = node({ id: 'b0l1n0', visited: 1 });
        const encounter = rollEncounter({ run, node: first, party });
        const battle = createBattleState(buildBattleSetup(ranch, run, encounter), [], undefined, {
            seed: encounter.seed,
        });

        for (const entity of battle.playerParty) {
            expect(entity.currentHp).toBe(entity.maxHp);
            expect(entity.statusEffects).toEqual([]);
            expect(entity.tempHp).toBe(0);
        }

        // There is no HP to carry: outside the gauntlet the run has no field for it.
        expect(run.gauntlet).toBeNull();
        expect(buildBattleSetup(ranch, run).persistedHp).toEqual({});

        // A second node, after a battle in which the party was hurt, opens exactly the same way.
        const second = node({ id: 'b0l2n0', visited: 1 });
        const nextEncounter = rollEncounter({ run, node: second, party });
        const nextBattle = createBattleState(buildBattleSetup(ranch, run, nextEncounter), [], undefined, {
            seed: nextEncounter.seed,
        });
        for (const entity of nextBattle.playerParty) {
            expect(entity.currentHp).toBe(entity.maxHp);
            expect(entity.statusEffects).toEqual([]);
        }
    });

    it('hands the rolled encounter straight to the battle, firmware and all', () => {
        // The strip `createBattleState` applies to procedurally generated enemies ("disable OS on
        // enemies as they use intents") must not reach a run encounter, or the ladder's elite and
        // gauntlet rungs would silently collapse into the wild one.
        //
        // Asked of an ELITE since ticket 60. It used to ask a biome-2 wild, which had firmware
        // under the depth table and has none under the ladder — so the test would now be asserting
        // the strip against an enemy that is supposed to be stripped, and would pass for the wrong
        // reason forever.
        const run = makeRun(['Fire', 'Water', 'Nature']);
        const party = [toMingmingState(ranchMember(KRAKEN))];
        const deep = node({ id: 'b2l2n0', kind: 'elite', biomeIndex: 2, visited: 1 });
        const encounter = rollEncounter({ run, node: deep, party });

        const battle = createBattleState(buildBattleSetup(ranch, run, encounter), [], undefined, {
            seed: encounter.seed,
            enemyMode: 'CARDS',
        });

        expect(battle.enemyParty.map((e) => e.id)).toEqual(encounter.enemyParty.map((e) => e.id));
        expect(battle.enemyParty.every((e) => e.activeOS !== undefined)).toBe(true);
    });
});


// ---------------------------------------------------------------------------------------------
// Ticket 24 — the first fight of a first run
// ---------------------------------------------------------------------------------------------

describe('ticket 24: every run\u2019s OPENING fight is a floor (Slay the Spire\u2019s model)', () => {
    // `KRAKEN` is already an `IMingmingState` — the party a run is created with, not a ranch row.
    const party = [KRAKEN];

    /** A genuinely fresh run — `fightsResolved: 0`, unlike the file's shared `makeRun`. */
    const onboardingRun = (elements: ReadonlyArray<string>, seed = 'onboarding-seed'): IRunState =>
        ({ ...makeRun(elements, seed), fightsResolved: 0 });

    it('carries no modifier at all — the gate is the fight count, not a flag', () => {
        // Henry retired ticket 24's `onboarding` modifier on 2026-08-23. It keyed the easy fight off
        // `seenTips`, which meant pressing "Skip tips" silently made your first fight harder.
        const fresh = createRun({
            seed: 'no-modifier',
            offer: { gym: GYM_REGISTRY.gym_emberfall, biomes: [biome('Fire', 0), biome('Water', 1), biome('Nature', 2)] },
            party: [KRAKEN],
            startedAt: 0,
        });
        expect(fresh.modifiers).toEqual([]);
        expect(fresh.fightsResolved).toBe(0);
        expect(isOpeningFight(fresh)).toBe(true);
    });

    it('is the first fight of EVERY run, and nothing after it', () => {
        const run = onboardingRun(['Fire', 'Water', 'Nature']);
        expect(isOpeningFight(run)).toBe(true);
        expect(isOpeningFight({ ...run, fightsResolved: 1 })).toBe(false);
        // A second run gets its own opening fight — that is the Slay the Spire model, not a
        // once-per-save tutorial affordance. (`makeRun` is deliberately mid-run, so this asks the
        // question of a fresh one.)
        expect(isOpeningFight(onboardingRun(['Fire', 'Water', 'Nature'], 'a-later-run'))).toBe(true);
    });

    it('pins an elite first fight to one body holding the biome-0 eight', () => {
        // The reason this exists: `generateRegionGraph` can put an elite in biome 0 layer 1, and
        // `kitFractionFor` gives an elite the FULL tuned deck at any depth. A first-ever player
        // holding 8 cards — a solo party: one kit plus the starter's three generics — would meet a
        // complete per-OS list.
        const run = onboardingRun(['Fire', 'Water', 'Nature']);
        const elite = node({ id: 'b0l1n0', kind: 'elite', layer: 1, visited: 1 });

        const softened = rollEncounter({ run, node: elite, party });
        expect(softened.enemyParty).toHaveLength(1);
        expect(softened.enemyDeckIds).toHaveLength(START_KIT_SIZE + STARTER_GENERICS);
        expect(softened.enemyParty[0].activeOS).toBeUndefined();

        // The same node in the same run, one fight later, is the real elite again.
        const real = rollEncounter({ run: { ...run, fightsResolved: 1 }, node: elite, party });
        expect(real.enemyDeckIds.length).toBeGreaterThan(START_KIT_SIZE + STARTER_GENERICS);
        expect(real.enemyParty[0].activeOS).toBeDefined();
    });

    it('pins an ambush first fight to one enemy rather than two', () => {
        const run = onboardingRun(['Fire', 'Water', 'Nature']);
        const ambush = node({ id: 'b0l1n1', kind: 'ambush', layer: 1, visited: 1 });
        expect(rollEncounter({ run, node: ambush, party }).enemyParty).toHaveLength(1);
        expect(
            rollEncounter({ run: { ...run, fightsResolved: 1 }, node: ambush, party }).enemyParty,
        ).toHaveLength(2);
    });

    it('hands the opening enemy the player’s own opening composition, block by block', () => {
        /*
         * This assertion used to belong to biome 0 — ticket 08's gentlest row said *"the same six
         * cards the player is holding"* and every biome-0 wild obeyed it. The ladder deleted that
         * row, and the claim moved WITH the loadout rather than being deleted with the table: the
         * scripted opening fight is the one place in the game that still fields it, and ticket 24's
         * ruling is where the sentence came from in the first place.
         *
         * The symmetry is the whole claim of this loadout, so the check is block by block rather
         * than by total: *"the same cards you opened with"* is only true if the FILLER rule is the
         * same one, and an enemy side handing every body three generics would be quietly holding a
         * bigger deck than the player it is meant to mirror. The opening fight is pinned to one
         * body, so that reduces here to the starter's single helping — but the arithmetic is written
         * out anyway, because `enemyPartySize`'s pin is a separate ruling that could move.
         *
         * The firmware the kit was chosen FROM is not readable off the entity (that is the point of
         * `os: false`), so the check is that the five ARE one of the species' tagged kits.
         */
        const blockWidth = (index: number) => START_KIT_SIZE + (index === 0 ? STARTER_GENERICS : 0);

        const run = onboardingRun(['Fire', 'Water', 'Nature']);
        const { enemyParty, enemyDeckIds } = rollEncounter({
            run, node: node({ id: 'b0l1n2', kind: 'wild', layer: 1, visited: 1 }), party,
        });

        let offset = 0;
        enemyParty.forEach((enemy, index) => {
            const block = enemyDeckIds.slice(offset, offset + blockWidth(index));
            offset += blockWidth(index);

            expect(block.slice(START_KIT_SIZE)).toEqual(
                Array.from({ length: index === 0 ? STARTER_GENERICS : 0 }, () => GENERIC_HIT),
            );

            const kits = GetMingmingData(enemy.definitionId).availableOS.map((os) =>
                startKitIdsFor({ ...KRAKEN, definitionId: enemy.definitionId, activeOS: os }, START_KIT_SIZE),
            );
            expect(kits.map((kit) => kit.join(','))).toContain(block.slice(0, START_KIT_SIZE).join(','));
            expect(enemy.activeOS).toBeUndefined();
        });
        expect(offset).toBe(enemyDeckIds.length);
    });

    it('softens the DECK of an ordinary biome-0 wild without touching who you fight', () => {
        /*
         * This assertion INVERTED with ticket 60's ladder, and the inversion is the point.
         *
         * It used to read *"leaves an ordinary biome-0 wild exactly as it was"* — byte-identical,
         * deck included — and that was true because `KIT_FRACTION_BY_BIOME[0]` and the opening
         * fight's floor happened to be the same row. So the floor only ever bit on an elite or an
         * ambush that the generator dropped into layer 1.
         *
         * The table is gone: an ordinary biome-0 wild now holds the full tuned deck like every other
         * wild, so the floor bites on EVERY first fight. That is a real difficulty change and it is
         * the one ticket 24 asked for — *"the enemy deck is pinned to the same six cards the player
         * is holding"* — applied at last to the fight it was written about.
         *
         * What must NOT change is who you meet: the floor is a floor on the loadout, not a second
         * roll. Same species, same IVs, same seed.
         */
        const plain = node({ id: 'b0l1n2', kind: 'wild', layer: 1, visited: 1 });
        const softened = rollEncounter({ run: onboardingRun(['Fire', 'Water', 'Nature']), node: plain, party });
        const ordinary = rollEncounter({ run: makeRun(['Fire', 'Water', 'Nature'], 'onboarding-seed'), node: plain, party });

        expect(softened.enemyParty.map(identityOf)).toEqual(ordinary.enemyParty.map(identityOf));
        expect(softened.seed).toBe(ordinary.seed);

        // ...and the deck IS softened, strictly: the player's opening composition against the tuned
        // list. `toBeLessThan` rather than an exact count, because the two are different SHAPES and
        // pinning the tuned list's length here would make this test a hostage to a deck edit.
        expect(softened.enemyDeckIds).toHaveLength(START_KIT_SIZE + STARTER_GENERICS);
        expect(softened.enemyDeckIds.length).toBeLessThan(ordinary.enemyDeckIds.length);
        expect(softened.enemyAiTier).toBe('greedy');
    });

    it('never touches the species pool, so the map keeps its promise', () => {
        // Epic8's "Initiation" wanted the opponent's element picked to counter the player. The
        // biome's element is what the map promised two screens earlier, so it is left alone — see
        // `isOnboardingFight`'s header.
        const run = onboardingRun(['Fire', 'Fire', 'Fire']);
        const encounter = rollEncounter({ run, node: node({ id: 'b0l1n0', layer: 1, visited: 1 }), party });
        for (const enemy of encounter.enemyParty) {
            expect(GetMingmingData(enemy.definitionId).primaryElement).toBe('Fire');
        }
    });
});
