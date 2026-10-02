/**
 * `npx vite-node src/debug/balance/runCardPicksReport.ts <before.json> <after.json>` — ticket 179b.
 *
 * Reads the two files `runCardPicksWalk.ts` wrote and prints every table for
 * `docs/balance/card-picks-179.md`. The reading of the tables is prose, written by whoever ran them.
 */
import { readFileSync } from 'node:fs';

import { formatBiomeComparison, formatRunComparison, formatSpendComparison } from './scrapCurveWalkReport';
import { formatDeckSize, formatPickFlow, type CardPicksSummary } from './cardPicksWalk';
import type { ScrapCurveWalkSummary } from './scrapCurveWalk';

const [beforePath, afterPath] = process.argv.slice(2).filter((arg) => arg.endsWith('.json'));
if (!beforePath || !afterPath) {
    console.error('Usage: vite-node src/debug/balance/runCardPicksReport.ts <before.json> <after.json>');
    process.exit(1);
}

interface Loaded { readonly summary: ScrapCurveWalkSummary; readonly picks: CardPicksSummary }
const load = (path: string): Loaded => JSON.parse(readFileSync(path, 'utf8')) as Loaded;
const before = load(beforePath);
const after = load(afterPath);

console.log('## Cards per run\n');
console.log(formatPickFlow(before.picks, after.picks));
console.log('\n## Final deck size\n');
console.log(formatDeckSize(before.picks, after.picks));
console.log('\n## Run shape and win rates\n');
console.log(formatRunComparison(before.summary, after.summary));
console.log('\n## Per biome\n');
console.log(formatBiomeComparison(before.summary, after.summary));
console.log('\n## Spend by reason (mean scrap per run that reached the biome)\n');
console.log(formatSpendComparison(before.summary, after.summary));
