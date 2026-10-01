/**
 * Before and after, as markdown tables — ticket 174d.
 *
 * Pure formatting over two `ScrapCurveWalkSummary` values. The tables only: the reading of them is
 * prose, written by whoever ran the walks, in `docs/balance/scrap-curve-174.md`.
 */

import type { BiomeScrapMeans, ScrapCurveWalkSummary, WinRate } from './scrapCurveWalk';

const one = (n: number): string => n.toFixed(1);
const signed = (n: number): string => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const rate = (r: WinRate): string => (r.played === 0 ? '-' : `${((100 * r.wins) / r.played).toFixed(1)}% (${r.wins}/${r.played})`);

function row(label: string, before: number, after: number): string {
    return `| ${label} | ${one(before)} | ${one(after)} | ${signed(after - before)} |`;
}

/** The per-biome means, before and after, one table per biome both arms reached. */
export function formatBiomeComparison(before: ScrapCurveWalkSummary, after: ScrapCurveWalkSummary): string {
    const blocks: string[] = [];
    const ids = new Set([...before.biomes, ...after.biomes].map((b) => b.biome));
    for (const id of [...ids].sort((a, b) => a - b)) {
        const b = before.biomes.find((x) => x.biome === id);
        const a = after.biomes.find((x) => x.biome === id);
        const zero: BiomeScrapMeans = {
            biome: id, reached: 0, fights: 0, income: {}, spent: {}, incomeTotal: 0, spentTotal: 0,
            lowPoint: 0, scrapAtEnd: 0, revisits: 0,
        };
        const x = b ?? zero;
        const y = a ?? zero;
        blocks.push([
            `### Biome ${id} (reached: before ${x.reached} of ${before.runs} walks, after ${y.reached} of ${after.runs})`,
            '',
            '| mean per run | before | after | change |',
            '|---|---|---|---|',
            row('fights', x.fights, y.fights),
            row('revisits', x.revisits, y.revisits),
            row('income', x.incomeTotal, y.incomeTotal),
            row('spent', x.spentTotal, y.spentTotal),
            row('low point (scrap)', x.lowPoint, y.lowPoint),
            row('scrap at biome end', x.scrapAtEnd, y.scrapAtEnd),
        ].join('\n'));
    }
    return blocks.join('\n\n');
}

/** Spend by reason per biome, before and after. */
export function formatSpendComparison(before: ScrapCurveWalkSummary, after: ScrapCurveWalkSummary): string {
    const lines = ['| biome | reason | before | after | change |', '|---|---|---|---|---|'];
    const ids = new Set([...before.biomes, ...after.biomes].map((b) => b.biome));
    for (const id of [...ids].sort((a, b) => a - b)) {
        const x = before.biomes.find((m) => m.biome === id)?.spent ?? {};
        const y = after.biomes.find((m) => m.biome === id)?.spent ?? {};
        const reasons = [...new Set([...Object.keys(x), ...Object.keys(y)])]
            .sort((p, q) => (y[q] ?? 0) + (x[q] ?? 0) - (y[p] ?? 0) - (x[p] ?? 0));
        for (const reason of reasons) lines.push(`| ${id} | ${reason} | ${one(x[reason] ?? 0)} | ${one(y[reason] ?? 0)} | ${signed((y[reason] ?? 0) - (x[reason] ?? 0))} |`);
    }
    return lines.join('\n');
}

/** Run shape and win rates. */
export function formatRunComparison(before: ScrapCurveWalkSummary, after: ScrapCurveWalkSummary): string {
    return [
        '| | before | after |',
        '|---|---|---|',
        `| walks | ${before.runs} | ${after.runs} |`,
        `| mean fights per run | ${one(before.meanFights)} | ${one(after.meanFights)} |`,
        `| mean upgrades bought per run | ${one(before.meanUpgrades)} | ${one(after.meanUpgrades)} |`,
        `| wild fights won | ${rate(before.wild)} | ${rate(after.wild)} |`,
        `| elite fights won | ${rate(before.elite)} | ${rate(after.elite)} |`,
        `| walks that reached the gym | ${before.reachedGym} (${((100 * before.reachedGym) / before.runs).toFixed(1)}%) | ${after.reachedGym} (${((100 * after.reachedGym) / after.runs).toFixed(1)}%) |`,
        `| walks that cleared the gym | ${before.gymClears} (${((100 * before.gymClears) / before.runs).toFixed(1)}%) | ${after.gymClears} (${((100 * after.gymClears) / after.runs).toFixed(1)}%) |`,
    ].join('\n');
}
