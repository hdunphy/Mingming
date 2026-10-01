/**
 * The walker's scrap curve, pooled — ticket 174d.
 *
 * `scrapCurve` reads one run log; this folds the logs of many walks into one per-biome row (means
 * over the runs that REACHED that biome) plus the three win rates 174 asked for, so a before/after
 * pair of walks can be laid side by side. Pure: no Node APIs, no walking. `runScrapCurveWalk.ts`
 * does the walking and `scrapCurveWalkReport.ts` prints the pair.
 *
 * # WHAT A MEAN OVER "RUNS THAT REACHED IT" MEANS
 *
 * A walker that dies in biome 1 has no biome 2 row, and counting it as a zero would drag biome 2's
 * scrap and fights down for a reason that is about dying, not about the economy. So each biome's
 * mean is over the runs that got there, and `reached` says how many that was. Read a biome with a
 * small `reached` as a small sample.
 */

import { scrapCurve, sumByReason, type BiomeScrapRow } from '../../engine/run/scrapCurve';
import type { WalkResult } from './runWalker';

export interface BiomeScrapMeans {
    readonly biome: number;
    /** How many walks reached this biome: the sample size of every mean below. */
    readonly reached: number;
    readonly fights: number;
    readonly income: Readonly<Record<string, number>>;
    readonly spent: Readonly<Record<string, number>>;
    readonly incomeTotal: number;
    readonly spentTotal: number;
    readonly lowPoint: number;
    readonly scrapAtEnd: number;
    readonly revisits: number;
}

export interface WinRate {
    readonly wins: number;
    readonly played: number;
}

export interface ScrapCurveWalkSummary {
    readonly runs: number;
    readonly meanFights: number;
    readonly meanUpgrades: number;
    readonly biomes: ReadonlyArray<BiomeScrapMeans>;
    readonly wild: WinRate;
    readonly elite: WinRate;
    /** Walks that played at least one gauntlet fight. */
    readonly reachedGym: number;
    /** Walks that cleared the gauntlet. */
    readonly gymClears: number;
}

const BIOME_COUNT = 3;

function meanOf(values: ReadonlyArray<number>): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** The mean of each reason's amount across `records`, a reason missing from a record counting as 0. */
function meanByReason(records: ReadonlyArray<Readonly<Record<string, number>>>): Record<string, number> {
    const out: Record<string, number> = {};
    const reasons = new Set(records.flatMap((record) => Object.keys(record)));
    for (const reason of reasons) out[reason] = meanOf(records.map((record) => record[reason] ?? 0));
    return out;
}

function winRate(results: ReadonlyArray<WalkResult>, kind: string): WinRate {
    let wins = 0;
    let played = 0;
    for (const result of results) {
        for (const fight of result.fights) {
            if (fight.kind !== kind) continue;
            played += 1;
            if (fight.won) wins += 1;
        }
    }
    return { wins, played };
}

export function summariseScrapCurves(results: ReadonlyArray<WalkResult>): ScrapCurveWalkSummary {
    const curves = results.map((result) => scrapCurve(result.log));
    const biomes: BiomeScrapMeans[] = [];
    for (let biome = 0; biome < BIOME_COUNT; biome += 1) {
        const rows = curves.map((curve) => curve.find((row) => row.biome === biome)).filter((row): row is BiomeScrapRow => row !== undefined);
        if (rows.length === 0) continue;
        biomes.push({
            biome,
            reached: rows.length,
            fights: meanOf(rows.map((row) => row.fights)),
            income: meanByReason(rows.map((row) => row.income)),
            spent: meanByReason(rows.map((row) => row.spent)),
            incomeTotal: meanOf(rows.map((row) => sumByReason(row.income))),
            spentTotal: meanOf(rows.map((row) => sumByReason(row.spent))),
            lowPoint: meanOf(rows.map((row) => row.lowPoint)),
            scrapAtEnd: meanOf(rows.map((row) => row.scrapAtEnd)),
            revisits: meanOf(rows.map((row) => row.revisits)),
        });
    }
    return {
        runs: results.length,
        meanFights: meanOf(results.map((result) => result.fights.length)),
        meanUpgrades: meanOf(results.map((result) => result.upgraded.length)),
        biomes,
        wild: winRate(results, 'wild'),
        elite: winRate(results, 'elite'),
        reachedGym: results.filter((result) => result.fights.some((fight) => fight.kind === 'gym')).length,
        gymClears: results.filter((result) => result.outcome === 'victory').length,
    };
}
