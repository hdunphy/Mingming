/**
 * Ticket 108, piece 2: the sweep pool, and its bit-identity gate.
 *
 * Runs a deck row across N child processes and merges the cells back into canonical order. The
 * ticket's gate for this piece is "bit-identity spot-check for the workers", so that check is not a
 * separate script you have to remember to run - `--verify` runs the row BOTH ways and diffs them,
 * and a mismatch is a non-zero exit. A parallel instrument that silently disagrees with the serial
 * one is worse than a slow instrument.
 *
 * Usage:
 *   node scratch/pool.mjs --deck draugr_v2 --lanes 2 [--iter 10] [--lite] [--verify]
 */
import { spawn } from 'node:child_process';
import os from 'node:os';

const arg = (name, dflt) => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? dflt : process.argv[i + 1];
};
const flag = name => process.argv.includes(`--${name}`);

const DECK = arg('deck', 'draugr_v2');
const ITER = arg('iter', '10');
const SEEDBASE = arg('seedbase', 'grid');
// Leave a core for the parent and the OS; a pool sized to every core makes the whole box thrash and
// the lanes finish slower than a smaller pool would.
const LANES = Number(arg('lanes', String(Math.max(1, os.cpus().length - 1))));

function runLane(shard, shards) {
    return new Promise((resolve, reject) => {
        const child = spawn('npx', ['tsx', 'scratch/gridshard.ts'], {
            env: { ...process.env, DECK, ITER, SEEDBASE, SHARD: String(shard), SHARDS: String(shards) },
            cwd: process.cwd(),
        });
        let out = '';
        child.stdout.on('data', d => { out += d; });
        // Lane stderr is the engine's own noise; surface it only on failure so a green run is quiet.
        let err = '';
        child.stderr.on('data', d => { err += d; });
        child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`lane ${shard} exit ${code}\n${err.slice(-2000)}`)));
    });
}

async function runRow(lanes) {
    const started = Date.now();
    const outs = await Promise.all(Array.from({ length: lanes }, (_, i) => runLane(i, lanes)));
    const cells = outs.join('').split('\n')
        .filter(l => l.startsWith('CELL,'))
        .map(l => {
            const [, i, deck, wr, games, decisive, turns, ftk, dead] = l.split(',');
            return { i: Number(i), deck, wr, games, decisive, turns, ftk, dead };
        })
        .sort((a, b) => a.i - b.i);
    const field = cells.reduce((s, c) => s + Number(c.wr), 0) / cells.length;
    // Extra columns are appended, so an older CSV (deck,wr) still parses and the --verify diff is
    // unaffected - it compares whatever the lanes actually emitted, on both sides.
    const text = cells.map(c => [c.deck, c.wr, c.games, c.decisive, c.turns, c.ftk, c.dead]
        .filter(v => v !== undefined).join(',')).join('\n');
    return { ms: Date.now() - started, cells, field, text };
}

if (flag('verify')) {
    // The gate: same row, one lane vs N lanes, diffed cell by cell.
    const serial = await runRow(1);
    const parallel = await runRow(LANES);
    const same = serial.text === parallel.text;
    console.log(serial.text);
    console.error(`\nserial   1 lane   ${(serial.ms / 1000).toFixed(1)}s  field ${serial.field.toFixed(2)}%`);
    console.error(`parallel ${LANES} lanes  ${(parallel.ms / 1000).toFixed(1)}s  field ${parallel.field.toFixed(2)}%`);
    console.error(`speedup  ${(serial.ms / parallel.ms).toFixed(2)}x on ${os.cpus().length} cores`);
    console.error(same ? 'BIT-IDENTICAL: every cell matches the serial run.'
        : 'MISMATCH - the pool changed a number. Do not use it.');
    if (!same) {
        for (const c of serial.cells) {
            const p = parallel.cells.find(x => x.i === c.i);
            if (!p || p.wr !== c.wr) console.error(`  ${c.deck}: serial ${c.wr} vs pool ${p?.wr}`);
        }
        process.exit(1);
    }
} else {
    const r = await runRow(LANES);
    console.log(`# deck=${DECK} iter=${ITER} seedbase=${SEEDBASE} lanes=${LANES} field=${r.field.toFixed(2)} ms=${r.ms}`);
    console.log(r.text);
    console.error(`\n${DECK} @${SEEDBASE}  field ${r.field.toFixed(2)}%  ${LANES} lanes  ${(r.ms / 1000).toFixed(1)}s`);
}
