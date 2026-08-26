/**
 * TICKET 110 follow-up B — is CONTROL also the weakest role at 1v1, once the type chart is removed?
 *
 * The width probe's by-product: normalising the committed 960-cell grid to NEUTRAL cells only, the
 * role matrix inverts against control at every leg -
 *
 *     CONTROL vs RAMP 41.4%   |   CONTROL vs ZOO 43.9%   |   CONTROL vs BURST 47.6%
 *
 * i.e. control is the WORST role at 1v1 before width enters the picture at all. That matters for
 * sequencing: if it holds, then "control's answers do not scale with body count" is only half the
 * problem, and a coverage fix at 3v3 would leave a weak-at-1v1 role standing.
 *
 * THE PROBLEM WITH THAT READING, and the reason for this probe: the neutral CONTROL-vs-ZOO sample is
 * **three cells**. Type advantage decides most control/zoo pairings, so there is almost nothing
 * neutral left to read. Three cells at 60 games is a thin basis for retiring a role.
 *
 * This re-runs every NEUTRAL cell involving a CONTROL deck at a fresh seed base - the protocol's
 * "always run the control before blaming a tier", applied to my own claim. The grid's cells were
 * measured at 30 iterations per order; this is a second independent sample of the same cells, so
 * agreement means the reading is real and disagreement means it was seed noise on a small n.
 *
 * env: ITER=<n>  OUT=<path>
 * Run: ITER=30 AI_LITE=1 AI_BEAM=8 npx vite-node scratch/neutralcontrol.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';

interface GridCell {
    deck: string; species: string; opponent: string; opponentSpecies: string;
    bucket: string; role: string; opponentRole: string; winRate: number;
}

const grid: { cells: GridCell[] } = JSON.parse(
    fs.readFileSync('docs/balance/deck_grid.json', 'utf8'));

/** Every neutral cell whose SUBJECT is a control deck - the rows that produced the claim. */
const CELLS = grid.cells.filter(c => c.role === 'CONTROL' && c.bucket === 'NEU');

const ITER = Number(process.env.ITER ?? 30);
const OUT = process.env.OUT ?? '/root/probe/neutralcontrol.json';

interface Row {
    deck: string; opponent: string; opponentRole: string; tier: string;
    gridWinRate: number; freshWinRate: number; delta: number;
    games: number; turns: number; truncated: number;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.deck}|${r.opponent}`));

console.error(`${CELLS.length} neutral CONTROL cells to re-measure at a fresh seed base\n`);

for (const c of CELLS) {
    if (done.has(`${c.deck}|${c.opponent}`)) continue;
    const r = runPairedBatch(teamScenario({
        player: [[c.species, c.deck]], enemy: [[c.opponentSpecies, c.opponent]],
        // Deliberately NOT the grid's seed - this is a second sample, not a reproduction.
        seed: `neutralcontrol:B:${c.deck}:${c.opponent}`,
    }), { iterations: ITER });
    const row: Row = {
        deck: c.deck, opponent: c.opponent, opponentRole: c.opponentRole,
        tier: `${AI_TIER}/beam${process.env.AI_BEAM ?? 0}`,
        gridWinRate: c.winRate, freshWinRate: r.pooled.decisiveWinRate,
        delta: +((r.pooled.decisiveWinRate - c.winRate) * 100).toFixed(1),
        games: r.pooled.iterations, turns: +r.pooled.averageTurns.toFixed(2),
        truncated: r.pooled.truncatedCount,
    };
    rows.push(row);
    fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
    console.error(`${c.deck.padEnd(16)} vs ${c.opponent.padEnd(16)} (${c.opponentRole.padEnd(7)}) ` +
        `grid ${(c.winRate * 100).toFixed(1)}%  fresh ${(row.freshWinRate * 100).toFixed(1)}%  ` +
        `${row.delta >= 0 ? '+' : ''}${row.delta}`);
}

console.error('\n=== CONTROL vs each role on neutral ground, both samples ===');
const byRole: Record<string, Row[]> = {};
for (const r of rows) (byRole[r.opponentRole] ??= []).push(r);
for (const [role, rs] of Object.entries(byRole).sort()) {
    const g = rs.reduce((a, r) => a + r.gridWinRate, 0) / rs.length * 100;
    const f = rs.reduce((a, r) => a + r.freshWinRate, 0) / rs.length * 100;
    console.error(`  vs ${role.padEnd(8)} n=${String(rs.length).padStart(2)}  grid ${g.toFixed(1)}%  fresh ${f.toFixed(1)}%  ` +
        `mean |delta| ${(rs.reduce((a, r) => a + Math.abs(r.delta), 0) / rs.length).toFixed(1)}`);
}
const all = rows.length ? rows.reduce((a, r) => a + r.freshWinRate, 0) / rows.length * 100 : 0;
console.error(`\n  CONTROL overall on neutral ground: ${all.toFixed(1)}% (n=${rows.length} cells)`);
console.error(all < 47
    ? '  Below 47%: control IS the weak role at 1v1 too, and the coverage fix is only half the job.'
    : '  At or above 47%: the neutral-matrix reading was small-n noise; control is fine at 1v1.');
console.error(`\n-> ${OUT}`);
