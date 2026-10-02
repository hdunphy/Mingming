/**
 * `npx vite-node src/debug/balance/runCardPicksWalk.ts --arm before --seeds 30 --out /tmp/before.json`
 * — ticket 179b.
 *
 * Exactly `runScrapCurveWalk.ts` (same starters, same `scrap174:<starter>:<i>` seeds, upgrade policy
 * ON), plus the card-pick summary `cardPicksWalk.ts` pools from the same walks. Kept as its own entry
 * so the 174 script and its output are untouched. Run once per arm; the seeds are paired.
 * `runCardPicksReport.ts` prints the comparison.
 */
import { writeFileSync } from 'node:fs';

import { eaStarters, walkStarter, type WalkResult } from './runWalker';
import { summariseScrapCurves } from './scrapCurveWalk';
import { summariseCardPicks } from './cardPicksWalk';

const args = process.argv.slice(2);
const read = (flag: string, fallback: string): string => {
    const at = args.indexOf(flag);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const arm = read('--arm', 'arm');
const seeds = Number(read('--seeds', '30'));
const out = read('--out', `card-picks-walk-${arm}.json`);

const results: WalkResult[] = [];
for (const starter of eaStarters()) {
    const started = Date.now();
    results.push(...walkStarter(starter, seeds, 'scrap174', true));
    console.log(`[${arm}] ${starter} x${seeds} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

const summary = summariseScrapCurves(results);
const picks = summariseCardPicks(results);
writeFileSync(out, JSON.stringify({ arm, seeds, starters: eaStarters().length, summary, picks }, null, 2));
console.log(`[${arm}] ${summary.runs} walks -> ${out}`);
