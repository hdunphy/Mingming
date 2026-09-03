/**
 * TICKET 132 — promote a `rebaseline.mjs` output directory into `docs/balance/deck_grid.json`.
 *
 * Henry: *"promote the deck_grid.json"*.
 *
 * `scratch/rebaseline.mjs` deliberately does NOT overwrite the grid — its header says *"compare
 * first, then decide"* — so the post-131 numbers have been sitting in `results/rebaseline/*.csv`
 * unpromoted since the re-baseline landed. Until they are promoted, every instrument that reads
 * the grid (and `rebaseline.mjs` itself, which reads it for its `was` column) describes the
 * PRE-ticket-131 game. That is the `0-CACHE-FIRMWARE-BLIND` failure mode with a longer fuse: a
 * correct instrument reporting a build that no longer exists.
 *
 * WHAT MOVES AND WHAT DOES NOT. Only the four MEASURED fields are replaced:
 *
 *     winRate  turns  ftk  dead
 *
 * `species`, `opponentSpecies`, `bucket`, `role` and `opponentRole` are all DERIVED from the
 * species pair and the archetype web, not from a battle, so they are carried across unchanged.
 * `bucket` in particular is elemental advantage (`fieldCensusSuite.bucketOf`), not a win-rate
 * band — recomputing it from win rates would silently redefine the column.
 *
 * THE ASSERTIONS ARE THE POINT. The failure this script exists to prevent is a PARTIAL promotion:
 * a grid where some cells are post-131 and some are pre-131 is worse than one that is uniformly
 * stale, because nothing about it looks wrong. So:
 *
 *   - every one of the 32 CSVs must be present, with 30 data rows each;
 *   - the (deck, opponent) key set of the CSVs must equal the grid's, exactly, both ways;
 *   - every cell must be claimed exactly once, and the count of updated cells must equal the
 *     number of cells in the grid before the write.
 *
 * Any of those failing aborts before a byte is written.
 *
 * CRLF. `deck_grid.json` is 14407 CRLF lines and 0 bare LF. `JSON.stringify` emits LF, so the
 * write normalises back to CRLF — otherwise the promotion shows up as a 14000-line diff with four
 * real changes hidden inside it.
 *
 * Run from the repo root:
 *     node scratch/promotegrid.mjs                            # writes the grid
 *     node scratch/promotegrid.mjs --dry-run                  # prints the summary, writes nothing
 *     node scratch/promotegrid.mjs --indir results/rebaseline-136
 *
 * TICKET 136: `--indir` exists because `rebaseline.mjs` has had `--outdir` since ticket 114 and
 * this script did not have its mirror image, so promoting a run that had been written anywhere
 * else meant shuffling directories underneath a script whose entire purpose is to refuse a
 * partial promotion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry-run');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const GRID = 'docs/balance/deck_grid.json';
const INDIR = arg('indir', 'results/rebaseline');

const grid = JSON.parse(fs.readFileSync(GRID, 'utf8'));
const before = grid.cells.length;

/** Every measured row from the CSVs, keyed `deck|opponent`. */
const fresh = new Map();
const files = fs.readdirSync(INDIR).filter(f => f.endsWith('.csv')).sort();
for (const file of files) {
    const deck = path.basename(file, '.csv');
    const lines = fs.readFileSync(path.join(INDIR, file), 'utf8')
        .split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    if (lines.length !== 30) {
        throw new Error(`promotegrid: ${file} has ${lines.length} rows, expected 30 — is that row still running?`);
    }
    for (const line of lines) {
        const [opponent, wr, games, decisive, turns, ftk, dead] = line.split(',');
        const key = `${deck}|${opponent}`;
        if (fresh.has(key)) throw new Error(`promotegrid: ${key} appears twice in ${file}`);
        fresh.set(key, {
            // The CSV carries percent to 2dp; the grid carries a fraction to 4dp. Same metric
            // (`decisiveWinRate`), and `rebaseline.mjs`'s own `was` column reads it as such.
            winRate: Number((Number(wr) / 100).toFixed(4)),
            games: Number(games),
            decisive: Number(decisive),
            turns: Number(turns),
            ftk: Number(ftk),
            dead: Number(dead),
        });
    }
}

// --- the key sets must match exactly, both directions -----------------------------------------
const gridKeys = new Set(grid.cells.map(c => `${c.deck}|${c.opponent}`));
const missing = [...gridKeys].filter(k => !fresh.has(k));
const extra = [...fresh.keys()].filter(k => !gridKeys.has(k));
if (missing.length) throw new Error(`promotegrid: ${missing.length} grid cells have no measurement, first: ${missing[0]}`);
if (extra.length) throw new Error(`promotegrid: ${extra.length} measurements match no grid cell, first: ${extra[0]}`);
if (gridKeys.size !== grid.cells.length) throw new Error('promotegrid: the grid has duplicate cells');

// --- apply ------------------------------------------------------------------------------------
const claimed = new Set();
let moved5 = 0, biggest = { key: '', delta: 0 };
for (const cell of grid.cells) {
    const key = `${cell.deck}|${cell.opponent}`;
    const now = fresh.get(key);
    claimed.add(key);
    const delta = Math.abs(now.winRate - cell.winRate) * 100;
    if (delta >= 5) moved5++;
    if (delta > Math.abs(biggest.delta)) biggest = { key, delta: (now.winRate - cell.winRate) * 100 };
    cell.winRate = now.winRate;
    cell.games = now.games;
    cell.decisive = now.decisive;
    cell.turns = now.turns;
    cell.ftk = now.ftk;
    cell.dead = now.dead;
}
if (claimed.size !== before) throw new Error(`promotegrid: claimed ${claimed.size} of ${before} cells`);

// TICKET 136: the provenance note is DERIVED, not typed. It used to name its date and its build in
// prose ('Regenerated 2026-09-02 on the post-ticket-131 build ...'), which is a hand-transcribed
// fact and therefore one that silently lies the first time somebody promotes without editing it -
// the same trap 0-BURN-PRICE-LAG records. The date now comes from the newest measured row and the
// build from the commit the promotion ran against, so neither can drift from what was measured.
const measured = new Date(Math.max(...files.map(f => fs.statSync(path.join(INDIR, f)).mtimeMs)))
    .toISOString().slice(0, 10);
let head = 'unknown';
try { head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }

grid.note = 'Every deck vs every other deck, both turn orders. Roles from research/archetype-web.md. '
    + `Measured ${measured} at commit ${head} by scratch/rebaseline.mjs into ${INDIR}/, seed base 'grid', `
    + '30 iterations per order, then promoted by scratch/promotegrid.mjs. '
    + 'Only winRate/turns/ftk/dead were replaced; species, bucket and role are derived and unchanged.';

// --- field summary, so the promotion prints what it did ---------------------------------------
const byDeck = new Map();
for (const c of grid.cells) {
    if (!byDeck.has(c.deck)) byDeck.set(c.deck, []);
    byDeck.get(c.deck).push(c.winRate * 100);
}
const fields = [...byDeck.entries()].map(([d, rs]) => [d, rs.reduce((a, b) => a + b, 0) / rs.length]);
fields.sort((a, b) => b[1] - a[1]);
const vals = fields.map(f => f[1]);
const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
const IN = v => v >= 35 && v <= 80;   // scratch/rebaseline.mjs:124 — the standing grid band

console.log(`cells ${before}, all claimed. moved 5+ points: ${moved5}`);
console.log(`biggest single-cell move: ${biggest.key} ${biggest.delta > 0 ? '+' : ''}${biggest.delta.toFixed(1)}`);
console.log(`\nfield mean ${mean.toFixed(1)}  sd ${sd.toFixed(1)}  in band (35-80) ${vals.filter(IN).length}/${vals.length}`);
console.log('\nOUT OF BAND:');
for (const [d, v] of fields) if (!IN(v)) console.log(`  ${d.padEnd(18)} ${v.toFixed(1)}`);

if (DRY) { console.log('\n--dry-run: nothing written.'); process.exit(0); }

fs.writeFileSync(GRID, JSON.stringify(grid, null, 4).replace(/\n/g, '\r\n') + '\r\n', 'utf8');
console.log(`\nwrote ${GRID}`);
