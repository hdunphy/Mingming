/**
 * TICKET 135 — run the +1e-to-underperformers arm across the WHOLE 32-deck grid.
 *
 * Ticket 134's arms all ran on a ten-deck panel, which was right for a global knob: a knob applied
 * to everything moves everything, so the extremes are enough to read it. This arm is not global.
 * It buffs nine named decks, and buffing nine decks changes the field score of all thirty-two —
 * every deck that plays one of the nine meets a stronger opponent, so the twenty-three unbuffed
 * decks will drift DOWN even though nothing about them changed. Reading this arm off a panel would
 * confuse that drift with a real effect.
 *
 * So: all 32 rows, same seeds, same iteration count, same beamless search as the promoted grid, and
 * the comparison is against `docs/balance/deck_grid.json` cell for cell.
 *
 * Structure is deliberately `rebaseline.mjs`'s, driving `energyshard.ts` instead of `gridshard.ts`.
 * Rows are written as they land, so a reclaimed sandbox costs one row rather than the run.
 *
 * Run from the repo root:
 *     node scratch/energygrid.mjs                  # all 32, lanes = cores-1, iter 30
 *     node scratch/energygrid.mjs --only fafnir_v1,kraken_v1
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };

const ITER = arg('iter', '30');
const LANES = Number(arg('lanes', String(Math.max(1, os.cpus().length - 1))));
const SEEDBASE = arg('seedbase', 'grid');
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const OUTDIR = arg('outdir', 'results/energyarm');

/** Kept in step with `energyshard.ts` by assertion, not by trust — see the check below. */
const UNDERPERFORMERS = new Set([
    'jormungandr_v2', 'hel_v2', 'kraken_v1', 'draugr_v1', 'kraken_v2',
    'gullinbursti_v2', 'fenrir_v1', 'fafnir_v1', 'fafnir_v2',
]);

const grid = JSON.parse(fs.readFileSync('docs/balance/deck_grid.json', 'utf8'));
const DECKS = [...new Set(grid.cells.map(c => c.deck))];
/** The promoted post-131 numbers, so the summary shows what MOVED rather than just what is. */
const BEFORE = new Map();
for (const c of grid.cells) BEFORE.set(`${c.deck}|${c.opponent}`, c.winRate * 100);

for (const d of UNDERPERFORMERS) {
    if (!DECKS.includes(d)) throw new Error(`energygrid: '${d}' is not a deck in the grid`);
}

fs.mkdirSync(OUTDIR, { recursive: true });

const VITE_NODE = path.join(
    path.dirname(createRequire(import.meta.url).resolve('vite-node/package.json')),
    'vite-node.mjs',
);

function runLane(deck, shard, shards) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [VITE_NODE, 'scratch/energyshard.ts', '--',
            '--deck', deck, '--iter', ITER, '--seedbase', SEEDBASE,
            '--shard', String(shard), '--shards', String(shards)]);
        let out = '', err = '';
        child.stdout.on('data', d => { out += d; });
        child.stderr.on('data', d => { err += d; });
        child.on('error', e => reject(new Error(`lane ${shard} failed to start: ${e.message}`)));
        child.on('close', code => code === 0 ? resolve(out)
            : reject(new Error(`lane ${shard} exit ${code}\n${err.slice(-2000)}`)));
    });
}

async function runDeck(deck) {
    const started = Date.now();
    const outs = await Promise.all(Array.from({ length: LANES }, (_, i) => runLane(deck, i, LANES)));
    const merged = outs.join('').split('\n');

    // Every lane must have announced its own arm check. A lane that died before the check, or that
    // silently measured the unmodified game, must not be merged into a row that looks complete.
    const checks = merged.filter(l => l.startsWith('ARMCHECK,'));
    if (checks.length !== LANES) {
        throw new Error(`energygrid: ${deck} got ${checks.length} ARMCHECK lines from ${LANES} lanes`);
    }

    const cells = merged.filter(l => l.startsWith('CELL,')).map(l => {
        const [, i, opp, wr, games, decisive, turns, ftk, dead, pe, ee] = l.split(',');
        return { i: Number(i), opp, wr, games, decisive, turns, ftk, dead, pe: Number(pe), ee: Number(ee) };
    }).sort((a, b) => a.i - b.i);
    if (cells.length !== 30) throw new Error(`energygrid: ${deck} produced ${cells.length} cells, expected 30`);

    // THE INDEPENDENT RE-CHECK. The shard decided which sides to buff; this re-derives it from the
    // list here and requires the per-cell energies to agree in DIRECTION. A shard whose buff set
    // drifted out of step with this file would otherwise merge cleanly and be invisible.
    const pristine = new Map();   // species -> the energy seen when that side was NOT buffed
    const record = (species, deck_, energy) => {
        if (UNDERPERFORMERS.has(deck_)) return;
        const seen = pristine.get(species);
        if (seen !== undefined && seen !== energy) {
            throw new Error(`energygrid: ${species} unbuffed energy is both ${seen} and ${energy}`);
        }
        pristine.set(species, energy);
    };
    const speciesOf = d => d.replace(/_v[12]$/, '');
    for (const c of cells) { record(speciesOf(deck), deck, c.pe); record(speciesOf(c.opp), c.opp, c.ee); }
    for (const c of cells) {
        for (const [d, e] of [[deck, c.pe], [c.opp, c.ee]]) {
            const base = pristine.get(speciesOf(d));
            if (base === undefined) continue;   // a species seen only in its buffed form
            const want = base + (UNDERPERFORMERS.has(d) ? 1 : 0);
            if (e !== want) throw new Error(`energygrid: ${deck} vs ${c.opp}: ${d} energy ${e}, expected ${want}`);
        }
    }

    const field = cells.reduce((s, c) => s + Number(c.wr), 0) / cells.length;
    const text = `# deck=${deck} iter=${ITER} seedbase=${SEEDBASE} lanes=${LANES} field=${field.toFixed(2)} `
        + `ms=${Date.now() - started} arm=+1e-to-underperformers\n`
        + cells.map(c => [c.opp, c.wr, c.games, c.decisive, c.turns, c.ftk, c.dead, c.pe, c.ee].join(',')).join('\n');
    fs.writeFileSync(path.join(OUTDIR, `${deck}.csv`), text + '\n');
    return { field, cells, ms: Date.now() - started };
}

const targets = ONLY.length ? DECKS.filter(d => ONLY.includes(d)) : DECKS;
const rows = [];
for (const deck of targets) {
    const done = path.join(OUTDIR, `${deck}.csv`);
    if (fs.existsSync(done)) {
        // Resumable by deck. The sandbox has eaten two runs in this arc.
        const head = fs.readFileSync(done, 'utf8').split('\n')[0];
        const field = Number(/field=([\d.]+)/.exec(head)?.[1]);
        rows.push({ deck, field });
        console.log(`SKIP ${deck} (already on disk, field ${field.toFixed(2)})`);
        continue;
    }
    const r = await runDeck(deck);
    rows.push({ deck, field: r.field });
    const was = rows.length && BEFORE.size
        ? r.cells.reduce((s, c) => s + BEFORE.get(`${deck}|${c.opp}`), 0) / r.cells.length : NaN;
    console.log(`ROW,${deck},${r.field.toFixed(2)},was,${was.toFixed(2)},`
        + `${(r.field - was >= 0 ? '+' : '')}${(r.field - was).toFixed(1)},${(r.ms / 1000).toFixed(0)}s`
        + (UNDERPERFORMERS.has(deck) ? ',BUFFED' : ''));
}

// --- summary ----------------------------------------------------------------------------------
const IN = v => v >= 35 && v <= 80;   // scratch/rebaseline.mjs:124
const wasField = new Map();
for (const d of DECKS) {
    const cs = grid.cells.filter(c => c.deck === d);
    wasField.set(d, cs.reduce((s, c) => s + c.winRate * 100, 0) / cs.length);
}
const vals = rows.map(r => r.field);
const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
const oldVals = rows.map(r => wasField.get(r.deck));
const oldMean = oldVals.reduce((a, b) => a + b, 0) / oldVals.length;
const oldSd = Math.sqrt(oldVals.reduce((s, v) => s + (v - oldMean) ** 2, 0) / oldVals.length);

const lines = [];
lines.push('# +1 energy to the nine underperforming decks — full grid\n');
lines.push(`Decks ${rows.length}/${DECKS.length}. Iterations ${ITER}, seed base \`${SEEDBASE}\`, beamless.`);
lines.push(`\`was\` is the promoted post-131 \`docs/balance/deck_grid.json\`.\n`);
lines.push('| deck | field | was | delta | |');
lines.push('|---|---|---|---|---|');
for (const r of [...rows].sort((a, b) => b.field - a.field)) {
    const w = wasField.get(r.deck);
    const tags = [UNDERPERFORMERS.has(r.deck) ? '**+1e**' : '', IN(r.field) ? '' : 'OUT'].filter(Boolean).join(' ');
    lines.push(`| \`${r.deck}\` | ${r.field.toFixed(1)} | ${w.toFixed(1)} | ${r.field - w >= 0 ? '+' : ''}${(r.field - w).toFixed(1)} | ${tags} |`);
}
lines.push('');
lines.push(`**Before:** mean ${oldMean.toFixed(1)}, sd ${oldSd.toFixed(1)}, in band ${oldVals.filter(IN).length}/${oldVals.length}.`);
lines.push(`**After:**  mean ${mean.toFixed(1)}, sd ${sd.toFixed(1)}, in band ${vals.filter(IN).length}/${vals.length}.`);
const buffed = rows.filter(r => UNDERPERFORMERS.has(r.deck));
const rescued = buffed.filter(r => IN(r.field));
lines.push(`\n**Of the nine buffed decks, ${rescued.length} came into band:** `
    + (rescued.map(r => `\`${r.deck}\` ${r.field.toFixed(1)}`).join(', ') || 'none'));
const collateral = rows.filter(r => !UNDERPERFORMERS.has(r.deck) && IN(wasField.get(r.deck)) && !IN(r.field));
lines.push(`**Unbuffed decks knocked OUT of band by the change:** `
    + (collateral.map(r => `\`${r.deck}\` ${wasField.get(r.deck).toFixed(1)} -> ${r.field.toFixed(1)}`).join(', ') || 'none'));
fs.writeFileSync(path.join(OUTDIR, 'SUMMARY.md'), lines.join('\n') + '\n');
console.log('\n' + lines.join('\n'));
