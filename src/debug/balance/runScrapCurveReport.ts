/**
 * `npm run balance:scrap-report -- <before.json> <after.json>` — ticket 174d.
 *
 * The entry point: reads the two summaries `runScrapCurveWalk.ts` wrote and prints the comparison
 * tables for `docs/balance/scrap-curve-174.md`.
 */
import { readFileSync } from 'node:fs';

import { formatBiomeComparison, formatRunComparison, formatSpendComparison } from './scrapCurveWalkReport';
import type { ScrapCurveWalkSummary } from './scrapCurveWalk';

const [beforePath, afterPath] = process.argv.slice(2).filter((arg) => arg.endsWith('.json'));
if (!beforePath || !afterPath) {
    console.error('Usage: npm run balance:scrap-report -- <before.json> <after.json>');
    process.exit(1);
}

const load = (path: string): ScrapCurveWalkSummary =>
    (JSON.parse(readFileSync(path, 'utf8')) as { summary: ScrapCurveWalkSummary }).summary;
const before = load(beforePath);
const after = load(afterPath);

console.log('## Run shape and win rates\n');
console.log(formatRunComparison(before, after));
console.log('\n## Per biome\n');
console.log(formatBiomeComparison(before, after));
console.log('\n## Spend by reason (mean scrap per run that reached the biome)\n');
console.log(formatSpendComparison(before, after));
