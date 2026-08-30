/**
 * THE GYM GAUNTLET — ticket 18.
 *
 * Six claims meet in `rollGauntletFight`, and every one of them can be false without anything
 * crashing, which is what makes them worth a test rather than a comment:
 *
 * - **Three fights, chained.** `exploration-map.md`: *"The gym is a GAUNTLET: three fights, NO
 *   healing between them."* The chain is `runSlice`'s (see `runSlice.gauntlet.test.ts`); what is
 *   here is that the three fights are three *different* fights and that each one rebuilds
 *   identically, which is what a resumed gauntlet depends on.
 * - **The boss team draws one species per biome.** Ticket 18's headline, and the thing that makes
 *   the region its own syllabus. A boss drawn from the gym's element alone would look identical
 *   until you counted the elements.
 * - **Signature firmware, three distinct relics.** The `boss_relic_*` OSes exist; a boss without one
 *   is an overtuned wild.
 * - **Always three enemies.** 3 vs N when the party is short — the reading this ticket flags for
 *   Henry, pinned so that changing it is a decision rather than a drift.
 * - **Full tuned decks + OS**, ticket 08's deepest kit fraction, because the gym is biome-3 depth.
 * - **Nothing scales.** The branch this replaced gave its boss `maxHp * 1.5`. Ticket 21 froze the
 *   engine, so the assertion is that a boss's HP is exactly what its species and IVs give it.
 *
 * Plus the two properties the gauntlet exists for, asserted end-to-end through `createBattleState`:
 * **HP carries** between fights, and **statuses and energy do not**.
 */

import { describe, expect, it } from 'vitest';

import {
    BOSS_IVS,
    GAUNTLET_ENEMY_COUNT,
    GAUNTLET_FIGHTS,
    gauntletFightSeed,
    gauntletOpponentElements,
    gymSignatures,
    isBossFight,
    rollGauntletFight,
} from './gauntlet';
import { authoredBossFor } from './bosses';
import { DRIVER_WAR_FOOTING } from '../data/driverRegistry';
import { getOSBehavior } from '../data/firmwareRegistry';
import { ENEMY_LADDER, gradeFor } from './encounter';
import { buildBattleSetup } from './battleSetup';
import { createRun } from './createRun';
import { GYM_REGISTRY, type IGymOffer } from './gyms';
import { createBattleState } from '../data/battleFactories';
import { GetMingmingData, getDeckForOS } from '../data/mingmingRegistry';
import { initializeBattleEntity } from '../types';
import type { IBiome, IRanchMember, IRanchState, IRegionNode, IRunState } from '../runTypes';
import type { IMingmingState } from '../types';

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

const KRAKEN = member('mm1', 'kraken');
const FENRIR = member('mm2', 'fenrir');
const RATATOSKR = member('mm3', 'ratatoskr');

const biome = (element: string): IBiome => ({
    id: `biome_${element.toLowerCase()}`,
    name: `${element}land`,
    elements: [element],
});

/**
 * A real run through `createRun`, the way the game builds one — graph included, so the gym node
 * these tests roll from is the gym node the game would walk onto. The biome order is the one
 * `offerGyms` produces for a Fire leader (rule 4: the gym's own element is last).
 */
/*
 * TICKET 68 REPOINTED THE DEFAULT GYM, AND THE REASON IS THE POINT OF THE TICKET.
 *
 * Everything below that is about ticket 18's FORMULA boss — one species per biome, a different
 * `boss_relic_*` on each — is still true, but it is now true of the gyms ruling 6 has NOT migrated.
 * Emberfall fields a hand-authored trio behind a Driver, so a formula assertion pointed at it would
 * be asserting the thing this ticket deleted.
 *
 * So the default is **Tidewrack**, which is what those tests were always really about, and the
 * authored path gets its own describe block with its own run. Ruling 6's "exactly one gym migrates
 * per session" is why both sets have to keep passing at once.
 */
function makeRun(
    party: ReadonlyArray<IMingmingState> = [KRAKEN, FENRIR, RATATOSKR],
    seed = 'gauntlet-test-seed',
    gym = GYM_REGISTRY.gym_rootfall,
    biomes: ReadonlyArray<IBiome> = [biome('Nature'), biome('Fire'), biome('Water')],
): IRunState {
    const offer: IGymOffer = { gym, biomes: [...biomes] };
    return createRun({ seed, offer, party, startedAt: 0 });
}

/** A run walking into the one gym ticket 68 authored (`AUTHORED_BOSSES`). */
function makeEmberfallRun(
    party: ReadonlyArray<IMingmingState> = [KRAKEN, FENRIR, RATATOSKR],
    seed = 'gauntlet-test-seed',
): IRunState {
    return makeRun(party, seed, GYM_REGISTRY.gym_emberfall, [biome('Water'), biome('Nature'), biome('Fire')]);
}

function gymNodeOf(run: IRunState): IRegionNode {
    const gym = run.nodes.find((n) => n.kind === 'gym');
    if (!gym) throw new Error('the region graph has no gym node');
    // The player walked onto it, so it is visit-incremented — the count `nodeSeed` rolls from.
    return { ...gym, visited: gym.visited + 1 };
}

const ranchMember = (m: IMingmingState): IRanchMember => ({
    id: m.id,
    definitionId: m.definitionId,
    activeOS: m.activeOS!,
    attackIV: m.attackIV!,
    defenseIV: m.defenseIV!,
    hpIV: m.hpIV!,
});

const ranchOf = (party: ReadonlyArray<IMingmingState>): IRanchState => ({
    roster: party.map(ranchMember),
    blueprints: {},
    codex: { seen: [], played: [] , species: [], assembled: [], os: [] },
    gymsCleared: [],
    highestTierCleared: 0,
    seenTips: [],
    codexMilestones: [],
});

const BOSS = GAUNTLET_FIGHTS - 1;

// ---------------------------------------------------------------------------------------------
// The seed: three fights, and a resume
// ---------------------------------------------------------------------------------------------

describe('gauntletFightSeed', () => {
    it('is a pure function of (run seed, node id, visit count, fight index)', () => {
        const run = makeRun();
        const twin = makeRun();
        const node = gymNodeOf(run);

        expect(gauntletFightSeed(run, node, 0)).toBe(gauntletFightSeed(twin, gymNodeOf(twin), 0));
    });

    it('gives each of the three fights its own stream', () => {
        const run = makeRun();
        const node = gymNodeOf(run);
        const seeds = [0, 1, 2].map((i) => gauntletFightSeed(run, node, i));

        expect(new Set(seeds).size).toBe(3);
    });

    it('changes with the run seed, so two runs do not share a gym', () => {
        const a = makeRun();
        const b = makeRun([KRAKEN, FENRIR, RATATOSKR], 'a-different-run');

        expect(gauntletFightSeed(a, gymNodeOf(a), 0)).not.toBe(gauntletFightSeed(b, gymNodeOf(b), 0));
    });
});

describe('rollGauntletFight — determinism', () => {
    it('rebuilds the identical fight from the same run, node and index', () => {
        // The resume contract (ticket 23) applied to the gauntlet: an app close between fights comes
        // back to the same three opponents. Nothing about them is stored — `IGauntletProgress`
        // carries an index, not an enemy list — so this is the only thing that makes that true.
        const run = makeRun();
        const node = gymNodeOf(run);

        expect(rollGauntletFight({ run, node, fightIndex: 1 }))
            .toEqual(rollGauntletFight({ run, node, fightIndex: 1 }));
    });

    it('a run reconstructed from its own seed rolls the same gauntlet', () => {
        const first = makeRun();
        const resumed = makeRun();

        for (let fightIndex = 0; fightIndex < GAUNTLET_FIGHTS; fightIndex += 1) {
            expect(rollGauntletFight({ run: resumed, node: gymNodeOf(resumed), fightIndex }))
                .toEqual(rollGauntletFight({ run: first, node: gymNodeOf(first), fightIndex }));
        }
    });

    it('fight 2 is not fight 1', () => {
        const run = makeRun();
        const node = gymNodeOf(run);

        const one = rollGauntletFight({ run, node, fightIndex: 0 });
        const two = rollGauntletFight({ run, node, fightIndex: 1 });

        expect(two.seed).not.toBe(one.seed);
        expect(two.enemyParty.map((e) => e.id)).not.toEqual(one.enemyParty.map((e) => e.id));
    });
});

// ---------------------------------------------------------------------------------------------
// The three fights
// ---------------------------------------------------------------------------------------------

describe('rollGauntletFight — always full 3v3 (ticket 18, flagged reading)', () => {
    it('fields three enemies at every fight, whatever the player brings', () => {
        for (const party of [[KRAKEN], [KRAKEN, FENRIR], [KRAKEN, FENRIR, RATATOSKR]]) {
            const run = makeRun(party);
            const node = gymNodeOf(run);
            for (let fightIndex = 0; fightIndex < GAUNTLET_FIGHTS; fightIndex += 1) {
                expect(rollGauntletFight({ run, node, fightIndex }).enemyParty).toHaveLength(GAUNTLET_ENEMY_COUNT);
            }
        }
    });

    it('a solo party fights 1 vs 3, end to end', () => {
        // The consequence of the reading, stated as behaviour: the run hands you two workshops to
        // reach a full party (ticket 14), so arriving alone is a choice the exam does not soften.
        const run = makeRun([KRAKEN]);
        const node = gymNodeOf(run);
        const fight = rollGauntletFight({ run, node, fightIndex: 0 });
        const withGauntlet: IRunState = {
            ...run,
            phase: 'gauntlet',
            gauntlet: { fightIndex: 0, totalFights: GAUNTLET_FIGHTS, persistedHp: {}, downedMemberIds: [] },
        };

        const battle = createBattleState(
            buildBattleSetup(ranchOf([KRAKEN]), withGauntlet, fight),
            [],
            undefined,
            { seed: fight.seed, enemyMode: 'CARDS' },
        );

        expect(battle.playerParty).toHaveLength(1);
        expect(battle.enemyParty).toHaveLength(3);
    });
});

describe('rollGauntletFight — the leader’s team (fights 1 and 2)', () => {
    const run = makeRun();
    const node = gymNodeOf(run);

    it('draws from the run’s own biomes', () => {
        const regionElements = new Set(run.biomes.flatMap((b) => b.elements));

        for (const fightIndex of [0, 1]) {
            for (const enemy of rollGauntletFight({ run, node, fightIndex }).enemyParty) {
                expect(regionElements.has(GetMingmingData(enemy.definitionId).primaryElement)).toBe(true);
            }
        }
    });

    it('runs its own firmware, not a boss relic', () => {
        for (const fightIndex of [0, 1]) {
            for (const enemy of rollGauntletFight({ run, node, fightIndex }).enemyParty) {
                expect(GetMingmingData(enemy.definitionId).availableOS).toContain(enemy.activeOS);
            }
        }
    });

    it('fields no duplicate species — one of each, as a team is (map § Notes)', () => {
        for (const fightIndex of [0, 1, BOSS]) {
            const species = rollGauntletFight({ run, node, fightIndex }).enemyParty.map((e) => e.definitionId);
            expect(new Set(species).size).toBe(species.length);
        }
    });
});

describe('rollGauntletFight — the boss team (fight 3)', () => {
    const run = makeRun();
    const node = gymNodeOf(run);
    const fight = rollGauntletFight({ run, node, fightIndex: BOSS });

    it('fields the gym’s AUTHORED trio — the biome draw no longer decides a boss', () => {
        // Ticket 18's headline was *"the run trains you for its own exam"*: one species per biome,
        // in biome order. Tickets 68/71/72 replaced that with hand-authored trios at all three
        // gyms, so what the fight owes the run is no longer its species list. The stream-position
        // discipline that made authoring safe is asserted separately, below.
        const authored = authoredBossFor(run.gymId)!;
        expect(authored).toBeDefined();
        expect(fight.enemyParty.map((e) => e.definitionId))
            .toEqual(authored.members.map((m) => m.species));
    });

    it('is at its natural HP — the 1.5x warden multiplier is gone (ticket 21)', () => {
        for (const enemy of fight.enemyParty) {
            const natural = initializeBattleEntity(
                {
                    id: enemy.id,
                    definitionId: enemy.definitionId,
                    blueprintsCollected: 0,
                    hpIV: enemy.hpIV,
                    attackIV: enemy.attackIV,
                    defenseIV: enemy.defenseIV,
                },
                GetMingmingData(enemy.definitionId),
            );
            expect(enemy.maxHp).toBe(natural.maxHp);
            expect(enemy.currentHp).toBe(enemy.maxHp);
        }
    });

    it('holds a real deck rather than three hardcoded moves', () => {
        // The old tier-3 boss set `enemyDeckIds = []` and leaned on `moves`. A gym is biome-3 depth,
        // so ticket 08's deepest row says full tuned decks.
        expect(fight.enemyDeckIds.length).toBeGreaterThan(0);
        for (const enemy of fight.enemyParty) {
            expect(enemy.moves ?? []).toHaveLength(0);
            // `getDeckForOS` resolves a `boss_relic_*` id to the species' first tuned list by its
            // documented fallback — which is also what makes a shipped boss reproducible in the
            // balance harness as `[species, boss_relic_x]` (`debug/balance/teamComps.ts`).
            for (const dataId of getDeckForOS(enemy.definitionId, enemy.activeOS)) {
                expect(fight.enemyDeckIds).toContain(dataId);
            }
        }
    });

    it('is the last fight, and only the last fight', () => {
        expect(isBossFight(0)).toBe(false);
        expect(isBossFight(1)).toBe(false);
        expect(isBossFight(BOSS)).toBe(true);
    });
});

// ---------------------------------------------------------------------------------------------
// Ticket 08 — the gym is biome-3 depth
// ---------------------------------------------------------------------------------------------

describe('the gym is the enemy ladder’s top rung', () => {
    it('a gym node grades as the gauntlet: tuned deck, firmware on, FULL lookahead', () => {
        // The gauntlet is the only rung that gets the full one-turn lookahead — the grade the whole
        // game shipped at before ticket 60 split it three ways. Read off `ENEMY_LADDER` rather than
        // written as a literal here, so this file cannot hold a second opinion about the gym's rung
        // (the same discipline it already keeps about the gym's deck).
        const run = makeRun();
        expect(gradeFor(gymNodeOf(run).kind)).toBe('gauntlet');
        expect(ENEMY_LADDER.gauntlet).toMatchObject({ deck: 'tuned', os: true, ai: 'full' });
        expect(rollGauntletFight({ run, node: gymNodeOf(run), fightIndex: 0 }).enemyAiTier).toBe('full');
    });

    it('the BOSS does not roll — fixed authored IVs, and the same team every time', () => {
        /*
         * Ticket 67, ruled: *"the gauntlet boss gets FIXED authored IVs per comp — exactly as hard
         * as designed, tuned directly."* It is the run's last fight and the only one the player
         * cannot walk around, so its difficulty has to be a decision rather than a distribution:
         * under a band, a boss measuring 8.3% might be too hard or might have rolled hot, and the
         * two are indistinguishable from outside.
         *
         * The leader's EARLIER teams still roll — they are elites, and an exam is allowed variance.
         * Both halves are asserted, because a fix applied to the whole gauntlet would pass a
         * boss-only check.
         */
        const run = makeRun();
        const node = gymNodeOf(run);

        const boss = rollGauntletFight({ run, node, fightIndex: GAUNTLET_FIGHTS - 1 });
        boss.enemyParty.forEach((enemy, slot) => {
            const authored = BOSS_IVS[Math.min(slot, BOSS_IVS.length - 1)];
            expect({ hp: enemy.hpIV, attack: enemy.attackIV, defense: enemy.defenseIV })
                .toEqual({ hp: authored.hp, attack: authored.attack, defense: authored.defense });
        });

        // The earlier fights are elites and DO vary. Sampled across seeds rather than asserted on
        // one, because a single fight could legitimately roll the authored triple by chance.
        const rolled = new Set<number>();
        for (let i = 0; i < 12; i += 1) {
            const seeded = { ...run, seed: `gauntlet-iv-${i}` };
            for (const enemy of rollGauntletFight({ run: seeded, node, fightIndex: 0 }).enemyParty) {
                rolled.add(enemy.hpIV);
            }
        }
        expect(rolled.size).toBeGreaterThan(1);
        expect(Math.max(...rolled)).toBeLessThanOrEqual(ENEMY_LADDER.gauntlet.iv[1]);
        expect(Math.min(...rolled)).toBeGreaterThanOrEqual(ENEMY_LADDER.gauntlet.iv[0]);
    });

    it('so every gauntlet enemy holds its whole tuned list and runs its firmware', () => {
        const run = makeRun();
        const node = gymNodeOf(run);
        const fight = rollGauntletFight({ run, node, fightIndex: 0 });

        for (const enemy of fight.enemyParty) {
            expect(enemy.activeOS).toBeDefined();
            expect(getDeckForOS(enemy.definitionId, enemy.activeOS).length).toBeGreaterThan(0);
        }
        const expected = fight.enemyParty
            .flatMap((enemy) => getDeckForOS(enemy.definitionId, enemy.activeOS));
        expect([...fight.enemyDeckIds].sort()).toEqual([...expected].sort());
    });
});

// ---------------------------------------------------------------------------------------------
// exploration-map.md — three fights, NO healing between them
// ---------------------------------------------------------------------------------------------

describe('no healing between the three fights', () => {
    const party = [KRAKEN, FENRIR, RATATOSKR];
    const ranch = ranchOf(party);

    /** A run standing in the gauntlet, at `fightIndex`, carrying `persistedHp` / `downedMemberIds`. */
    function inGauntlet(
        fightIndex: number,
        persistedHp: Record<string, number>,
        downedMemberIds: string[] = [],
    ): IRunState {
        return {
            ...makeRun(party),
            phase: 'gauntlet',
            gauntlet: { fightIndex, totalFights: GAUNTLET_FIGHTS, persistedHp, downedMemberIds },
        };
    }

    function battleFor(run: IRunState, fightIndex: number) {
        const node = gymNodeOf(run);
        const fight = rollGauntletFight({ run, node, fightIndex });
        return createBattleState(buildBattleSetup(ranch, run, fight), [], undefined, {
            seed: fight.seed,
            enemyMode: 'CARDS',
        });
    }

    it('fight 1 opens with the party whole', () => {
        const battle = battleFor(inGauntlet(0, {}), 0);

        for (const entity of battle.playerParty) {
            expect(entity.currentHp).toBe(entity.maxHp);
        }
    });

    it('fight 2 opens on the HP fight 1 left, not on a full bar', () => {
        const battle = battleFor(inGauntlet(1, { mm1: 12, mm2: 40 }), 1);

        const kraken = battle.playerParty.find((p) => p.id === 'mm1')!;
        const fenrir = battle.playerParty.find((p) => p.id === 'mm2')!;
        expect(kraken.currentHp).toBe(12);
        expect(fenrir.currentHp).toBe(40);
        // Untouched members carry nothing and therefore start whole — an absent key is not a zero.
        const ratatoskr = battle.playerParty.find((p) => p.id === 'mm3')!;
        expect(ratatoskr.currentHp).toBe(ratatoskr.maxHp);
    });

    it('carries HP and NOTHING ELSE — statuses and energy reset every fight', () => {
        /*
         * The reading ticket 18 flags for Henry, pinned as behaviour. `IGauntletProgress` is a
         * ratified type (ticket 06) with exactly `fightIndex`, `totalFights`, `persistedHp` and
         * `downedMemberIds` — there is no field a status could be written to — and its own docblock
         * keeps v3's ruling verbatim: "only `hp` persists between the three fights; energy, statuses
         * and everything else reset each fight."
         *
         * This is true by construction (`initializeBattleEntity` starts every entity empty and full
         * of energy, and only `currentHp` is overwritten afterwards), and the test is what would
         * catch a well-meant "carry the Burn too" patch.
         */
        const battle = battleFor(inGauntlet(2, { mm1: 12, mm2: 40, mm3: 0 }), 2);

        for (const entity of battle.playerParty) {
            expect(entity.statusEffects).toEqual([]);
            expect(entity.currentEnergy).toBe(entity.maxEnergy);
            expect(entity.tempHp).toBe(0);
        }
    });

    it('a member downed in an earlier fight is STILL DOWN — at 0 HP, on the field, revivable', () => {
        // `economy-session.md`: "Gauntlet death: revivable, never gone-for-gauntlet." Both halves
        // matter — still down (0, not healed) and still present (on the field, so the Revive macro's
        // DOWNED_ALLY targeting has something to point at).
        const battle = battleFor(inGauntlet(1, { mm1: 12, mm3: 0 }, ['mm3']), 1);

        const downed = battle.playerParty.find((p) => p.id === 'mm3')!;
        expect(downed).toBeDefined();
        expect(downed.currentHp).toBe(0);
        expect(downed.maxHp).toBeGreaterThan(0);
    });

    it('a member revived out of the downed list comes back on the HP the revive gave', () => {
        // The other side of the same coin, and the thing ticket 15's resolution asks this ticket to
        // wire: once `runSlice.reviveGauntletMember` has moved a member out of `downedMemberIds` and
        // into `persistedHp`, the next fight builds them alive at that HP.
        const battle = battleFor(inGauntlet(2, { mm1: 12, mm3: 33 }, []), 2);

        const revived = battle.playerParty.find((p) => p.id === 'mm3')!;
        expect(revived.currentHp).toBe(33);
    });
});

// ---------------------------------------------------------------------------------------------
// The authored boss (ticket 68)
// ---------------------------------------------------------------------------------------------

describe('rollGauntletFight — Emberfall, the authored boss (ticket 68)', () => {
    const run = makeEmberfallRun();
    const node = gymNodeOf(run);
    const fight = rollGauntletFight({ run, node, fightIndex: BOSS });
    const authored = authoredBossFor('gym_emberfall')!;

    it('fields the authored trio, in the authored order', () => {
        expect(fight.enemyParty.map((e) => e.definitionId))
            .toEqual(authored.members.map((m) => m.species));
    });

    it('KEEPS EACH MEMBER’S OWN TUNED OS — the Driver is additive, not a replacement (ruling 2)', () => {
        // This is the whole redesign in one assertion. Ticket 18's boss had its `activeOS`
        // OVERWRITTEN with a `boss_relic_*`, which silently cost it its real firmware and left
        // `getDeckForOS` resolving the deck through a documented fallback.
        expect(fight.enemyParty.map((e) => e.activeOS)).toEqual(authored.members.map((m) => m.os));
        for (const enemy of fight.enemyParty) {
            expect(GetMingmingData(enemy.definitionId).availableOS).toContain(enemy.activeOS);
            expect(enemy.activeOS?.startsWith('boss_relic_')).toBe(false);
        }
    });

    it('holds the species’ REAL tuned deck, with no fallback in the path', () => {
        // The quieter half of ruling 2: because `activeOS` is one of the species' own, the deck
        // lookup returns that OS's tuned list directly — a deck the player could build.
        const expected = authored.members.flatMap((m) => getDeckForOS(m.species, m.os));
        expect([...fight.enemyDeckIds]).toEqual(expected);
    });

    it('runs exactly ONE side-level Driver, and it is not a relic (ruling 1)', () => {
        expect(fight.enemyDrivers).toEqual([DRIVER_WAR_FOOTING]);
        expect(DRIVER_WAR_FOOTING.startsWith('boss_relic_')).toBe(false);
    });

    it('still takes the authored IVs — BOSS_IVS is untouched by this ticket (ruling 7)', () => {
        fight.enemyParty.forEach((enemy, slot) => {
            expect(enemy.hpIV).toBe(BOSS_IVS[slot].hp);
            expect(enemy.attackIV).toBe(BOSS_IVS[slot].attack);
            expect(enemy.defenseIV).toBe(BOSS_IVS[slot].defense);
        });
    });

    it('leaves fights 1 and 2 rolled, not authored', () => {
        for (const fightIndex of [0, 1]) {
            const earlier = rollGauntletFight({ run, node, fightIndex });
            expect(earlier.enemyDrivers).toBeUndefined();
            // The leader's own teams draw from the whole region; the authored trio is fight 3 only.
            for (const enemy of earlier.enemyParty) {
                expect(GetMingmingData(enemy.definitionId).availableOS).toContain(enemy.activeOS);
            }
        }
    });

    it('reads gymId and nothing else — each gym fields ITS OWN trio and its own Driver', () => {
        // Stream-position discipline. With every gym authored the old form of this test (an
        // un-authored gym still rolling normally) has nothing to stand on, so what it checks now is
        // the property that mattered underneath it: the branch is keyed on `gymId` alone, and the
        // three gyms do not bleed into one another.
        for (const gymId of ['gym_emberfall', 'gym_tidewrack', 'gym_rootfall'] as const) {
            const run = makeRun([KRAKEN, FENRIR, RATATOSKR], 'gauntlet-test-seed', GYM_REGISTRY[gymId]);
            const rolled = rollGauntletFight({ run, node: gymNodeOf(run), fightIndex: BOSS });
            const authored = authoredBossFor(gymId)!;
            expect(rolled.enemyParty.map((e) => e.definitionId)).toEqual(authored.members.map((m) => m.species));
            expect(rolled.enemyDrivers).toEqual([authored.driver]);
        }
    });
});

describe('gymSignatures — the offer screen telegraph (ticket 68 ruling 4)', () => {
    const emberfallBiomes = [biome('Water'), biome('Nature'), biome('Fire')];

    it('gives an authored gym its ONE Driver, by name and rule text', () => {
        const signatures = gymSignatures('gym_emberfall', emberfallBiomes);
        expect(signatures).toHaveLength(1);
        expect(signatures[0].id).toBe(DRIVER_WAR_FOOTING);
        expect(signatures[0].name).toBe('WAR FOOTING');
        // The rule has to be READABLE, not just present — this string is the whole telegraph.
        expect(signatures[0].description).toContain('Strengthened');
        expect(signatures[0].description).toContain('turn 4');
    });

});

// ---------------------------------------------------------------------------------------------
// What the Pit Stop is allowed to say
// ---------------------------------------------------------------------------------------------

describe('gauntletOpponentElements', () => {
    it('reports the elements of the fight that will actually be rolled', () => {
        const run = makeRun();
        const node = gymNodeOf(run);

        const promised = gauntletOpponentElements({ run, node, fightIndex: BOSS });
        const delivered = rollGauntletFight({ run, node, fightIndex: BOSS })
            .enemyParty.map((e) => e.primaryElement as string);

        expect(promised).toEqual(delivered);
        // Types visible, contents hidden (`exploration-map.md`) — elements, never species ids.
        // TICKET 72: no longer the biome order. Every gym is authored, so the promise is the
        // TRIO's elements; the invariant that survives — and the only one the screen depends on —
        // is that the promise matches what walks out, which the line above asserts.
        expect(promised.every((e) => typeof e === 'string' && e.length > 0)).toBe(true);
        expect(promised).toHaveLength(GAUNTLET_ENEMY_COUNT);
    });

    it('reports the AUTHORED trio’s elements at Emberfall, which are not the biome order', () => {
        // Ticket 68: an authored team is composed by ruling 3's heuristic (two of the leader's own
        // element plus one countering the counter), so it deliberately does NOT read one-per-biome.
        // The Pit Stop's contract is unchanged — what it promises is what walks out — and that is
        // the thing worth pinning, not the particular elements.
        const run = makeEmberfallRun();
        const node = gymNodeOf(run);

        const promised = gauntletOpponentElements({ run, node, fightIndex: BOSS });
        const delivered = rollGauntletFight({ run, node, fightIndex: BOSS })
            .enemyParty.map((e) => e.primaryElement as string);

        expect(promised).toEqual(delivered);
        expect(promised).toEqual(['Fire', 'Fire', 'Nature']);
    });
});

/**
 * TICKET 72: the guard that replaces the deleted relic fallback.
 *
 * `gymSignatures` and `rollGauntletFight` used to have a formula branch for gyms with no authored
 * boss. That branch is gone with the `boss_relic_*` firmwares, which means an un-authored gym would
 * now field a team with NO firmware and NO Driver — a quietly empty boss rather than a crash.
 *
 * So the invariant the deletion depends on gets asserted directly: every gym in the registry has an
 * authored boss. A fourth gym added without one fails here, loudly, instead of shipping a boss that
 * does nothing.
 */
describe('every gym is authored — the invariant the relic deletion rests on', () => {
    it('has an authored trio and a Driver for every entry in GYM_REGISTRY', () => {
        const gymIds = Object.keys(GYM_REGISTRY);
        expect(gymIds.length).toBeGreaterThan(0);
        for (const gymId of gymIds) {
            const authored = authoredBossFor(gymId);
            expect(authored, `${gymId} has no authored boss`).toBeDefined();
            expect(authored!.members).toHaveLength(GAUNTLET_ENEMY_COUNT);
            expect(authored!.driver.startsWith('driver_'), `${gymId}'s Driver must not be a relic`).toBe(true);
            // The telegraph has something real to print.
            const signatures = gymSignatures(gymId, [biome('Nature'), biome('Fire'), biome('Water')]);
            expect(signatures).toHaveLength(1);
            expect(signatures[0].description.length).toBeGreaterThan(0);
        }
    });

    it('leaves NO boss_relic_* firmware registered anywhere', () => {
        for (const id of ['boss_relic_fire', 'boss_relic_water', 'boss_relic_ice']) {
            expect(getOSBehavior(id), `${id} should be deleted`).toBeUndefined();
        }
    });
});
