/**
 * `npm run balance:scrap-curve -- <path-to-mingming_run_log.json>` — ticket 174a.
 *
 * The entry point, and nothing else (the same split `runRunRead.ts` has from `runRead.ts`).
 * Prints the per-biome scrap table for every run in the file that has at least one fight. The
 * file's shape is `{ version, logs: [{ runKey, seed, events }] }`, which is what the game's run
 * log export and the per-run auto-save both write.
 */
import { readFileSync } from 'node:fs';

import { formatScrapCurves } from './scrapCurveTable';
import type { IRunLog } from '../../engine/run/runLog';

const path = process.argv.slice(2).find((arg) => !arg.startsWith('-') && arg.endsWith('.json'));
if (!path) {
    console.error('Usage: npm run balance:scrap-curve -- <path-to-mingming_run_log.json>');
    process.exit(1);
}

const envelope = JSON.parse(readFileSync(path, 'utf8')) as { logs?: IRunLog[] };
console.log(formatScrapCurves(envelope.logs ?? []));
