import { describe, expect, it } from 'vitest';

import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GAUNTLET_ENEMY_COUNT, GAUNTLET_FIGHTS } from '../../engine/run/gauntlet';
import { ENEMY_LADDER, RUN_ENEMY_MODE } from '../../engine/run/encounter';
import { MingmingRegistry, getDeckForOS } from '../../engine/data/mingmingRegistry';
import { REGION_PARAMS } from '../../engine/run/regionGraph';
import { minimumActiveDeck } from '../../engine/run/createRun';
import {
    CELLS,
    NO_FIRMWARE_OS,
    RUN_GATE_TARGETS,
    TUNED_OS_IDS,
    bandVerdict,
    lineupFor,
    sampleFight,
    wilson,
} from './runGate';

/**
 * TICKET 61 — the run gate's own self-checks.
 *
 * **This suite deliberately plays no battles.** `npm test` is the commit gate and a single 3v3
 * battle in this harness costs 30-70 seconds, so anything that measured a win rate here would put
 * hours on every commit. What it checks instead is the half of the gate that CAN be wrong silently:
 * the translation from a rolled `IRunEncounter` into a `ComposedSetup`, and the sampling claims the
 * module's header makes in prose. Every assertion below corresponds to a sentence in `runGate.ts`
 * that would otherwise be true only until someone edited the engine.
 *
 * A win rate is not testable here anyway — it is the measurement the tool exists to produce, and
 * pinning one would turn a report into a regression on the numbers Henry is supposed to be ruling on.
 */
describe('run gate — the sample', () => {
    it('is the twelve tuned OS ids: the six launch species x two firmwares', () => {
        expect(TUNED_OS_IDS).toHaveLength(12);
        // Every one of them is tagged, so no player deck in this gate takes `startKitIdsFor`'s
        // untagged fallback (the first five cards of the tuned deck, chosen by nobody).
        for (const osId of TUNED_OS_IDS) {
            const species = Object.keys(MingmingRegistry).find((s) =>
                MingmingRegistry[s].availableOS.includes(osId))!;
            expect(MingmingRegistry[species].startKits?.[osId]).toBeDefined();
            expect(getDeckForOS(species, osId).length).toBeGreaterThan(0);
        }
    });

    it('walks every tuned OS as the starter exactly once per twelve samples', () => {
        const starters = Array.from({ length: TUNED_OS_IDS.length }, (_, i) => lineupFor(i, 1)[0]);
        expect(new Set(starters).size).toBe(TUNED_OS_IDS.length);
    });

    it('never puts two of one species in a party, at any size, at any offset', () => {
        // The standing no-duplicate-species law (map § Notes, enforced by `reconcileLoadedState`).
        // `lineupFor` throws on a violation; the loop is what proves the stride can never cause one.
        for (let index = 0; index < 60; index += 1) {
            for (const size of [1, 2, 3]) {
                expect(() => lineupFor(index, size)).not.toThrow();
            }
        }
    });

    it('spreads across species faster than the roster order does', () => {
        // The reason the stride is 5 rather than 1: `TUNED_OS_IDS` is ordered in same-species pairs,
        // so the naive walk spends its first six samples on three species.
        const speciesOf = (osId: string) =>
            Object.keys(MingmingRegistry).find((s) => MingmingRegistry[s].availableOS.includes(osId))!;
        const firstSix = Array.from({ length: 6 }, (_, i) => speciesOf(lineupFor(i, 1)[0]));
        expect(new Set(firstSix).size).toBeGreaterThanOrEqual(5);
    });
});

describe('run gate — the cells', () => {
    it('covers every biome for wilds and elites, and every gauntlet fight', () => {
        expect(CELLS.filter((c) => c.band === 'wild')).toHaveLength(REGION_PARAMS.biomesPerRun);
        expect(CELLS.filter((c) => c.band === 'elite')).toHaveLength(REGION_PARAMS.biomesPerRun);
        expect(CELLS.filter((c) => c.band === 'gauntlet')).toHaveLength(GAUNTLET_FIGHTS);
        expect(new Set(CELLS.map((c) => c.id)).size).toBe(CELLS.length);
    });

    it('grows the party 1 -> 2 -> 3 across the biomes, and fights the gauntlet as a trio', () => {
        expect(CELLS.filter((c) => c.band === 'wild').map((c) => c.partySize)).toEqual([1, 2, 3]);
        expect(CELLS.filter((c) => c.band === 'gauntlet').every((c) => c.partySize === 3)).toBe(true);
    });
});

describe('run gate — the fight it builds is the fight the run rolls', () => {
    it('deals the player the deck createRun deals: 8 / 13 / 18 by party size', () => {
        // `sampleFight` cross-checks its own deck against `createRun`'s and against
        // `minimumActiveDeck`, and throws on either mismatch — so reaching this assertion is most
        // of the test. The lengths are re-stated here so a failure names the number that moved.
        for (const size of [1, 2, 3]) {
            const cell = CELLS.find((c) => c.band === 'wild' && c.partySize === size)!;
            expect(sampleFight(cell, 0).setup.player.deck).toHaveLength(minimumActiveDeck(size));
        }
        expect([1, 2, 3].map(minimumActiveDeck)).toEqual([8, 13, 18]);
    });

    it('fields ticket 60\'s ladder: a wild runs NO firmware at every depth, an elite runs one', () => {
        /*
         * `ENEMY_LADDER` is the one knob; this asserts the gate reads it rather than holding an
         * opinion about it, so retuning the ladder retunes the gate.
         *
         * The loop used to index the expectation on BIOME, off ticket 08's table — no firmware at
         * biome 0, firmware below it. Depth is not the axis any more, so the expectation is flat
         * across biomes and the CONTRAST that matters is against the elite band. Both are checked in
         * one test, because "wilds have no firmware" passes trivially in a world where nothing does.
         */
        for (let biomeIndex = 0; biomeIndex < REGION_PARAMS.biomesPerRun; biomeIndex += 1) {
            const wild = CELLS.find((c) => c.band === 'wild' && c.biomeIndex === biomeIndex)!;
            for (const enemy of sampleFight(wild, 0).setup.enemies) {
                expect(enemy.activeOS).toBe(NO_FIRMWARE_OS);
            }

            /*
             * Elites are sampled by SEARCH rather than at index 0, because a biome does not always
             * contain one: biome 2's exit is the gym, so its only elites are whatever the middle
             * layers rolled, and `pickNode` throws `NoSuchNodeError` for a run that has none. The
             * gate itself skips those samples, and so does this — silently asserting nothing would
             * be the failure mode, so the search is bounded and the find is required.
             */
            const elite = CELLS.find((c) => c.band === 'elite' && c.biomeIndex === biomeIndex)!;
            let checked = 0;
            for (let index = 0; index < 12 && checked === 0; index += 1) {
                let sampled;
                try {
                    sampled = sampleFight(elite, index);
                } catch {
                    continue;
                }
                for (const enemy of sampled.setup.enemies) {
                    expect(enemy.activeOS).not.toBe(NO_FIRMWARE_OS);
                    expect(getOSBehavior(enemy.activeOS!)).toBeDefined();
                    checked += 1;
                }
            }
            expect(checked).toBeGreaterThan(0);
        }
    });

    it('carries the ladder\'s AI grade into the batch, per band', () => {
        /*
         * The third column, and the one a harness can silently drop: `runBatch` defaults to the
         * PROCESS tier, so a gate that forgot to pass `enemyAiTier` would play every rung at full
         * lookahead and report a game the run does not field — wilds two grades too strong, and no
         * error anywhere.
         *
         * Read off `ENEMY_LADDER` for the reason above: this file must not hold its own copy of
         * which band plays at which grade.
         */
        const gradeOf = (id: string) =>
            sampleFight(CELLS.find((c) => c.id === id)!, 0).enemyAiTier;

        expect(gradeOf('wild:biome0')).toBe(ENEMY_LADDER.wild.ai);
        expect(gradeOf('elite:biome0')).toBe(ENEMY_LADDER.elite.ai);
        expect(gradeOf('gauntlet:fight0')).toBe(ENEMY_LADDER.gauntlet.ai);
        // And the three are genuinely different, so a ladder collapsed to one grade fails here
        // rather than passing three tautologies.
        expect(new Set([ENEMY_LADDER.wild.ai, ENEMY_LADDER.elite.ai, ENEMY_LADDER.gauntlet.ai]).size).toBe(3);
    });

    it('gives an enemy with no firmware an id the firmware registry does not know', () => {
        // The whole load-bearing claim of `NO_FIRMWARE_OS`. If this ever resolves, every biome-0
        // wild in the gate is quietly running hooks and the WILDS band reads low.
        expect(getOSBehavior(NO_FIRMWARE_OS)).toBeUndefined();
        const solo = sampleFight(CELLS.find((c) => c.id === 'wild:biome0')!, 0).setup;
        expect(solo.enemies.every((e) => getOSBehavior(e.activeOS!) === undefined)).toBe(true);
    });

    it('sizes the enemy party symmetrically, and the gauntlet at three whatever the player brings', () => {
        for (const cell of CELLS.filter((c) => c.band === 'wild')) {
            expect(sampleFight(cell, 0).setup.enemies).toHaveLength(cell.partySize);
        }
        for (const cell of CELLS.filter((c) => c.band === 'gauntlet')) {
            expect(sampleFight(cell, 0).setup.enemies).toHaveLength(GAUNTLET_ENEMY_COUNT);
        }
    });

    it('carries the whole rolled enemy pile, on the first enemy, in CARDS mode', () => {
        // `buildScenarioState` flattens `enemies.flatMap(e => e.deck ?? [])` exactly as
        // `createBattleState` does, so "all of it on enemies[0]" reproduces the run's shared pile.
        const trio = sampleFight(CELLS.find((c) => c.id === 'wild:biome2')!, 0).setup;
        expect(trio.enemyMode).toBe(RUN_ENEMY_MODE);
        expect(trio.enemies[0].deck!.length).toBeGreaterThan(0);
        expect(trio.enemies.slice(1).every((e) => e.deck!.length === 0)).toBe(true);
    });

    it('gives the last gauntlet fight the boss signatures, and the earlier two ordinary firmware', () => {
        const boss = sampleFight(CELLS.find((c) => c.id === `gauntlet:fight${GAUNTLET_FIGHTS - 1}`)!, 0).setup;
        expect(boss.enemies.every((e) => e.activeOS!.startsWith('boss_relic_'))).toBe(true);
        // Ticket 18: no two members of one boss team share a signature.
        expect(new Set(boss.enemies.map((e) => e.activeOS)).size).toBe(boss.enemies.length);

        const first = sampleFight(CELLS.find((c) => c.id === 'gauntlet:fight0')!, 0).setup;
        expect(first.enemies.every((e) => !e.activeOS!.startsWith('boss_relic_'))).toBe(true);
    });

    it('varies the enemies between samples, which a single batch of N would not', () => {
        // The reason `measureCell` runs `iterations: 1` per sample instead of one batch of N:
        // `rollEncounter` is deterministic in (run seed, node, visit count), not in the battle seed.
        const cell = CELLS.find((c) => c.id === 'wild:biome1')!;
        const rosters = Array.from({ length: 8 }, (_, i) =>
            sampleFight(cell, i).setup.enemies.map((e) => `${e.definitionId}:${e.hpIV}`).join('+'));
        expect(new Set(rosters).size).toBeGreaterThan(1);
    });
});

describe('run gate — the banding', () => {
    it('holds ticket 61\'s three ruled targets', () => {
        expect(RUN_GATE_TARGETS).toEqual({ wild: 0.95, elite: 0.75, gauntlet: 0.60 });
    });

    it('passes exactly on the edge of the +-5 window and fails just outside it', () => {
        expect(bandVerdict(0.90, 0.95)).toBe(true);
        expect(bandVerdict(1.00, 0.95)).toBe(true);
        expect(bandVerdict(0.899, 0.95)).toBe(false);
        expect(bandVerdict(0.70, 0.75)).toBe(true);
        expect(bandVerdict(0.649, 0.75)).toBe(false);
    });

    it('reports an interval that stays inside [0,1] at a clean sweep', () => {
        // Why Wilson and not the normal approximation: at p=1 the textbook interval has zero width
        // and claims certainty from a handful of games, and near p=0.95 it runs past 1.0.
        const sweep = wilson(6, 6);
        expect(sweep.high).toBeLessThanOrEqual(1);
        expect(sweep.low).toBeGreaterThan(0);
        expect(sweep.low).toBeLessThan(1);

        const wipeout = wilson(0, 6);
        expect(wipeout.low).toBe(0);
        expect(wipeout.high).toBeLessThan(1);

        // And it narrows with sample, which is the property the printed row is there to show.
        expect(wilson(95, 100).high - wilson(95, 100).low)
            .toBeLessThan(wilson(19, 20).high - wilson(19, 20).low);
    });
});
