import { describe, expect, it } from 'vitest';

import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { BOSS_IVS, GAUNTLET_ENEMY_COUNT, GAUNTLET_FIGHTS } from '../../engine/run/gauntlet';
import { ENEMY_LADDER, RUN_ENEMY_MODE } from '../../engine/run/encounter';
import { MingmingRegistry, getDeckForOS } from '../../engine/data/mingmingRegistry';
import { REGION_PARAMS } from '../../engine/run/regionGraph';
import { ElementalMatrix } from '../../engine/combatUtils';
import { minimumActiveDeck } from '../../engine/run/createRun';
import {
    CELLS,
    describeBossOverride,
    NO_FIRMWARE_OS,
    RUN_GATE_TARGETS,
    TUNED_OS_IDS,
    bandVerdict,
    lineupFor,
    sampleFight,
    wilson,
    type BossOverride,
    type SampledFight,
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

describe('the two arms — which player the gate is measuring (ticket 67, Henry 2026-08-26)', () => {
    const speciesOf = (osId: string): string => osId.replace(/_v\d+$/, '');
    const elementOf = (osId: string): string => MingmingRegistry[speciesOf(osId)].primaryElement;
    const beats = (attacker: string, defender: string): boolean =>
        ((ElementalMatrix as Record<string, Partial<Record<string, number>>>)[attacker]?.[defender] ?? 1) > 1;

    /** Every arm of every cell, sampled wide enough that a rule-shaped claim is testable. */
    const walk = (cellId: string, mode: 'blind' | 'favourable' | 'control', n = 40) => {
        const cell = CELLS.find((c) => c.id === cellId)!;
        const out: Array<{ mine: string[]; target: string }> = [];
        for (let i = 0; i < n; i += 1) {
            try {
                const fight = sampleFight(cell, i, mode);
                out.push({ mine: fight.lineup.map(elementOf), target: fight.targetElement });
            } catch { /* a graph with no node of this kind — `measureCell` re-rolls these too */ }
        }
        expect(out.length).toBeGreaterThan(n / 2);
        return out;
    };

    it('PREPARED brings the counter every time, and brings nobody the enemy eats', () => {
        /*
         * The arm the 95/75/60 targets grade. Henry: *"the other number is player with matchup adv."*
         *
         * Both halves are asserted, and the second is the one a careless implementation would drop:
         * a team that counters the target but drags along a member the target is strong against has
         * handed back most of what it bought. With the EA six there is a neutral filler available
         * (the target's own element), so a prepared player has no reason to take the bad third slot.
         */
        for (const cellId of ['wild:biome1', 'elite:biome0', 'gauntlet:fight2']) {
            for (const { mine, target } of walk(cellId, 'favourable')) {
                expect(mine.some((e) => beats(e, target))).toBe(true);
                expect(mine.some((e) => beats(target, e))).toBe(false);
            }
        }
    });

    it('CONTROL is exactly neutral wherever the roster allows it to be', () => {
        // Party sizes 1 and 2 can field a same-element team, so the control is 1.0x in both
        // directions — no advantage either way, on any sample.
        for (const cellId of ['elite:biome0', 'wild:biome1']) {
            for (const { mine, target } of walk(cellId, 'control')) {
                expect(mine.some((e) => beats(e, target))).toBe(false);
                expect(mine.some((e) => beats(target, e))).toBe(false);
            }
        }
    });

    it('CONTROL averages neutral at party size 3, where exact neutrality is impossible', () => {
        /*
         * There is no element neutral against Fire, Water or Nature except itself, and there are two
         * species per element — so a three-member same-element team cannot exist and the third slot
         * MUST carry a matchup. The arm alternates which way it leans by sample index, so the two
         * biases cancel across the sample instead of tilting it.
         *
         * Asserted as a balance rather than as an absence, because "no advantage on any sample" is
         * unachievable here and a test claiming it would be a test of the wrong thing.
         */
        const samples = walk('gauntlet:fight2', 'control', 40);
        const forMe = samples.filter(({ mine, target }) => mine.some((e) => beats(e, target))).length;
        const forThem = samples.filter(({ mine, target }) => mine.some((e) => beats(target, e))).length;
        expect(forMe).toBe(forThem);
        // And the third slot really is leaning — a control that quietly went neutral would mean the
        // alternation stopped working and the arm had become something else.
        expect(forMe).toBeGreaterThan(0);
    });

    it('BLIND is untouched, so every number taken before the ruling still reproduces', () => {
        // The default. `measureCell` passes 'blind' when no mode is given, and the lineup must be
        // byte-identical to the original stride — otherwise the pre-ruling bands in ticket 67 stop
        // being comparable to anything measured after it.
        const cell = CELLS.find((c) => c.id === 'wild:biome2')!;
        for (let i = 0; i < 12; i += 1) {
            expect(sampleFight(cell, i, 'blind').lineup).toEqual(lineupFor(i, cell.partySize));
            expect(sampleFight(cell, i).lineup).toEqual(lineupFor(i, cell.partySize));
        }
    });

    it('aims the gauntlet at the GYM’s own element, not biome 0’s', () => {
        /*
         * The boss team is one species per biome in biome order, so its champion — the member the
         * fight is named after — is the biome-2 one, and `offerGyms` rule 4 puts the gym's own
         * element there. Countering the champion is what *"come into the grass boss with
         * firestarters"* means. Aiming at biome 0 instead would counter the weakest member of the
         * three and report it as a prepared player.
         */
        const cell = CELLS.find((c) => c.id === 'gauntlet:fight2')!;
        for (let i = 0; i < 12; i += 1) {
            const fight = sampleFight(cell, i, 'favourable');
            expect(fight.targetElement).toBe(fight.biomeElements[fight.biomeElements.length - 1]);
        }
    });

    it('keeps both arms a SAMPLE of decks rather than a fixture', () => {
        // The prepared arm rotates through every firmware of the counter element. Without that, a
        // 60-battle boss run would field the same two decks sixty times and report one matchup's
        // quality rather than the counter-element's.
        const cell = CELLS.find((c) => c.id === 'gauntlet:fight2')!;
        const seen = new Set<string>();
        for (let i = 0; i < 40; i += 1) for (const os of sampleFight(cell, i, 'favourable').lineup) seen.add(os);
        expect(seen.size).toBe(TUNED_OS_IDS.length);
    });
});

describe('the boss isolation overrides (ticket 67, rulings round 3)', () => {
    const boss = () => CELLS.find((c) => c.id === 'gauntlet:fight2')!;
    const decksOf = (fight: SampledFight): string =>
        fight.setup.enemies.flatMap((e) => e.deck ?? []).join(',');

    /*
     * TICKET 68 MADE THE BOSS CELL HETEROGENEOUS, AND THESE TESTS HAVE TO SAY WHICH KIND THEY MEAN.
     *
     * `sampleFight` picks the gym offer as `index % 3`, so the `gauntlet:fight2` cell walks all
     * three leaders. Emberfall is authored now — real firmware, one side-level Driver — while
     * Tidewrack and Rootfall still field ticket 18's `boss_relic_*` formula boss (ruling 6). A
     * sample index hardcoded to 3 was fine when every gym had the same shape; it is now a coin flip
     * on which shape you get, decided by a seeded shuffle.
     *
     * So the indices are FOUND rather than written down, and the two shapes are asserted separately.
     */
    const at = (index: number, override?: BossOverride): SampledFight =>
        sampleFight(boss(), index, 'favourable', override);
    const INDICES = [0, 1, 2, 3, 4, 5];
    const relicIndex = INDICES.find((i) => at(i).enemyDrivers.length === 0)!;
    const driverIndex = INDICES.find((i) => at(i).enemyDrivers.length > 0)!;

    it('changes ONLY the named knob — the deck, the player and the seed are the baseline\'s', () => {
        /*
         * The whole value of an isolation arm is that it is comparable to the 0/60 it is measured
         * against. If the override moved the enemy roll, the deck or the player's side as well, the
         * difference between the two numbers would be uninterpretable — which is the failure mode
         * that makes this test worth more than the flags themselves.
         *
         * Asserted per arm, because the two overrides reach different fields and a shared assertion
         * would pass while one of them quietly did nothing.
         */
        const base = at(relicIndex);
        const lowered = at(relicIndex, { ivs: { hp: 10, attack: 10, defense: 10 } });
        const stripped = at(relicIndex, { relics: 'off' });

        for (const arm of [lowered, stripped]) {
            expect(decksOf(arm)).toBe(decksOf(base));
            expect(arm.setup.player).toEqual(base.setup.player);
            expect(arm.setup.seed).toBe(base.setup.seed);
            expect(arm.setup.enemies.map((e) => e.definitionId)).toEqual(base.setup.enemies.map((e) => e.definitionId));
        }
    });

    it('ARM A lowers every boss slot\'s stats and leaves the relics on', () => {
        const arm = at(relicIndex, { ivs: { hp: 10, attack: 10, defense: 10 } });
        for (const enemy of arm.setup.enemies) {
            expect({ hp: enemy.hpIV, attack: enemy.attackIV, defense: enemy.defenseIV })
                .toEqual({ hp: 10, attack: 10, defense: 10 });
            expect(enemy.activeOS!.startsWith('boss_relic')).toBe(true);
        }
    });

    it('ARM B strips the relic hooks for a REAL firmware, not for nothing', () => {
        /*
         * `relics: 'off'` swaps the `boss_relic_*` id for the species' own `availableOS[0]`. Two
         * things have to be true for that to be an isolation rather than a second change:
         *
         * 1. the replacement must RESOLVE — a firmware the registry does not know would silently
         *    field an enemy running no hooks at all, which is a different experiment;
         * 2. the deck must not move — and it does not, because `getDeckForOS` already falls back to
         *    `availableOS[0]`'s tuned list for a boss (`gauntlet.buildEnemy` documents this), so the
         *    boss was fighting with that deck all along.
         */
        const base = at(relicIndex);
        const arm = at(relicIndex, { relics: 'off' });

        for (const enemy of arm.setup.enemies) {
            expect(enemy.activeOS!.startsWith('boss_relic')).toBe(false);
            expect(getOSBehavior(enemy.activeOS!)).toBeDefined();
            // Stats untouched: this arm is about the relics and nothing else.
            expect(enemy.hpIV).toBe(20);
        }
        expect(base.setup.enemies.every((e) => e.activeOS!.startsWith('boss_relic'))).toBe(true);
    });

    it('touches no fight that is not a boss fight', () => {
        // `BOSS_IVS` has no meaning outside one, and the gauntlet's first two fights are elites
        // carrying no relic — an override that reached them would be measuring a different ladder.
        for (const id of ['gauntlet:fight0', 'gauntlet:fight1', 'elite:biome0', 'wild:biome1']) {
            const cell = CELLS.find((c) => c.id === id)!;
            const plain = sampleFight(cell, 3, 'favourable');
            const overridden = sampleFight(cell, 3, 'favourable', {
                ivs: { hp: 10, attack: 10, defense: 10 }, relics: 'off',
            });
            expect(overridden.setup.enemies).toEqual(plain.setup.enemies);
        }
    });

    it('is absent by default, so the shipped boss is what an unflagged run measures', () => {
        // Ruling R2 leaves BOSS_IVS open as a lever and ticket 68 left it untouched, so the authored
        // constants must not move while the question is being measured. Asserted for BOTH boss
        // shapes: every sample carries a signature, whichever system provides it.
        for (const index of [relicIndex, driverIndex]) {
            const plain = at(index);
            expect(plain.bossOverride).toBeUndefined();
            for (const enemy of plain.setup.enemies) {
                expect(enemy.hpIV).toBe(BOSS_IVS[0].hp);
            }
            const relics = plain.setup.enemies.every((e) => e.activeOS!.startsWith('boss_relic'));
            expect(relics || plain.enemyDrivers.length > 0).toBe(true);
        }
    });

    it('ARM B strips an AUTHORED boss’s Driver too — the flag follows the passive (ticket 68)', () => {
        /*
         * `--boss-relics off` asks one question: *what is the anti-boss card pool being asked to
         * beat?* Ticket 68 moved where an authored gym keeps the answer — from a `boss_relic_*`
         * worn as `activeOS` to a side-level Driver — so a flag still pointed only at the old
         * mechanism would silently measure the boss WITH its signature and report it as without.
         * That is the failure this test exists for; the §12 arms were read off this flag.
         */
        const base = at(driverIndex);
        const stripped = at(driverIndex, { relics: 'off' });

        expect(base.enemyDrivers.length).toBeGreaterThan(0);
        expect(stripped.enemyDrivers).toEqual([]);
        expect(stripped.setup.enemyDrivers).toBeUndefined();
        // And nothing else moves — same species, same deck, same seed, same stats.
        expect(decksOf(stripped)).toBe(decksOf(base));
        expect(stripped.setup.seed).toBe(base.setup.seed);
        expect(stripped.setup.enemies.map((e) => e.hpIV)).toEqual(base.setup.enemies.map((e) => e.hpIV));
    });

    it('carries the Driver into the measured setup, so the harness fights the shipped boss', () => {
        const plain = at(driverIndex);
        expect(plain.setup.enemyDrivers).toEqual(plain.enemyDrivers);
    });

    it('names the arm in one line, so a pasted number cannot lose its provenance', () => {
        expect(describeBossOverride(undefined)).toBe('boss as shipped');
        expect(describeBossOverride({})).toBe('boss as shipped');
        expect(describeBossOverride({ ivs: { hp: 10, attack: 10, defense: 10 } })).toContain('10/10/10');
        expect(describeBossOverride({ relics: 'off' })).toContain('signature passive OFF');
    });
});
