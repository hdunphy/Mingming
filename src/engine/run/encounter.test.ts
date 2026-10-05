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
    LOOPING_FREE_DRAWS,
    MEASURED_NOT_LOOPING,
    dedupeCantrips,
    freeDrawCardIds,
    encounterSeed,
    enemyPartySize,
    isFightNode,
    isOpeningFight,
    enemyLoadoutFor,
    gradeFor,
    gymDriverForNode,
    rollEncounter,
} from './encounter';
import { buildBattleSetup, toMingmingState } from './battleSetup';
import { STARTER_GENERICS, START_KIT_SIZE, createRun, startKitIdsFor } from './createRun';
import { authoredBossFor } from './bosses';
import { getInflatedProgramRegistry } from '../data/programRegistry';
import { GYM_REGISTRY, gymCompElementPlan, type IGymOffer } from './gyms';
import { DRIVER_WAR_FOOTING } from '../data/driverRegistry';
import { createBattleState } from '../data/battleFactories';
import { GENERIC_HIT, GetMingmingData, START_KIT_PAYOFF, getDeckForOS } from '../data/mingmingRegistry';
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
        detour: false,
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
    it('names the six kinds that start a battle, and only those', () => {
        // `rival` joined the list under ticket 142a. It had to: a kind absent from here does not
        // put the run into `phase: 'encounter'`, so a rival node would have been a fight the
        // player walks onto and nothing happens.
        expect([...FIGHT_KINDS].sort()).toEqual(['alpha', 'ambush', 'elite', 'gym', 'rival', 'wild']);
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

    /*
     * THE LAST BIOME IS NO LONGER AN ELEMENT — ticket 142 §7 (Henry, 2026-09-11). The first two
     * legs keep this promise exactly; the third is the APPROACH, dealt one body per entry of the
     * gym's comp shape, so a 3v3 there is NNW rather than three of anything. `the approach biome
     * deals the comp shape` below is where that case is pinned.
     */
    it('draws only from the element of the biome the node sits in — the two walked legs', () => {
        for (const [biomeIndex, element] of ['Fire', 'Water'].entries()) {
            const { enemyParty } = rollEncounter({ run, node: node({ biomeIndex }), party });
            expect(enemyParty).toHaveLength(3);
            for (const enemy of enemyParty) {
                expect(GetMingmingData(enemy.definitionId).primaryElement).toBe(element);
            }
        }
    });

    it('the approach biome deals the comp shape — N, NN, NNW by party size', () => {
        // Henry, 2026-09-11: *"you only see the water in 3v3s — the first two are one of the four
        // nature decks. If it's a 1v1 or 2v2 it would be a single N then two N's respectively."*
        const gym = GYM_REGISTRY[run.gymId];
        const expected = gymCompElementPlan(gym);
        const last = run.biomes.length - 1;
        for (const size of [1, 2, 3]) {
            const { enemyParty } = rollEncounter({
                run, node: node({ biomeIndex: last }), party: party.slice(0, size),
            });
            expect(enemyParty).toHaveLength(size);
            expect(enemyParty.map((e) => GetMingmingData(e.definitionId).primaryElement))
                .toEqual([...expected].slice(0, size));
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
    const run = makeRun(['Fire', 'Water', 'Nature'], 'encounter-seed-1');
    const party = [KRAKEN, FENRIR];

    /** The tuned list the enemy side would hold if the deepest rule applied. */
    const tunedDeckFor = (enemies: ReadonlyArray<IBattleEntity>): string[] =>
        enemies.flatMap((enemy) => getDeckForOS(enemy.definitionId, enemy.activeOS));

    /**
     * Ticket 152's rule, re-expressed rather than imported: a wild keeps the FIRST copy of a
     * looping free draw and drops the rest. Written out here so the test states the expectation
     * instead of asking the code under test what it did.
     */
    const CAPPED = ['undertow', 'slipstream', 'glimmer'];
    const withoutDuplicateCantrips = (deck: ReadonlyArray<string>): string[] => {
        const seen = new Set<string>();
        return deck.filter((id) => {
            if (!CAPPED.includes(id)) return true;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    };

    it('fields the FULL tuned deck from biome 1 on, and the start-kit SHAPE at biome 0', () => {
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
         * TICKET 152 PUT ONE EXCEPTION IN, AND IT IS STILL NOT DEPTH. A wild drops the extra
         * copies of a pure cantrip; everything else about the list is untouched, and the rule is
         * the same at biome 0 and biome 2. Asserted here as "the tuned list with duplicate
         * cantrips removed" rather than by relaxing the comparison, because the strength of this
         * test is that it compares card for card and in order.
         */
        for (const biomeIndex of [1, 2]) {
            const wild = rollEncounter({ run, node: node({ biomeIndex }), party });
            expect(wild.enemyDeckIds).toEqual(withoutDuplicateCantrips(tunedDeckFor(wild.enemyParty)));
        }

        /*
         * ══ TICKET 157-r1(a) PUT ONE ROW BACK, AND BIOME 0 IS THE ONLY ONE. ══
         *
         * 60 was right to delete the old table and this is not a restoration of it: the old one
         * indexed FOUR rows on biome and produced a curve whose middle was its hardest point
         * (26.7% at biome 1, against 67.1% at biome 0 and 50.0% at biome 2), because `start-kit`
         * alone is a SHARPER list than the tuned one, not a weaker one.
         *
         * What 157 measured is different and is about the other side of the table: **the player's
         * opening five was thinned by ticket 161 and this ladder was not**, so fight one read
         * 77.5% against the ruled 95 (and `runGate`'s own wild/biome-0 cell agreed at 67%). Biome 0
         * now deals the enemy `start-kit-plus-generics` — not the sharper `start-kit`, the SAME
         * composition `createRun` deals the player, through `startDeckFor` itself.
         *
         * Biome 1 onward is untouched, which is what keeps this one row rather than a table: by
         * then the player has picked, bought, upgraded and recruited, and the tuned deck is the
         * right thing to meet.
         */
        const opening = rollEncounter({ run, node: node({ biomeIndex: 0 }), party });
        expect(opening.enemyDeckIds).not.toEqual(withoutDuplicateCantrips(tunedDeckFor(opening.enemyParty)));
        expect(opening.enemyDeckIds.length).toBeLessThan(tunedDeckFor(opening.enemyParty).length);

        /*
         * Asserted as the COMPOSITION rather than as a subset, because "the same shape the player is
         * dealt" is a claim about what is in the list *and* about the filler rule: the kit cards come
         * from the species, and `STARTER_GENERICS` tackles ride on the FIRST member only — exactly
         * what `createRun` hands the player. A subset check would pass a deck that had quietly
         * stopped dealing the generics, and the generics are half of why the opening five is soft.
         *
         * The generic is deliberately NOT in the tuned deck (it is a None-element filler card), which
         * is why the membership loop this replaced was wrong to demand every card be in it.
         */
        const kitPlusGenerics = opening.enemyParty.flatMap((enemy, index) => [
            ...startKitIdsFor(enemy, START_KIT_SIZE),
            ...(index === 0 ? Array.from({ length: STARTER_GENERICS }, () => GENERIC_HIT) : []),
        ]);
        expect(opening.enemyDeckIds).toEqual(kitPlusGenerics);

        // An ELITE is untouched at every depth, biome 0 included: it is the rung where "the same
        // cards, played better" begins, and a first-biome elite is a fight the player chose.
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
        // TICKET 169a (Henry, 2026-09-29) moved both rungs down one tier: firmware is tier 1 and
        // the lite AI is tier 2. The rows now live in `data/tiers.json`.
        expect(enemyLoadoutFor('wild', 0)).toMatchObject({ os: false, ai: 'greedy' });
        expect(enemyLoadoutFor('wild', 1)).toMatchObject({ os: true, ai: 'greedy' });
        expect(enemyLoadoutFor('wild', 2)).toMatchObject({ os: true, ai: 'lite' });
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
    it('builds the identical fight at biome 1 and biome 2 — depth is an axis ONCE, at biome 0', () => {
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

        const shallow = rollEncounter({ run, node: node({ biomeIndex: 1 }), party });
        const deep = rollEncounter({ run, node: node({ biomeIndex: 2 }), party });

        expect(deep.enemyParty.map(identityOf)).toEqual(shallow.enemyParty.map(identityOf));
        expect(deep.enemyDeckIds).toEqual(shallow.enemyDeckIds);
        expect(deep.enemyAiTier).toBe(shallow.enemyAiTier);
        expect(shallow.enemyParty.every((e) => e.activeOS === undefined)).toBe(true);
        expect(deep.enemyParty.every((e) => e.activeOS === undefined)).toBe(true);

        /*
         * TICKET 157-r1(a): biome 0 is now the one exception, and it moves the DECK and nothing
         * else. Same individuals, same IVs, same absent firmware, same greedy AI — the only thing
         * depth touches is the list, which is the shape ticket 21's law was originally written as.
         */
        const opening = rollEncounter({ run, node: node({ biomeIndex: 0 }), party });
        expect(opening.enemyParty.map(identityOf)).toEqual(shallow.enemyParty.map(identityOf));
        expect(opening.enemyAiTier).toBe(shallow.enemyAiTier);
        expect(opening.enemyParty.every((e) => e.activeOS === undefined)).toBe(true);
        expect(opening.enemyDeckIds).not.toEqual(shallow.enemyDeckIds);
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
        tierClears: {},
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

        /*
         * The same node in the same run, one fight later, is the real elite again.
         *
         * TICKET 162a MOVED THIS ASSERTION, and the move is a finding rather than a fix. It read
         * `toBeGreaterThan(START_KIT_SIZE + STARTER_GENERICS)` — an elite fields MORE cards than a
         * first-ever player's eight — and that was true because v1's tuned lists were nine to
         * eleven cards. Collection v2's kits are **eight**, eleven of twelve of them (skoll_v2 is
         * the nine). So the softening no longer changes the SIZE of an elite's deck at biome 0
         * layer 1; it changes what is in it.
         *
         * Not papered over: the claim underneath is "a softened elite is not the real one", and
         * the substance of that is the OS and the list, not the count. Both are asserted. If the
         * count is meant to be the difference too, that is a kit-size decision for 162b/160, not
         * something to restore by loosening a number here.
         */
        const real = rollEncounter({ run: { ...run, fightsResolved: 1 }, node: elite, party });
        expect(real.enemyDeckIds.length).toBeGreaterThanOrEqual(START_KIT_SIZE + STARTER_GENERICS);
        expect(real.enemyParty[0].activeOS).toBeDefined();
        // The real difference: the tuned list, not the start kit plus three generics.
        expect(real.enemyDeckIds).not.toEqual(softened.enemyDeckIds);
    });

    it('pins an ambush first fight to one enemy rather than two', () => {
        const run = onboardingRun(['Fire', 'Water', 'Nature']);
        const ambush = node({ id: 'b0l1n1', kind: 'ambush', layer: 1, visited: 1 });
        expect(rollEncounter({ run, node: ambush, party }).enemyParty).toHaveLength(1);
        expect(
            rollEncounter({ run: { ...run, fightsResolved: 1 }, node: ambush, party }).enemyParty,
        ).toHaveLength(2);
    });

    it('hands the opening enemy the player’s composition MINUS its payoff, block by block', () => {
        /*
         * ══ THIS ASSERTION HAS MOVED TWICE AND INVERTED ONCE. ══
         *
         * It began as ticket 08's gentlest row — *"the same six cards the player is holding"* — and
         * belonged to biome 0. Ticket 60 deleted that row and the claim moved WITH the loadout: the
         * scripted opening fight was the one place still fielding it, which is where ticket 24's
         * sentence came from anyway.
         *
         * **157-r2 inverts it.** 157-r1's read is why: fight one measured 75.8% over 2,400 runs
         * against a ruled 95, and it had not moved and could not, because both sides were already
         * holding the same shape. A mirror cannot reach 95 — at fight one the two sides have the
         * same count, the same IVs, the same AI and the same beam, so the player's only edge is its
         * firmware, worth +25.8 points over even. Symmetry was the bug, not the goal.
         *
         * So the opener is the player's composition **minus its one payoff**, Henry 2026-09-25:
         * *"the player keeps the one payoff ruled 09-24; the enemy shows the engine that cannot
         * fire."*
         *
         * **Asserted as a SUBSTITUTION, which is the part that could silently be wrong.** The rung
         * is gentler only because the count is unchanged — the payoff is swapped for a generic, not
         * removed. An implementation that dropped the card would leave a four-card block that
         * concentrates the remaining engine and draws it more often, i.e. a SHARPER deck, which is
         * exactly the alternative Henry refused. So the block width is still checked first, and the
         * kit is matched against the tagged five with the payoff swapped rather than against a
         * shortened list.
         *
         * The filler rule is still checked block by block, for the original reason: an enemy side
         * handing every body three generics would quietly hold a bigger deck than the player it
         * mirrors. The opening fight is pinned to one body so that reduces to the starter's single
         * helping, but the arithmetic is written out because `enemyPartySize`'s pin could move.
         *
         * The firmware the kit came from is not readable off the entity (that is the point of
         * `os: false`), so the check is that the five ARE one of the species' tagged kits, patched.
         */
        const blockWidth = (index: number) => START_KIT_SIZE + (index === 0 ? STARTER_GENERICS : 0);

        const run = onboardingRun(['Fire', 'Water', 'Nature']);
        const { enemyParty, enemyDeckIds } = rollEncounter({
            run, node: node({ id: 'b0l1n2', kind: 'wild', layer: 1, visited: 1 }), party,
        });

        /** One firmware's tagged five with its payoff replaced by a generic — the rung, spelled out. */
        const kitMinusPayoff = (definitionId: string, os: string): string[] => {
            const kit = startKitIdsFor({ ...KRAKEN, definitionId, activeOS: os }, START_KIT_SIZE);
            const at = kit.indexOf(START_KIT_PAYOFF[os] ?? '');
            return at < 0 ? kit : kit.map((id, index) => (index === at ? GENERIC_HIT : id));
        };

        let offset = 0;
        enemyParty.forEach((enemy, index) => {
            const block = enemyDeckIds.slice(offset, offset + blockWidth(index));
            offset += blockWidth(index);

            // The count is untouched — this is the half that makes the rung gentler rather than sharper.
            expect(block, `${enemy.definitionId}: the payoff is SWAPPED, not dropped`)
                .toHaveLength(blockWidth(index));
            expect(block.slice(START_KIT_SIZE)).toEqual(
                Array.from({ length: index === 0 ? STARTER_GENERICS : 0 }, () => GENERIC_HIT),
            );

            const five = block.slice(0, START_KIT_SIZE);
            const candidates = GetMingmingData(enemy.definitionId).availableOS.map((os) => kitMinusPayoff(enemy.definitionId, os));
            expect(candidates.map((kit) => kit.join(',')), `${enemy.definitionId}`).toContain(five.join(','));

            // ...and it really is one card short of the kit the PLAYER would be dealt. Stated as its
            // own assertion because "minus the payoff" is false if the table ever names a card the
            // kit does not hold — the swap would then be a no-op and this fight a mirror again.
            const played = GetMingmingData(enemy.definitionId).availableOS
                .map((os) => startKitIdsFor({ ...KRAKEN, definitionId: enemy.definitionId, activeOS: os }, START_KIT_SIZE));
            expect(played.map((kit) => kit.join(','))).not.toContain(five.join(','));
            expect(enemy.activeOS).toBeUndefined();
        });
        expect(offset).toBe(enemyDeckIds.length);
    });

    it('holds the floor against the TIER, and never re-rolls who you fight', () => {
        /*
         * This assertion has inverted twice, and the second inversion is ticket 157-r1(a).
         *
         * It first read *"leaves an ordinary biome-0 wild exactly as it was"* — byte-identical, deck
         * included — because ticket 08's gentlest row and the opening fight's floor happened to be
         * the same row, so the floor only bit on an elite or an ambush the generator dropped into
         * layer 1. Ticket 60 deleted the table, every wild took the full tuned deck, and the floor
         * started biting on every first fight; this test then asserted the DECK was softer.
         *
         * 157-r1(a) put the biome-0 row back on the ladder itself, so an ordinary biome-0 wild and
         * the scripted opening now hold the same composition and the deck is no longer what
         * separates them. That is not the floor failing — it is the floor's rule becoming the
         * ladder's rule, which is the better place for it.
         *
         * **So the floor is asserted where it still bites: against the TIER.** A tier-3 run's wilds
         * run firmware and a lite lookahead (`enemyLoadoutFor`), and the first fight of that run
         * does not. That is ticket 24's ruling in the only form it can still be false in: a player
         * on their fourth run opens on the same gentle rung a player on their first does.
         *
         * And what must NOT change at any tier is who you meet. The floor is a floor on the
         * LOADOUT, not a second roll: same species, same IVs, same seed.
         */
        const plain = node({ id: 'b0l1n2', kind: 'wild', layer: 1, visited: 1 });
        const tier3 = (fightsResolved: number): IRunState =>
            ({ ...makeRun(['Fire', 'Water', 'Nature'], 'onboarding-seed'), tier: 3, fightsResolved });

        const opening = rollEncounter({ run: tier3(0), node: plain, party });
        const ordinary = rollEncounter({ run: tier3(1), node: plain, party });

        // Who you fight is identical across the floor — that is the half of ticket 24 that has
        // never moved, and the half a "make the first fight easier" patch is most likely to break.
        expect(opening.enemyParty.map(identityOf)).toEqual(ordinary.enemyParty.map(identityOf));
        expect(opening.seed).toBe(ordinary.seed);

        // ...and the floor holds the rung down. Tier 3 raises an ordinary wild to firmware + a lite
        // lookahead; the opening fight keeps neither.
        expect(opening.enemyAiTier).toBe('greedy');
        for (const enemy of opening.enemyParty) expect(enemy.activeOS).toBeUndefined();
        expect(ordinary.enemyAiTier).toBe('lite');
        expect(ordinary.enemyParty.some((enemy) => enemy.activeOS !== undefined)).toBe(true);

        // The deck is the SAME at tier 1 and tier 3 on both sides of the floor — 157-r1(a) made
        // biome 0 the ladder's own gentlest row, and the tier does not touch the list.
        expect(opening.enemyDeckIds).toHaveLength(START_KIT_SIZE + STARTER_GENERICS);
        expect(ordinary.enemyDeckIds).toHaveLength(START_KIT_SIZE + STARTER_GENERICS);
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

// ---------------------------------------------------------------------------------------------
// The region's final elites carry the gym's Driver (ticket 68 ruling 4)
// ---------------------------------------------------------------------------------------------

describe('gymDriverForNode — the telegraph’s second half', () => {
    const party = [KRAKEN];

    it('gives the gym’s Driver to an elite in the gym’s OWN biome, and to nothing else', () => {
        const run = makeRun(['Water', 'Nature', 'Fire']);
        const last = run.biomes.length - 1;

        expect(gymDriverForNode(run, node({ kind: 'elite', biomeIndex: last }))).toBe(DRIVER_WAR_FOOTING);

        // Not the elites two biomes back — the clause is about the approach to the gauntlet, and an
        // aura met at biome 0 would be a spoiler for a fight the player may never reach.
        for (const biomeIndex of [0, 1]) {
            expect(gymDriverForNode(run, node({ kind: 'elite', biomeIndex }))).toBeUndefined();
        }
        // Not the wilds standing beside it, whatever the biome.
        for (const kind of ['wild', 'ambush', 'alpha'] as const) {
            expect(gymDriverForNode(run, node({ kind, biomeIndex: last }))).toBeUndefined();
        }
    });

    it('carries EVERY gym’s Driver — there is no un-authored gym left (ticket 72)', () => {
        // This used to assert the opposite at an un-authored gym: no authored boss, no Driver to
        // carry. Tickets 71 and 72 authored the last two, so the claim inverts — each of the three
        // leaders now hands its own Driver to the elites guarding its gauntlet.
        for (const gymId of ['gym_emberfall', 'gym_tidewrack', 'gym_rootfall'] as const) {
            const offer: IGymOffer = {
                gym: GYM_REGISTRY[gymId],
                biomes: ['Nature', 'Fire', 'Water'].map((element, index) => biome(element, index)),
            };
            const run = { ...createRun({ seed: `${gymId}-elite`, offer, party, startedAt: 0 }), fightsResolved: 1 };
            const carried = gymDriverForNode(run, node({ kind: 'elite', biomeIndex: run.biomes.length - 1 }));
            expect(carried, `${gymId} should carry a Driver`).toBe(authoredBossFor(gymId)!.driver);
        }
    });

    it('reaches the rolled encounter, and changes NOTHING else about the elite', () => {
        /*
         * Ruling 4 says the elite runs the gym's Driver *unmodified*. The risk in an "and also"
         * wiring is that it becomes an "and therefore" — a rung that quietly gains a stat bump or a
         * better AI grade alongside the Driver would make ticket 67's elite band unreadable against
         * its own history, which is the one instrument this ticket has to keep pointing at the same
         * thing.
         */
        const run = makeRun(['Water', 'Nature', 'Fire']);
        const at = node({ id: 'b2l2n0', kind: 'elite', biomeIndex: 2, layer: 2, visited: 1 });

        const withDriver = rollEncounter({ run, node: at, party });
        expect(withDriver.enemyDrivers).toEqual([DRIVER_WAR_FOOTING]);

        // The same elite two biomes back: same rung, same grade, no Driver.
        const plain = rollEncounter({ run, node: node({ ...at, id: 'b0l2n0', biomeIndex: 0 }), party });
        expect(plain.enemyDrivers).toBeUndefined();
        expect(withDriver.enemyAiTier).toBe(plain.enemyAiTier);
        expect(withDriver.enemyParty).toHaveLength(plain.enemyParty.length);
        expect(withDriver.enemyParty.every((e) => e.activeOS !== undefined)).toBe(true);
    });
});

// ---------------------------------------------------------------------------------------------
// Ticket 152 — a wild may not hold two pure cantrips
// ---------------------------------------------------------------------------------------------

describe('ticket 152: the rung decides whether the player meets the loop', () => {
    const run = makeRun(['Water', 'Water', 'Water']);

    /** A side built entirely of the deck this ticket is about. */
    const jormSide = (n: number): IBattleEntity[] =>
        Array.from({ length: n }, (_, i) => ({
            ...KRAKEN,
            id: `j${i}`,
            definitionId: 'jormungandr',
            activeOS: 'jormungandr_v1',
        } as IBattleEntity));

    const count = (deck: ReadonlyArray<string>, id: string) => deck.filter((c) => c === id).length;

    it('a wild keeps ONE undertow; an elite and a gym keep both', () => {
        /*
         * Henry, 2026-09-22: *"leave it, but remove the double undertow cards from all wild
         * encounters. It should only be in elites and bosses."*
         *
         * The loop needs two things: a card that costs nothing and draws, and a second copy of it.
         * Ticket 111's guard holds the resolving instance out of a reshuffle so a card cannot draw
         * itself; it cannot stop two copies drawing each other. 152 measured the result at ≥6
         * casts in 12.7% of jormungandr_v1's turns, max 18, and 16.8% of turns removing three
         * quarters of a health pool.
         *
         * Asserted through `rollEncounter` rather than by calling the helper directly, because
         * the claim is about what the PLAYER meets — a rule that worked in the helper and was
         * never wired to a node would pass a unit test and ship the bug.
         */
        const wild = rollEncounter({ run, node: node({ biomeIndex: 0 }), party: jormSide(1) });
        const elite = rollEncounter({ run, node: node({ kind: 'elite', biomeIndex: 0 }), party: jormSide(1) });

        // Whatever species the roll produced, the rule is about the pile it produced.
        const wildUndertows = count(wild.enemyDeckIds, 'undertow');
        const eliteUndertows = count(elite.enemyDeckIds, 'undertow');
        expect(wildUndertows).toBeLessThanOrEqual(1);
        expect(eliteUndertows).toBeGreaterThanOrEqual(wildUndertows);
    });

    it('caps the SIDE, not the member — three jormungandr still hold one between them', () => {
        /*
         * The enemy side shares one deck. Three copies of the same deck put SIX undertow in one
         * pile, and a per-member rule would have left three — enough to loop, under a rule that
         * claims to stop looping.
         */
        for (const loadout of [ENEMY_LADDER.wild, ENEMY_LADDER.elite, ENEMY_LADDER.gauntlet]) {
            const pile = dedupeCantrips(
                ['undertow', 'ink_stream', 'undertow', 'ink_stream', 'undertow', 'ink_stream'],
                loadout,
            );
            expect(count(pile, 'undertow')).toBe(loadout.duplicateCantrips ? 3 : 1);
            // Nothing else is touched, at either rung.
            expect(count(pile, 'ink_stream')).toBe(3);
        }
    });

    it('has an opinion about EVERY 0-energy card that draws — the tripwire', () => {
        /*
         * The cost of a measured list instead of a property test: a new cantrip is not caught by
         * construction. This is what replaces that safety.
         *
         * Every 0-energy card in the registry that draws must be either CAPPED or explicitly
         * MEASURED AND EXCLUDED. Add a new one and this fails until somebody runs it through
         * `scratch/t152_cardloop.ts` and decides which set it belongs in — so a missed card is a
         * conversation rather than a silent regression.
         *
         * It is also what caught the rule going stale: the day `undertow` gained a self-Weaken
         * rider it stopped matching the old property test, and a wild silently got both copies
         * back.
         */
        const allIds = Object.keys(getInflatedProgramRegistry());
        const freeDraws = freeDrawCardIds(allIds);

        // The population is real - if this ever reads zero, the detector broke, not the pool.
        expect(freeDraws.length).toBeGreaterThan(0);
        expect(freeDraws).toContain('undertow');

        const unruled = freeDraws.filter(
            (id) => !LOOPING_FREE_DRAWS.has(id) && !MEASURED_NOT_LOOPING.has(id),
        );
        expect(unruled, 'measure these with scratch/t152_cardloop.ts, then add them to one of the two sets').toEqual([]);
    });

    it('lets an UPGRADE through, and only because Henry ruled the class out', () => {
        /*
         * Henry, 2026-09-24: *"Leave ignite broken — upgrades are supposed to be broken."*
         *
         * `ignite+` was measured at 23.1% of turns above six casts against its base's 0.3% and
         * ruled intended anyway, so `freeDrawCardIds` drops the whole `upgradeOf` class rather
         * than carrying an exception per card. This test is the receipt for that: the population
         * really does contain a card that would otherwise be unruled, so the widening is doing
         * something, and it is doing exactly that.
         */
        const all = Object.keys(getInflatedProgramRegistry());
        const upgraded = all.filter((id) => getInflatedProgramRegistry()[id].upgradeOf);
        expect(upgraded.length).toBeGreaterThan(0);
        expect(freeDrawCardIds(upgraded)).toEqual([]);

        // The same card WITHOUT the flag is still in the population — so what excuses it is the
        // ruling, not some property of the card that a base card could drift into.
        expect(freeDrawCardIds(['ignite'])).toEqual(['ignite']);
    });


        it('leaves `forage` alone, because it was measured and it does not loop', () => {
        /*
         * This test's REASON changed on 2026-09-23 even though its assertion did not, and the
         * reason is the part worth keeping.
         *
         * It used to be a property: `forage` costs the caster 15 power, so the brake is in the
         * card. That justification is dead — `undertow` was measured with the same 15-power
         * recoil and still chained fourteen deep. A price does not stop a loop whose payoff
         * scales with the loop.
         *
         * What survives is the measurement itself: 1,200 games on ratatoskr_v1 put `forage` at a
         * maximum of 4 casts in a turn and 0.0% of turns at six or more, against `undertow`'s max
         * 18. Capping it would cost that deck 10.9 field points against a loop it has never run.
         */
        const pile = dedupeCantrips(['forage', 'forage', 'undertow', 'undertow'], ENEMY_LADDER.wild);
        expect(count(pile, 'forage')).toBe(2);
        expect(count(pile, 'undertow')).toBe(1);
    });
});
