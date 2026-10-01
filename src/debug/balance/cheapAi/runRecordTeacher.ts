/**
 * Entry point for the teacher recording — ticket 177c. (`recordTeacher.ts` holds the logic; a
 * `vite-node` script cannot tell it is the entry, so the one line that runs lives here.)
 *
 *   npx vite-node src/debug/balance/cheapAi/runRecordTeacher.ts -- --fights 2000
 *   npx vite-node src/debug/balance/cheapAi/runRecordTeacher.ts -- --fights 2000 --shard 1 --shards 2
 *
 * Flags: `--fights N` (default 2000, across all shards), `--shard I --shards N` (this process takes
 * fights I, I+N, …; default 0 of 1), `--out DIR` (default results/cheap-ai). Run it again after a
 * stop and it carries on from the fights its file already finished.
 */
import { DEFAULT_FIGHTS, DEFAULT_OUT_DIR, recordShard } from './recordTeacher';

const argv = process.argv.slice(2);
const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
};

const fights = Number(get('--fights') ?? DEFAULT_FIGHTS);
const shard = Number(get('--shard') ?? 0);
const shards = Number(get('--shards') ?? 1);
const outDir = get('--out') ?? DEFAULT_OUT_DIR;

if (!Number.isInteger(fights) || fights < 1 || !Number.isInteger(shard) || !Number.isInteger(shards) || shards < 1 || shard < 0 || shard >= shards) {
    console.error('usage: --fights N [--shard I --shards N] [--out DIR]');
    process.exit(2);
}
const n = recordShard({ fights, shard, shards, outDir });
console.error(`[teacher ${shard}/${shards}] done: ${n} fights recorded this run.`);
