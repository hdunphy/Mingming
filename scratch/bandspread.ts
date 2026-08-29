/**
 * TICKET 121 — how far off band is the card pool ACTUALLY, and what tolerance does that justify?
 *
 * Henry, 2026-08-26, on `frost_bite` scoring 3.3 against a 3.0 ceiling: *"3.3 vs 3 is not a problem.
 * 3 is not a hard cut off but a general target we can be +/- some percentage. If it would make you
 * feel better add a metric here. Like +/- 15% or maybe use Standard deviation or something."*
 *
 * He is right that the current report is binary and that the binary reads worse than reality. What
 * it currently says is IN BAND or OVER, with no sense of by how much - so a card 1% over and a card
 * 150% over produce the same word, and every audit in this repo has treated them the same way.
 *
 * This does not pick the tolerance. It measures the distribution the tolerance has to describe:
 * every non-token card scored, expressed as a percentage of its own cost band's ceiling, so cards at
 * different costs are comparable. Then the mean, the standard deviation, and what each candidate
 * tolerance would actually admit.
 *
 * The point of running it before writing the rule: a +/-15% tolerance is only a good rule if 15% is
 * where the pool's own noise sits. If the pool's spread is 40%, a 15% rule reclassifies half the
 * roster as violations; if it is 5%, a 15% rule waves through cards that really are mispriced.
 *
 * Run: npx vite-node scratch/bandspread.ts
 */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

interface Scored { id: string; cost: number; score: number; ceiling: number; pct: number }

const rows: Scored[] = [];
for (const [id, raw] of Object.entries(ProgramRegistry)) {
    const card = raw as unknown as ProgramData & { isToken?: boolean; baseCost?: number };
    if (card.isToken) continue;                       // tokens are not costed against the curve
    const cost = typeof card.baseCost === 'number' ? card.baseCost : null;
    if (cost === null) continue;                      // X-cost and similar have no fixed band
    let score: number;
    try { score = calculatePowerscale(card as ProgramData).score; } catch { continue; }
    const ceiling = budgetBandFor(cost).over;
    if (!Number.isFinite(ceiling) || ceiling <= 0) continue;
    rows.push({ id, cost, score, ceiling, pct: (score / ceiling - 1) * 100 });
}

rows.sort((a, b) => b.pct - a.pct);
const pcts = rows.map(r => r.pct);
const mean = pcts.reduce((s, x) => s + x, 0) / pcts.length;
const sd = Math.sqrt(pcts.reduce((s, x) => s + (x - mean) ** 2, 0) / pcts.length);
const median = [...pcts].sort((a, b) => a - b)[Math.floor(pcts.length / 2)];
const absMedian = [...pcts.map(Math.abs)].sort((a, b) => a - b)[Math.floor(pcts.length / 2)];

console.log(`${rows.length} costed, non-token cards scored.`);
console.log(`Deviation from each card's own cost-band CEILING, in percent:`);
console.log(`  mean ${mean.toFixed(1)}%   median ${median.toFixed(1)}%   sd ${sd.toFixed(1)}%`);
console.log(`  median ABSOLUTE deviation ${absMedian.toFixed(1)}%  <- the typical distance from the target,`);
console.log(`     ignoring direction. This is the number a tolerance should be built on.\n`);

for (const tol of [5, 10, 15, 20, 25, 30, 50]) {
    const over = rows.filter(r => r.pct > tol).length;
    console.log(`  tolerance +${String(tol).padStart(2)}%   ${String(over).padStart(3)} cards still over `
        + `(${(over / rows.length * 100).toFixed(1)}% of the pool)`);
}
console.log(`  1 sd = +${sd.toFixed(1)}%, 2 sd = +${(2 * sd).toFixed(1)}%\n`);

console.log('the 15 furthest OVER:');
for (const r of rows.slice(0, 15)) {
    console.log(`  ${r.id.padEnd(20)} ${r.cost}e  score ${r.score.toFixed(1).padStart(6)}  `
        + `ceiling ${r.ceiling.toFixed(1).padStart(5)}   ${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(0)}%`);
}
console.log('\nthe 5 furthest UNDER:');
for (const r of rows.slice(-5)) {
    console.log(`  ${r.id.padEnd(20)} ${r.cost}e  score ${r.score.toFixed(1).padStart(6)}  `
        + `ceiling ${r.ceiling.toFixed(1).padStart(5)}   ${r.pct.toFixed(0)}%`);
}
