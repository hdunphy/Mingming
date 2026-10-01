/**
 * `npm run balance:scrap-walk -- --arm before --seeds 30 --out /tmp/before.json` — ticket 174d.
 *
 * The entry point: walks every EA starter `--seeds` times with the upgrade policy ON (without it
 * the walker never spends on upgrades and the late surplus cannot show), pools the run logs through
 * `summariseScrapCurves` and writes the summary as JSON. Run it once per arm; the seeds are the
 * same, so the two are paired. `runScrapCurveReport.ts` turns two summaries into the report.
 */
import { writeFileSync } from 'node:fs';

import { eaStarters, walkStarter, type WalkResult } from './runWalker';
import { summariseScrapCurves } from './scrapCurveWalk';

const args = process.argv.slice(2);
const read = (flag: string, fallback: string): string => {
    const at = args.indexOf(flag);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const arm = read('--arm', 'arm');
const seeds = Number(read('--seeds', '30'));
const out = read('--out', `scrap-walk-${arm}.json`);

const results: WalkResult[] = [];
for (const starter of eaStarters()) {
    const started = Date.now();
    results.push(...walkStarter(starter, seeds, 'scrap174', true));
    console.log(`[${arm}] ${starter} x${seeds} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

const summary = summariseScrapCurves(results);
writeFileSync(out, JSON.stringify({ arm, seeds, starters: eaStarters().length, summary }, null, 2));
console.log(`[${arm}] ${summary.runs} walks -> ${out}`);
