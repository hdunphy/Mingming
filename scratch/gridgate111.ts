/**
 * TICKET 111 GRID GATE — how far does the fix actually move the 1v1 numbers?
 *
 * A full 960-cell before/after is ~10 hours a side and the ticket-97 cache cannot help (engine `.ts`
 * changed, every key misses). But identity does not need a big sample: a cell that is unchanged is
 * unchanged at any iteration count, so this sweeps every deck against a five-deck spread at 10
 * iterations and reports how many cells moved at all. Cells that DO move get re-measured properly.
 *
 * Run once per arm; ARM labels the rows so both live in one file.
 *   AFTER   the fix as committed
 *   BEFORE  produced by temporarily passing `undefined` for the exclusion in resolutionEngine.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import fs from 'node:fs';
import { ENV } from './_env';

interface Cell { deck: string; species: string; opponent: string; opponentSpecies: string }
const grid: { cells: Cell[] } = JSON.parse(fs.readFileSync('docs/balance/deck_grid.json', 'utf8'));
const decks = [...new Map(grid.cells.map(c => [c.deck, c])).values()];
const SPREAD = ['huldra_v1', 'kraken_v1', 'skoll_v1', 'ymir_v1', 'audhumbla_v2'];
const oppOf = (id: string) => grid.cells.find(c => c.opponent === id)!;

const ARM = ENV.ARM ?? 'AFTER';
const ITER = Number(ENV.ITER ?? 10);
const OUT = ENV.OUT ?? '/root/probe/gridgate111.json';

const rows: Array<{ arm: string; deck: string; opponent: string; winRate: number; turns: number; decided: number }> =
    fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.arm}|${r.deck}|${r.opponent}`));

for (const d of decks) {
    for (const o of SPREAD) {
        if (o === d.deck || done.has(`${ARM}|${d.deck}|${o}`)) continue;
        const oc = oppOf(o);
        const r = runPairedBatch(teamScenario({
            player: [[d.species, d.deck]], enemy: [[oc.opponentSpecies, oc.opponent]],
            seed: `gridgate111:${d.deck}:${o}`,
        }), { iterations: ITER });
        rows.push({
            arm: ARM, deck: d.deck, opponent: o,
            winRate: r.pooled.decisiveWinRate, turns: +r.pooled.averageTurns.toFixed(3),
            decided: r.pooled.iterations - r.pooled.truncatedCount,
        });
        fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
    }
    console.error(`  ${ARM} ${d.deck}`);
}
console.error(`\n${ARM}: ${rows.filter(r => r.arm === ARM).length} cells -> ${OUT}`);
