/**
 * Ticket 97, piece 2's gate: the parallel runner must produce the SAME numbers in the SAME ORDER
 * as the serial one, whatever the worker count.
 *
 * Runs a slice of the grid serially, then again across N workers, and compares the assemblies byte
 * for byte. A parallel runner whose output depends on scheduling is not a speedup, it is a
 * reproducibility bug that only shows up when a pass disagrees with the previous pass for no
 * reason anybody can find.
 *
 * env: SLICE (decks, default 4), ITER (default 6), WORKERS (default 2)
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { runCellsParallel, type CellRequest } from './parallelGrid.wip';
import { ENV } from './_env';

const ITER = Number(ENV.ITER ?? 6);
const SLICE = Number(ENV.SLICE ?? 4);
const WORKERS = Number(ENV.WORKERS ?? 2);

const decks: Array<{ species: string; deck: string }> = [];
for (const species of BALANCE_SPECIES)
    for (const deck of MingmingRegistry[species].availableOS) decks.push({ species, deck });
const slice = decks.slice(0, SLICE);

const requests: CellRequest[] = [];
for (const a of slice) {
    for (const b of slice) {
        if (a.species === b.species) continue;
        requests.push({
            index: requests.length,
            playerSpecies: a.species, playerOS: a.deck,
            enemySpecies: b.species, enemyOS: b.deck,
            seed: `grid:${a.deck}:${b.deck}`,
            iterations: ITER,
        });
    }
}

const row = (r: { decisiveWinRate: number; averageTurns: number; ftkCount: number; deadCardRatio: number }) =>
    `${r.decisiveWinRate.toFixed(6)}|${r.averageTurns.toFixed(4)}|${r.ftkCount}|${r.deadCardRatio.toFixed(6)}`;

const serialStart = Date.now();
const serial = requests.map(q => {
    const r = runPairedBatch(
        matchupScenario({
            player: q.playerSpecies, enemy: q.enemySpecies,
            playerOS: q.playerOS, enemyOS: q.enemyOS, seed: q.seed,
        }),
        { iterations: q.iterations });
    return row(r.pooled);
});
const serialMs = Date.now() - serialStart;

const parallelStart = Date.now();
// The worker is loaded through a tiny JS shim: `worker_threads` does not inherit the parent's TS
// loader, and registering one per worker turned out to be the fiddly part in this sandbox. The shim
// registers tsx's ESM hooks itself and then imports the real worker.
const parallelResults = await runCellsParallel(
    requests, new URL('./cellWorkerShim.mjs', import.meta.url).pathname, WORKERS);
const parallelMs = Date.now() - parallelStart;
const parallel = parallelResults.map(row);

const identical = JSON.stringify(serial) === JSON.stringify(parallel);
console.error(`cells ${requests.length}   iterations ${ITER}   workers ${WORKERS}`);
console.error(`  serial   ${(serialMs / 1000).toFixed(1)}s`);
console.error(`  parallel ${(parallelMs / 1000).toFixed(1)}s   (${(serialMs / Math.max(1, parallelMs)).toFixed(2)}x)`);
console.error(`\n  serial === parallel  ${identical ? 'BIT-IDENTICAL' : 'DIFFERS'}`);

if (!identical) {
    for (let i = 0; i < serial.length; i++) {
        if (serial[i] !== parallel[i]) {
            console.error(`  first divergence at cell ${i}: ${serial[i]}  vs  ${parallel[i]}`);
            break;
        }
    }
    console.error('\nPROOF FAILED');
    process.exit(1);
}
console.error('\nPROOF PASSED');
