/**
 * TICKET 170c — WHERE THE WALKER DIES: the pure half.
 *
 * `deathDigest` reduces one walk to the facts a death report needs; `summariseDeaths` folds a list
 * of digests into counts and means; `formatDeathReport` prints them as markdown tables. No walking,
 * no clock, no randomness, so it is unit-tested on hand-made walks and the slow half
 * (`walkerDeaths.balance.ts`) only has to feed it. This is a REPORT: nothing here changes how the
 * walker plays.
 *
 * # THE BUCKETS
 *
 * A walk ends in exactly one of four ways, and a report that mixed them would be unreadable:
 *
 * - `cleared`: it won the gym. It contributes to no death count.
 * - `gauntlet`: it reached the gym and lost one of the three gauntlet fights. This is its own bucket,
 *   not a "death by fight 9": a walk that got there did everything the map asked of it.
 * - `before-gym`: it lost a fight on the way (wild, rival or elite). THE DEATH COUNT BY FIGHTS WON
 *   IS OVER THESE ONLY.
 * - `stalled`: it ended without losing a fight and without clearing (no node left to step to, or
 *   the step budget). A finding in itself, so it is counted, never folded into a death.
 *
 * # WHAT "HP AT THE START" MEANS HERE
 *
 * The run full-heals between nodes, so a fight outside the gym starts at full HP and that is
 * reported as 1. Inside the gauntlet the party carries HP, so a gauntlet fight after the first
 * starts at the mean HP fraction the previous gauntlet fight ended on (BEFORE the game's 30%
 * repair, which this digest does not model). The first gauntlet fight starts full.
 */

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { isJunkCard } from '../../engine/run/junk';
import type { WalkResult } from './runWalker';

export type DeathBucket = 'cleared' | 'gauntlet' | 'before-gym' | 'stalled';

/** The part of a `WalkResult` the digest reads, so a test can hand-make one. */
export type DeathInput = Pick<
    WalkResult,
    'seed' | 'starter' | 'outcome' | 'fights' | 'finalDeck' | 'scrapAtEnd' | 'recruits' | 'benchesMissed'
    | 'patchShelvesSeen' | 'patches' | 'upgraded' | 'log'
> & { readonly leftovers?: WalkResult['leftovers'] };

export interface KillerFight {
    /** `wild`, `rival`, `elite` or `gym`. */
    readonly kind: string;
    readonly biome: number;
    /** 1-based, among the gauntlet's three, or 0 outside the gym. */
    readonly gauntletIndex: number;
    readonly enemySpecies: ReadonlyArray<string>;
    /** Each enemy's primary element, one entry per enemy (not de-duplicated). `unknown` for an id the registry lacks. */
    readonly enemyElements: ReadonlyArray<string>;
    readonly turns: number;
    /** Mean party HP fraction as the fight began: 1 outside the gauntlet's later fights (see the file header). */
    readonly partyHpAtStart: number;
}

export interface DeathDigest {
    readonly starter: string;
    readonly seed: string;
    readonly bucket: DeathBucket;
    /** Fights won over the whole walk, gauntlet included. */
    readonly fightsWon: number;
    readonly killer: KillerFight | null;
    readonly deckSize: number;
    readonly deckPower: number | null;
    /** Forge Slag (junk) cards in the final deck. */
    readonly junkCards: number;
    readonly scrapAtEnd: number;
    /** Party size at the end: the starter plus every recruit. */
    readonly partySize: number;
    readonly blueprintsHeld: number;
    readonly benchesMissed: number;
    readonly upgradesBought: number;
    readonly patchShelvesSeen: number;
    readonly shopPatches: number;
}

const mean = (values: ReadonlyArray<number>): number =>
    values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

const elementOf = (species: string): string => {
    try {
        return GetMingmingData(species).primaryElement ?? 'unknown';
    } catch {
        return 'unknown';
    }
};

/** The enemies of fight `index` (1-based), read off its `FIGHT_DECK` row. */
function enemiesOfFight(log: DeathInput['log'], index: number): string[] {
    for (const event of log.events) {
        if (event.kind === 'FIGHT_DECK' && event.fightIndex === index) return event.enemies.map((e) => e.species);
    }
    return [];
}

export function deathDigest(result: DeathInput): DeathDigest {
    const fights = result.fights;
    const gymFights = fights.filter((f) => f.kind === 'gym');
    const last = fights[fights.length - 1];

    let bucket: DeathBucket;
    if (result.outcome === 'victory') bucket = 'cleared';
    else if (last && !last.won) bucket = gymFights.length > 0 ? 'gauntlet' : 'before-gym';
    else bucket = 'stalled';

    let killer: KillerFight | null = null;
    if (bucket === 'gauntlet' || bucket === 'before-gym') {
        const enemySpecies = enemiesOfFight(result.log, last.index);
        const gauntletIndex = last.kind === 'gym' ? gymFights.length : 0;
        const previous = gauntletIndex > 1 ? fights[fights.length - 2] : undefined;
        killer = {
            kind: last.kind,
            biome: last.biome,
            gauntletIndex,
            enemySpecies,
            enemyElements: enemySpecies.map(elementOf),
            turns: last.turns,
            partyHpAtStart: previous ? mean(previous.survivors.map((s) => s.hpFraction)) : 1,
        };
    }

    return {
        starter: result.starter,
        seed: result.seed,
        bucket,
        fightsWon: fights.filter((f) => f.won).length,
        killer,
        deckSize: result.finalDeck.length,
        deckPower: last ? last.deckPower : null,
        junkCards: result.finalDeck.filter((id) => isJunkCard(id)).length,
        scrapAtEnd: result.scrapAtEnd,
        partySize: 1 + result.recruits.length,
        blueprintsHeld: result.leftovers?.blueprintsHeld ?? 0,
        benchesMissed: result.benchesMissed,
        upgradesBought: result.upgraded.length,
        patchShelvesSeen: result.patchShelvesSeen,
        shopPatches: result.patches.filter((p) => p.from === 'shop').length,
    };
}

// ---------------------------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------------------------

/** Scrap thresholds for "died holding scrap it could have spent": a junk removal, and a whole starting purse. */
export const SCRAP_FLOORS = [25, 45] as const;

export interface DeathSummary {
    readonly walks: number;
    readonly cleared: number;
    readonly stalled: number;
    readonly diedBeforeGym: number;
    readonly diedInGauntlet: number;
    /** Walks that died before the gym, by fights won: `[0, n0], [1, n1], ...`, with the gaps filled in. */
    readonly fightsWonBeforeDying: ReadonlyArray<{ readonly fightsWon: number; readonly walks: number }>;
    /** Which node kind killed the walk, over every death (gauntlet deaths count as `gym`). */
    readonly killerKinds: Readonly<Record<string, number>>;
    /** Gauntlet deaths at the first, second and third gauntlet fight. */
    readonly gauntletDeaths: readonly [number, number, number];
    readonly killers: {
        readonly meanTurns: number;
        readonly meanPartyHpAtStart: number;
        readonly byBiome: Readonly<Record<number, number>>;
        /** Enemy primary elements across the killing fights, counted once per fight per element. */
        readonly byElement: Readonly<Record<string, number>>;
    };
    /** The state of the walk at its end, over every walk that died (before the gym or in it). */
    readonly atDeath: {
        readonly meanDeckSize: number;
        readonly meanDeckPower: number | null;
        readonly meanJunkCards: number;
        readonly meanScrap: number;
        readonly medianScrap: number;
        /** Percent of deaths holding at least each of `SCRAP_FLOORS`. */
        readonly pctScrapAtLeast: ReadonlyArray<{ readonly floor: number; readonly pct: number }>;
        readonly meanPartySize: number;
        readonly meanBlueprintsHeld: number;
        readonly pctHoldingBlueprint: number;
        readonly meanBenchesMissed: number;
        readonly meanUpgradesBought: number;
        readonly meanPatchShelvesSeen: number;
        readonly meanShopPatches: number;
    };
}

const median = (values: ReadonlyArray<number>): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const pctOf = (count: number, of: number): number => (of === 0 ? 0 : (100 * count) / of);

const tally = <K extends string | number>(keys: ReadonlyArray<K>): Record<K, number> => {
    const out = {} as Record<K, number>;
    for (const key of keys) out[key] = (out[key] ?? 0) + 1;
    return out;
};

export function summariseDeaths(digests: ReadonlyArray<DeathDigest>): DeathSummary {
    const before = digests.filter((d) => d.bucket === 'before-gym');
    const gauntlet = digests.filter((d) => d.bucket === 'gauntlet');
    const dead = [...before, ...gauntlet];
    const killerFights = dead.map((d) => d.killer).filter((k): k is KillerFight => k !== null);

    const byFights = tally(before.map((d) => d.fightsWon));
    const longest = before.reduce((n, d) => Math.max(n, d.fightsWon), 0);
    const fightsWonBeforeDying = before.length === 0
        ? []
        : Array.from({ length: longest + 1 }, (_, fightsWon) => ({ fightsWon, walks: byFights[fightsWon] ?? 0 }));

    const gauntletAt = (index: number): number => killerFights.filter((k) => k.gauntletIndex === index).length;
    const powers = dead.map((d) => d.deckPower).filter((p): p is number => p !== null);

    return {
        walks: digests.length,
        cleared: digests.filter((d) => d.bucket === 'cleared').length,
        stalled: digests.filter((d) => d.bucket === 'stalled').length,
        diedBeforeGym: before.length,
        diedInGauntlet: gauntlet.length,
        fightsWonBeforeDying,
        killerKinds: tally(killerFights.map((k) => k.kind)),
        gauntletDeaths: [gauntletAt(1), gauntletAt(2), gauntletAt(3)],
        killers: {
            meanTurns: mean(killerFights.map((k) => k.turns)),
            meanPartyHpAtStart: mean(killerFights.map((k) => k.partyHpAtStart)),
            byBiome: tally(killerFights.map((k) => k.biome)),
            byElement: tally(killerFights.flatMap((k) => [...new Set(k.enemyElements)])),
        },
        atDeath: {
            meanDeckSize: mean(dead.map((d) => d.deckSize)),
            meanDeckPower: powers.length === 0 ? null : mean(powers),
            meanJunkCards: mean(dead.map((d) => d.junkCards)),
            meanScrap: mean(dead.map((d) => d.scrapAtEnd)),
            medianScrap: median(dead.map((d) => d.scrapAtEnd)),
            pctScrapAtLeast: SCRAP_FLOORS.map((floor) => ({ floor, pct: pctOf(dead.filter((d) => d.scrapAtEnd >= floor).length, dead.length) })),
            meanPartySize: mean(dead.map((d) => d.partySize)),
            meanBlueprintsHeld: mean(dead.map((d) => d.blueprintsHeld)),
            pctHoldingBlueprint: pctOf(dead.filter((d) => d.blueprintsHeld > 0).length, dead.length),
            meanBenchesMissed: mean(dead.map((d) => d.benchesMissed)),
            meanUpgradesBought: mean(dead.map((d) => d.upgradesBought)),
            meanPatchShelvesSeen: mean(dead.map((d) => d.patchShelvesSeen)),
            meanShopPatches: mean(dead.map((d) => d.shopPatches)),
        },
    };
}

/** One summary per starter, in the order the starters first appear. */
export function summariseByStarter(digests: ReadonlyArray<DeathDigest>): Array<{ starter: string; summary: DeathSummary }> {
    const order: string[] = [];
    for (const d of digests) if (!order.includes(d.starter)) order.push(d.starter);
    return order.map((starter) => ({ starter, summary: summariseDeaths(digests.filter((d) => d.starter === starter)) }));
}

// ---------------------------------------------------------------------------------------------
// The print
// ---------------------------------------------------------------------------------------------

const num = (value: number | null, digits = 1): string => (value === null || !Number.isFinite(value) ? '-' : value.toFixed(digits));
const pct = (value: number): string => `${num(value, 1)}%`;
const render = (cells: ReadonlyArray<string>): string => `| ${cells.join(' | ')} |`;
const table = (head: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>): string =>
    [render(head), render(head.map(() => '---')), ...rows.map(render)].join('\n');
const countsLine = (counts: Readonly<Record<string | number, number>>): string => {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return entries.length === 0 ? '-' : entries.map(([key, n]) => `${key} ${n}`).join(', ');
};

/** The whole report as markdown tables: the overall summary, then one row per starter. */
export function formatDeathReport(digests: ReadonlyArray<DeathDigest>): string {
    const all = summariseDeaths(digests);
    const bucketRows = [
        ['Cleared the gym', String(all.cleared)],
        ['Died in the gauntlet', String(all.diedInGauntlet)],
        ['Died on the way to the gym', String(all.diedBeforeGym)],
        ['Ended without dying or clearing', String(all.stalled)],
    ];
    const lines = [
        table(['How the walk ended', 'Walks'], bucketRows),
        '',
        'Died on the way to the gym, by fights won first:',
        '',
        all.fightsWonBeforeDying.length === 0
            ? '(none)'
            : table(['Fights won', ...all.fightsWonBeforeDying.map((row) => String(row.fightsWon))], [['Walks', ...all.fightsWonBeforeDying.map((row) => String(row.walks))]]),
        '',
        `Node kind that killed the walk: ${countsLine(all.killerKinds)}. Gauntlet deaths at fight 1, 2, 3: ${all.gauntletDeaths.join(', ')}.`,
        '',
        table(['The killing fight', 'Value'], [
            ['Mean turns', num(all.killers.meanTurns)],
            ['Mean party HP fraction at the start', num(all.killers.meanPartyHpAtStart, 2)],
            ['By biome', countsLine(all.killers.byBiome)],
            ['Enemy element (a fight counts once per element)', countsLine(all.killers.byElement)],
        ]),
        '',
        table(['The walk at death', 'Value'], [
            ['Mean deck size', num(all.atDeath.meanDeckSize)],
            ['Mean deck power (the walker\'s own score)', num(all.atDeath.meanDeckPower)],
            ['Mean junk (Forge Slag) cards', num(all.atDeath.meanJunkCards, 2)],
            ['Scrap unspent, mean / median', `${num(all.atDeath.meanScrap)} / ${num(all.atDeath.medianScrap)}`],
            ...all.atDeath.pctScrapAtLeast.map((row) => [`Died holding at least ${row.floor} scrap`, pct(row.pct)] as const),
            ['Mean party size', num(all.atDeath.meanPartySize, 2)],
            ['Died holding a blueprint it never used', pct(all.atDeath.pctHoldingBlueprint)],
            ['Upgrade benches walked past, mean', num(all.atDeath.meanBenchesMissed, 2)],
            ['Upgrades bought, mean', num(all.atDeath.meanUpgradesBought, 2)],
            ['Patch shelves seen / shop patches taken, mean', `${num(all.atDeath.meanPatchShelvesSeen, 2)} / ${num(all.atDeath.meanShopPatches, 2)}`],
        ]),
        '',
        'By starter:',
        '',
        table(
            ['Starter', 'Walks', 'Cleared', 'Died in gauntlet', 'Died before gym', 'Mean fights won (before-gym deaths)', 'Killer kinds'],
            summariseByStarter(digests).map(({ starter, summary }) => {
                const wonBefore = summary.fightsWonBeforeDying.reduce((n, row) => n + row.fightsWon * row.walks, 0);
                return [
                    starter, String(summary.walks), String(summary.cleared), String(summary.diedInGauntlet), String(summary.diedBeforeGym),
                    summary.diedBeforeGym === 0 ? '-' : num(wonBefore / summary.diedBeforeGym, 2), countsLine(summary.killerKinds),
                ];
            }),
        ),
    ];
    return lines.join('\n');
}
