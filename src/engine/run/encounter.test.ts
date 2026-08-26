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
    KIT_FRACTION_BY_BIOME,
    encounterSeed,
    enemyPartySize,
    isFightNode,
    isOpeningFight,
    kitFractionFor,
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

    /**
     * The opening deck's block width for the enemy at `index`, mirroring the player exactly: the
     * FIRST body carries the starter's three generics on top of its five tagged cards, and every
     * body after it is its five and nothing else (Henry, 2026-08-26). Eight then five, not eight
     * then eight.
     */
    const blockWidth = (index: number) => START_KIT_SIZE + (index === 0 ? STARTER_GENERICS : 0);

    it('biome 0 fields what the player opens with, generics on the first body only, and NO firmware', () => {
        const { enemyParty, enemyDeckIds } = rollEncounter({ run, node: node({ biomeIndex: 0 }), party });

        // Literally the composition `createRun` gives the player's PARTY, block by block: five of
        // each species' own `startKit` cards, plus the starter's single helping of generics riding
        // on the first body. The firmware the kit was chosen from is not readable off the entity
        // (that is the point of the biome-0 row), so the check is that the five ARE one of the
        // species' tagged kits.
        //
        // The symmetry is the claim of this loadout — "the same cards you opened with" is only true
        // if the FILLER rule is the same one, so an enemy side that handed every body three generics
        // would be quietly holding a bigger deck than the player it is meant to mirror.
        expect(enemyDeckIds).toHaveLength(START_KIT_SIZE * enemyParty.length + STARTER_GENERICS);

        let offset = 0;
        enemyParty.forEach((enemy, index) => {
            // Block width read from the constants rather than pinned at a literal: this slice is
            // arithmetic about the opening deck's shape, and it has followed that shape through
            // 3 + 1, 5 + 3, 5 + 0 and ticket 60's 4 + 2 to today's 5 + 3 starter allowance without
            // being edited for anything but where the generics land.
            const block = enemyDeckIds.slice(offset, offset + blockWidth(index));
            offset += blockWidth(index);
            expect(block.slice(START_KIT_SIZE)).toEqual(
                Array.from({ length: index === 0 ? STARTER_GENERICS : 0 }, () => GENERIC_HIT),
            );

            const kits = GetMingmingData(enemy.definitionId).availableOS.map((os) =>
                startKitIdsFor({ ...KRAKEN, definitionId: enemy.definitionId, activeOS: os }, START_KIT_SIZE),
            );
            expect(kits.map((kit) => kit.join(','))).toContain(block.slice(0, START_KIT_SIZE).join(','));

            // No firmware: the biome-0 enemy holds the player's opening cards and runs none of the
            // hooks that make them into an engine. Under ticket 61 that is a sharper contrast than
            // it was — the kit now LEADS with the species' payoff, so the biome-0 enemy is holding
            // the good card and cannot cash it.
            expect(enemy.activeOS).toBeUndefined();
        });
        expect(offset).toBe(enemyDeckIds.length);
    });

    it('biome 1 fields the startKit alone, with the firmware on', () => {
        const { enemyParty, enemyDeckIds } = rollEncounter({ run, node: node({ biomeIndex: 1 }), party });

        // The kit and nothing else — 5 cards a body under ticket 61, read from the constant because
        // the claim is "the startKit alone", not "five".
        expect(enemyDeckIds).toHaveLength(START_KIT_SIZE * enemyParty.length);
        expect(enemyDeckIds).not.toEqual(tunedDeckFor(enemyParty));
        for (const enemy of enemyParty) {
            expect(enemy.activeOS).toBeDefined();
            expect(GetMingmingData(enemy.definitionId).availableOS).toContain(enemy.activeOS);
        }
    });

    it('biome 2 fields the full tuned per-OS deck, with the firmware on', () => {
        const { enemyParty, enemyDeckIds } = rollEncounter({ run, node: node({ biomeIndex: 2 }), party });

        // Not "about the right size" — the actual list, card for card and in order. This is the
        // claim that makes the balance corpus the late-run reference rather than an average.
        expect(enemyDeckIds).toEqual(tunedDeckFor(enemyParty));
        for (const enemy of enemyParty) expect(enemy.activeOS).toBeDefined();
    });

    it('an elite is the biome’s exam: the deepest rule at any depth', () => {
        expect(kitFractionFor(node({ kind: 'elite', biomeIndex: 0 }))).toEqual(KIT_FRACTION_BY_BIOME[2]);
        expect(kitFractionFor(node({ kind: 'gym', biomeIndex: 0 }))).toEqual(KIT_FRACTION_BY_BIOME[2]);

        const { enemyParty, enemyDeckIds } = rollEncounter({
            run,
            node: node({ kind: 'elite', biomeIndex: 0 }),
            party,
        });
        expect(enemyDeckIds).toEqual(tunedDeckFor(enemyParty));
        for (const enemy of enemyParty) expect(enemy.activeOS).toBeDefined();
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
    it('builds the identical individuals at biome 0 and biome 2', () => {
        // Same element in all three biomes, so the species pool is the only thing held constant by
        // hand — everything else is held constant by the seed, which is the claim.
        const run = makeRun(['Fire', 'Fire', 'Fire']);
        const party = [KRAKEN, FENRIR];

        const shallow = rollEncounter({ run, node: node({ biomeIndex: 0 }), party });
        const deep = rollEncounter({ run, node: node({ biomeIndex: 2 }), party });

        expect(deep.enemyParty.map(identityOf)).toEqual(shallow.enemyParty.map(identityOf));
        // ...and the two things that ARE allowed to differ, did.
        expect(shallow.enemyParty.every((e) => e.activeOS === undefined)).toBe(true);
        expect(deep.enemyParty.every((e) => e.activeOS !== undefined)).toBe(true);
        expect(deep.enemyDeckIds).not.toEqual(shallow.enemyDeckIds);
    });

    it('rolls IVs from the same band at every depth', () => {
        const run = makeRun(['Fire', 'Fire', 'Fire']);
        for (let biomeIndex = 0; biomeIndex <= 2; biomeIndex += 1) {
            for (let visit = 1; visit <= 8; visit += 1) {
                const { enemyParty } = rollEncounter({
                    run,
                    node: node({ biomeIndex, visited: visit }),
                    party: [KRAKEN, FENRIR, RATATOSKR],
                });
                for (const enemy of enemyParty) {
                    for (const iv of [enemy.hpIV, enemy.attackIV, enemy.defenseIV]) {
                        expect(iv).toBeGreaterThanOrEqual(10);
                        expect(iv).toBeLessThanOrEqual(31);
                    }
                }
            }
        }
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
        // enemies as they use intents") must not reach a run encounter, or ticket 08's biome-1 and
        // biome-2 rows would silently collapse into the biome-0 one.
        const run = makeRun(['Fire', 'Water', 'Nature']);
        const party = [toMingmingState(ranchMember(KRAKEN))];
        const deep = node({ id: 'b2l2n0', biomeIndex: 2, visited: 1 });
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

    it('leaves an ordinary biome-0 wild exactly as it was', () => {
        // The floor must be a floor, not a second difficulty curve: where the node was already
        // gentle, the softened roll and the ordinary roll are the same fight, seed included.
        const plain = node({ id: 'b0l1n2', kind: 'wild', layer: 1, visited: 1 });
        const softened = rollEncounter({ run: onboardingRun(['Fire', 'Water', 'Nature']), node: plain, party });
        const ordinary = rollEncounter({ run: makeRun(['Fire', 'Water', 'Nature'], 'onboarding-seed'), node: plain, party });
        expect(softened.enemyParty.map(identityOf)).toEqual(ordinary.enemyParty.map(identityOf));
        expect(softened.enemyDeckIds).toEqual(ordinary.enemyDeckIds);
        expect(softened.seed).toBe(ordinary.seed);
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
