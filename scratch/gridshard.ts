/**
 * Ticket 108, piece 2: the parallel sweep - built as PROCESSES, not `worker_threads`.
 *
 * The ticket asks for a worker pool. I tried that first and it does not work here:
 * `worker_threads` does not inherit the ESM loader that runs these `.ts` files, so a worker cannot
 * import the engine at all. Every fix for that (a compiled dist, a loader flag threaded into
 * `execArgv`, a bundling step) adds a build artifact between the source and the number, and a
 * balance instrument that measures a STALE BUILD is the worst failure mode this toolkit has - it is
 * the ticket-103 cell-cache bug again, in a form no test would catch.
 *
 * A child process is a fresh interpreter with the same loader, so it has none of that risk. It
 * costs more memory per lane and ~1s of startup, which against a 30-second row is noise.
 *
 * The correctness argument is what makes the sharding legal at all: a cell is a pure function of
 * (setup, seed), the seed is derived from the cell's own identity, and no cell reads another's
 * result. So sharding cannot change any number - and `scratch/pool.mjs` asserts exactly that by
 * diffing a sharded run against a single-process one.
 *
 * env: DECK, ITER, SEEDBASE, SHARD (0-based), SHARDS (default 1)
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';

/**
 * FLAGS, NOT ENVIRONMENT. `vite.config.ts` substitutes `define: { 'process.env': {} }` so a stray
 * `process.env.X` cannot throw in the browser bundle - and vite-node transforms this file through
 * that same config, so every `process.env` read here resolves to undefined.
 *
 * That is not a bug in their config, it is the repo's stated convention: "every debug CLI in this
 * repo takes flags rather than environment variables". This file predated the rule and broke
 * silently the moment the rule landed - every lane fell back to its defaults and measured
 * `draugr_v2` at iter 10 with SHARDS=1, so all eleven lanes ran the identical full opponent list
 * and the CSV held 330 rows of 30 distinct cells under the wrong deck's name.
 *
 * `--deck` is REQUIRED for exactly that reason: a silent default is what let a broken run look
 * like a finished one.
 */
function arg(name: string, dflt?: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        if (dflt === undefined) throw new Error(`gridshard: --${name} is required`);
        return dflt;
    }
    return v;
}

const DECK = arg('deck');
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(arg('iter', '10'));
const SEEDBASE = arg('seedbase', 'grid');
const SHARD = Number(arg('shard', '0'));
const SHARDS = Number(arg('shards', '1'));

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

// Stride, not block. A contiguous block would hand one lane all of one species' cells, and cell
// cost varies by species (a stalling matchup runs to the 60-turn cap), so blocks finish at wildly
// different times. Striding interleaves the expensive rows across every lane.
for (let i = SHARD; i < opponents.length; i += SHARDS) {
    const o = opponents[i];
    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck,
        seed: `${SEEDBASE}:${DECK}:${o.deck}`,
    }), { iterations: ITER });
    // CELL-prefixed AND index-prefixed. The prefix is not decoration: the engine logs to stdout
    // too, so a lane's pipe carries battle noise interleaved with results, and an unmarked line
    // format silently parsed that noise into NaN cells. The index lets the merger restore canonical
    // order without knowing the roster.
    // TICKET 114 promotion: the row used to carry ONLY the win rate, so a grid promoted from these
    // CSVs would have kept `turns`, `ftk`, `dead` and `decisive` at their pre-fix values - a file
    // that looks current and is half stale, which is the `0-CACHE-FIRMWARE-BLIND` failure mode.
    // Field order is append-only; `pool.mjs` reads by position.
    console.log([`CELL`, i, o.deck,
        (r.pooled.decisiveWinRate * 100).toFixed(2),
        r.pooled.iterations, r.pooled.decisive,
        r.pooled.averageTurns.toFixed(2), r.pooled.ftkCount,
        r.pooled.deadCardRatio.toFixed(4)].join(','));
}
