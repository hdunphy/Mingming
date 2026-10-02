/**
 * The scrap curve as a text table — ticket 174a.
 *
 * Pure formatting over `scrapCurve`'s rows, so the command-line reader, the walker's report and
 * any test print the same thing. No Node APIs in here: reading files is `runScrapCurve.ts`.
 */

import { scrapCurve, sumByReason, type BiomeScrapRow } from '../../engine/run/scrapCurve';
import type { IRunLog } from '../../engine/run/runLog';

/** `{ addRunScrap: 80, sellRunCard: 20 }` as `addRunScrap 80, sellRunCard 20`; `-` when empty. */
export function formatByReason(byReason: Readonly<Record<string, number>>): string {
    const parts = Object.entries(byReason)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, amount]) => `${reason} ${amount}`);
    return parts.length > 0 ? parts.join(', ') : '-';
}

/** One run's per-biome table, one block per biome so the reason lists have room. */
export function formatScrapCurve(rows: ReadonlyArray<BiomeScrapRow>): string {
    const lines: string[] = [];
    lines.push('biome  fights  income  spent  low  at end  revisits');
    for (const row of rows) {
        lines.push([
            String(row.biome).padEnd(5),
            String(row.fights).padStart(6),
            String(sumByReason(row.income)).padStart(7),
            String(sumByReason(row.spent)).padStart(6),
            String(row.lowPoint).padStart(4),
            String(row.scrapAtEnd).padStart(7),
            String(row.revisits).padStart(9),
        ].join('  '));
    }
    for (const row of rows) {
        lines.push(`  biome ${row.biome} income: ${formatByReason(row.income)}`);
        lines.push(`  biome ${row.biome} spent:  ${formatByReason(row.spent)}`);
    }
    return lines.join('\n');
}

/** The heading and table for every log with at least one fight, or a line saying there were none. */
export function formatScrapCurves(logs: ReadonlyArray<IRunLog>): string {
    const blocks: string[] = [];
    for (const log of logs) {
        const rows = scrapCurve(log);
        if (rows.length === 0) continue;
        blocks.push(`${log.runKey}\n${formatScrapCurve(rows)}`);
    }
    return blocks.length > 0 ? blocks.join('\n\n') : 'No run in this file has a fight in it.';
}
