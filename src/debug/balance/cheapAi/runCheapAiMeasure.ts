/**
 * Entry point for the cheap-AI measurement from the command line — ticket 177d.
 *
 *   npx vite-node src/debug/balance/cheapAi/runCheapAiMeasure.ts -- --cache results/cheap-ai/measure --shard 0 --shards 2
 *   npx vite-node src/debug/balance/cheapAi/runCheapAiMeasure.ts -- --cache results/cheap-ai/measure --phase replay
 *   npx vite-node src/debug/balance/cheapAi/runCheapAiMeasure.ts -- --cache results/cheap-ai/measure --report
 *
 * `--phase strength|replay|both` picks which units to run (the replay phase's timings want an idle
 * machine). `--report` writes docs/balance/cheap-ai-177.md from the cache and runs nothing; it stops
 * and lists what is missing if the cache is incomplete. A cache directory is only valid for one
 * version of the code: use a fresh one per commit you measure.
 */
import { runUnits, writeReport } from './cheapAiRun';

const argv = process.argv.slice(2);
const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
};
const cacheDir = get('--cache');

if (argv.includes('--report')) {
    console.error(`wrote ${writeReport({ cacheDir })}`);
} else {
    const phase = (get('--phase') ?? 'both') as 'strength' | 'replay' | 'both';
    runUnits({ cacheDir, phase, shard: Number(get('--shard') ?? 0), shards: Number(get('--shards') ?? 1) });
}
