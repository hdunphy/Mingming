/**
 * TICKET 114 — the 1v1 grid RE-BASELINE runner, for Henry to run on his machine.
 *
 * WHY. Ticket 111 changed what a mid-resolution reshuffle feeds the PRNG. The gate measured 97 of 155
 * sampled cells bit-identical, which means 58 moved, and `docs/balance/deck_grid.json` has not been
 * regenerated since. Every field number on the roster is therefore PRE-FIX, and tuning against it is
 * the `0-CACHE-FIRMWARE-BLIND` failure mode - a fast instrument reporting a stale build.
 *
 * HOW LONG. MEASURED, not estimated: ~40s a deck row on 2 lanes, so the full 32 decks is about
 * 20 MINUTES. (An earlier version of this header said ~5 hours - that was extrapolated from ticket
 * 109's 3v3 battle costs, ~13s each, when 1v1 battles are ~0.3s. Wrong by an order of magnitude.)
 * It is still RESUMABLE by deck and writes each row as it lands, because the sandbox gets reclaimed
 * and ate two runs during this arc.
 *
 * IT DRIVES THE EXISTING PIECES rather than reimplementing them: `scratch/pool.mjs` runs one deck row
 * across lanes and is bit-identity-gated against a serial run by its own `--verify`. This only adds
 * the loop, the resume, and the summary.
 *
 * USAGE, from the repo root:
 *
 *     node scratch/rebaseline.mjs                       # all 32 decks, lanes = cores-1, 30 iterations
 *     node scratch/rebaseline.mjs --lanes 6             # pick the pool size by hand
 *     node scratch/rebaseline.mjs --iter 10             # a faster, coarser pass
 *     node scratch/rebaseline.mjs --only draugr_v2,hel_v2
 *     node scratch/rebaseline.mjs --verify-first        # prove the pool is bit-identical before the 5 hours
 *
 * Output: results/rebaseline/<deck>.csv per row, and results/rebaseline/SUMMARY.md.
 * NOTE it does NOT overwrite `docs/balance/deck_grid.json` - compare first, then decide.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const flag = n => process.argv.includes(`--${n}`);

const ITER = arg('iter', '30');
const LANES = arg('lanes', String(Math.max(1, os.cpus().length - 1)));
const SEEDBASE = arg('seedbase', 'grid');
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const OUTDIR = arg('outdir', 'results/rebaseline');

const grid = JSON.parse(fs.readFileSync('docs/balance/deck_grid.json', 'utf8'));
const DECKS = [...new Set(grid.cells.map(c => c.deck))];
/** The pre-fix numbers, kept so the summary can show what moved rather than just what is. */
const OLD = new Map();
for (const c of grid.cells) {
    if (!OLD.has(c.deck)) OLD.set(c.deck, []);
    OLD.get(c.deck).push({ opponent: c.opponent, wr: c.winRate * 100 });
}

fs.mkdirSync(OUTDIR, { recursive: true });

function runDeck(deck) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', ['scratch/pool.mjs', '--deck', deck, '--lanes', LANES,
            '--iter', ITER, '--seedbase', SEEDBASE], { env: process.env });
        let out = '', err = '';
        child.stdout.on('data', d => { out += d; });
        child.stderr.on('data', d => { err += d; });
        child.on('close', code => code === 0
            ? resolve(out)
            : reject(new Error(`${deck} exited ${code}\n${err.slice(-2000)}`)));
    });
}

if (flag('verify-first')) {
    // Cheap insurance before a five-hour run: prove the pool agrees with a serial run cell for cell.
    console.error('verifying the pool is bit-identical on one row before starting...');
    await new Promise((res, rej) => {
        const c = spawn('node', ['scratch/pool.mjs', '--deck', DECKS[0], '--lanes', LANES,
            '--iter', '5', '--verify'], { stdio: 'inherit', env: process.env });
        c.on('close', code => code === 0 ? res() : rej(new Error('pool verify FAILED - do not trust the run')));
    });
}

const selected = DECKS.filter(d => !ONLY.length || ONLY.includes(d));
const onDisk = selected.filter(d => fs.existsSync(path.join(OUTDIR, `${d}.csv`)));
const todo = selected.filter(d => !onDisk.includes(d));
console.error(`${DECKS.length} decks in the grid, ${selected.length} selected, ` +
    `${onDisk.length} already on disk, ${todo.length} to run.`);
console.error(`lanes=${LANES} iter=${ITER} seedbase=${SEEDBASE}\n`);

const started = Date.now();
let done = 0;
for (const deck of todo) {
    const t0 = Date.now();
    const out = await runDeck(deck);
    fs.writeFileSync(path.join(OUTDIR, `${deck}.csv`), out);
    done++;
    const each = (Date.now() - started) / done;
    const left = ((todo.length - done) * each) / 60000;
    const field = (out.match(/field=([\d.]+)/) || [])[1] ?? '?';
    const old = OLD.get(deck);
    const oldField = old ? (old.reduce((s, c) => s + c.wr, 0) / old.length).toFixed(2) : '?';
    console.error(`[${done}/${todo.length}] ${deck.padEnd(18)} field ${String(field).padStart(6)}%  ` +
        `(was ${String(oldField).padStart(6)}%)  ${((Date.now() - t0) / 1000).toFixed(0)}s   ` +
        `~${left.toFixed(0)} min left`);
}

// ---- summary ----
const rows = [];
for (const deck of DECKS) {
    const f = path.join(OUTDIR, `${deck}.csv`);
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    const cells = txt.split('\n').filter(l => l && !l.startsWith('#'))
        .map(l => { const [opponent, wr] = l.split(','); return { opponent, wr: Number(wr) }; })
        .filter(c => Number.isFinite(c.wr));
    if (!cells.length) continue;
    const field = cells.reduce((s, c) => s + c.wr, 0) / cells.length;
    const old = OLD.get(deck) ?? [];
    const oldField = old.length ? old.reduce((s, c) => s + c.wr, 0) / old.length : NaN;
    const movedCells = cells.filter(c => {
        const o = old.find(x => x.opponent === c.opponent);
        return o && Math.abs(o.wr - c.wr) >= 5;
    }).length;
    rows.push({ deck, field, oldField, delta: field - oldField, cells: cells.length, movedCells,
        zeros: cells.filter(c => c.wr === 0).length, hundreds: cells.filter(c => c.wr === 100).length });
}
rows.sort((a, b) => b.delta - a.delta);

const band = r => (r.field >= 35 && r.field <= 80) ? '' : ' **OUT OF BAND**';
const md = [
    '# 1v1 grid re-baseline (ticket 114) — post ticket-111',
    '',
    `Decks: ${rows.length}/${DECKS.length}. Iterations ${ITER}, seed base \`${SEEDBASE}\`, lanes ${LANES}.`,
    '',
    'The `was` column is `docs/balance/deck_grid.json`, i.e. PRE-fix. A cell counts as moved at 5+ points.',
    '',
    '| deck | field | was | delta | cells moved 5+ | zero cells | 100% cells |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(r => `| \`${r.deck}\`${band(r)} | ${r.field.toFixed(1)}% | ${r.oldField.toFixed(1)}% | ` +
        `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)} | ${r.movedCells}/${r.cells} | ${r.zeros} | ${r.hundreds} |`),
    '',
    `**Roster mean:** ${(rows.reduce((s, r) => s + r.field, 0) / rows.length).toFixed(1)}% ` +
    `(was ${(rows.reduce((s, r) => s + r.oldField, 0) / rows.length).toFixed(1)}%). ` +
    `**Out of the 35-80 band:** ${rows.filter(r => r.field < 35 || r.field > 80).length}. ` +
    `**Cells moving 5+:** ${rows.reduce((s, r) => s + r.movedCells, 0)} of ${rows.reduce((s, r) => s + r.cells, 0)}.`,
    '',
    'This file does NOT replace `docs/balance/deck_grid.json`. Compare, then decide whether to promote it.',
    '',
].join('\n');
fs.writeFileSync(path.join(OUTDIR, 'SUMMARY.md'), md);
console.error(`\ndone in ${((Date.now() - started) / 60000).toFixed(1)} min -> ${OUTDIR}/SUMMARY.md`);
