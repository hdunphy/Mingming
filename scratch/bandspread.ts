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
 * TICKET 149c-4 — IT NOW MEASURES THE POOL TWICE, ONCE PER WIDTH.
 *
 * The distribution this prints is the input to the tolerance rule, and until 149c-4 it was a
 * distribution of a number that did not exist: every Side card was scored at its 3v3 multiplier
 * whatever fight was being talked about. 22 of the 232 cards are Side, and they sat near the top
 * of the OVER list precisely because of it. So the spread is printed at both widths now, and the
 * gap between them IS the thing 149c-4 exists to surface: if the 1v1 column is tight and the 3v3
 * column is not, the pool's problem is width, not pricing.
 *
 * Run: npx vite-node scratch/bandspread.ts
 */
import { BAND_TOLERANCE_PCT, bandVerdict, calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

interface Scored {
    id: string;
    cost: number;
    score1v1: number;
    score3v3: number;
    ceiling: number;
    pct1v1: number;
    pct3v3: number;
}

const rows: Scored[] = [];
for (const [id, raw] of Object.entries(ProgramRegistry)) {
    const card = raw as unknown as ProgramData & { isToken?: boolean; baseCost?: number };
    if (card.isToken) continue;                       // tokens are not costed against the curve
    const cost = typeof card.baseCost === 'number' ? card.baseCost : null;
    if (cost === null) continue;                      // X-cost and similar have no fixed band
    let score1v1: number, score3v3: number;
    try {
        const scored = calculatePowerscale(card as ProgramData);
        score1v1 = scored.score1v1;
        score3v3 = scored.score3v3;
    } catch { continue; }
    const ceiling = budgetBandFor(cost).over;
    if (!Number.isFinite(ceiling) || ceiling <= 0) continue;
    rows.push({
        id, cost, score1v1, score3v3, ceiling,
        pct1v1: (score1v1 / ceiling - 1) * 100,
        pct3v3: (score3v3 / ceiling - 1) * 100,
    });
}

/** mean / median / sd / median-absolute for one width's column. */
function describe(pcts: number[]) {
    const mean = pcts.reduce((s, x) => s + x, 0) / pcts.length;
    const sd = Math.sqrt(pcts.reduce((s, x) => s + (x - mean) ** 2, 0) / pcts.length);
    const median = [...pcts].sort((a, b) => a - b)[Math.floor(pcts.length / 2)];
    const absMedian = [...pcts.map(Math.abs)].sort((a, b) => a - b)[Math.floor(pcts.length / 2)];
    return { mean, sd, median, absMedian };
}

const widths = [
    { label: '1v1', pcts: rows.map(r => r.pct1v1) },
    { label: '3v3', pcts: rows.map(r => r.pct3v3) },
] as const;

const sideCards = rows.filter(r => r.pct3v3 !== r.pct1v1);

console.log(`${rows.length} costed, non-token cards scored — ${sideCards.length} of them Side/All, `
    + `i.e. the only ones whose two widths differ.`);
console.log(`Deviation from each card's own cost-band CEILING, in percent:\n`);

for (const { label, pcts } of widths) {
    const d = describe(pcts);
    console.log(`  at ${label}:  mean ${d.mean.toFixed(1)}%   median ${d.median.toFixed(1)}%   sd ${d.sd.toFixed(1)}%`);
    console.log(`            median ABSOLUTE deviation ${d.absMedian.toFixed(1)}%   (1 sd = +${d.sd.toFixed(1)}%, 2 sd = +${(2 * d.sd).toFixed(1)}%)`);
}
console.log(`\n  The median absolute deviation is the number a tolerance should be built on: the`);
console.log(`  typical distance from the target, ignoring direction.\n`);

/*
 * TICKET 149c-5 — THE RULE THIS SCRIPT ARGUED FOR, NOW APPLIED.
 *
 * §4.3 ruled +/-15% off the back of the median absolute deviation printed above. Printing the
 * resulting split here, in the same vocabulary `bandVerdict` uses everywhere else, is what stops
 * this script and the committed report from developing two different ideas of "over".
 */
console.log(`With the shipped +/-${BAND_TOLERANCE_PCT}% tolerance (§4.3):`);
for (const { label, pcts } of widths) {
    const states = pcts.map((_, i) => bandVerdict(
        label === '1v1' ? rows[i].score1v1 : rows[i].score3v3,
        rows[i].ceiling,
    ).state);
    const count = (state: string) => states.filter(x => x === state).length;
    console.log(`  at ${label}:  ${String(count('IN BAND')).padStart(3)} IN BAND   `
        + `${String(count('WITHIN TOLERANCE')).padStart(3)} WITHIN TOLERANCE   `
        + `${String(count('OUT OF BAND')).padStart(3)} OUT OF BAND   `
        + `${String(count('MANUAL REVIEW')).padStart(3)} MANUAL REVIEW`);
}
console.log('');

console.log(`What each candidate tolerance would still call OVER:`);
console.log(`  ${'tol'.padStart(6)}   ${'at 1v1'.padStart(16)}   ${'at 3v3'.padStart(16)}`);
for (const tol of [5, 10, 15, 20, 25, 30, 50]) {
    const cells = widths.map(({ pcts }) => {
        const over = pcts.filter(p => p > tol).length;
        return `${String(over).padStart(3)} (${(over / rows.length * 100).toFixed(1)}%)`.padStart(16);
    });
    console.log(`  ${('+' + tol + '%').padStart(6)}   ${cells.join('   ')}`);
}

console.log('\nthe 15 furthest OVER at 1v1 — the verdict width for a non-Side card (§4.2):');
for (const r of [...rows].sort((a, b) => b.pct1v1 - a.pct1v1).slice(0, 15)) {
    const wide = r.pct3v3 !== r.pct1v1 ? `   (3v3 ${r.score3v3.toFixed(1)}, ${r.pct3v3 >= 0 ? '+' : ''}${r.pct3v3.toFixed(0)}%)` : '';
    console.log(`  ${r.id.padEnd(20)} ${r.cost}e  score ${r.score1v1.toFixed(1).padStart(6)}  `
        + `ceiling ${r.ceiling.toFixed(1).padStart(5)}   ${bandVerdict(r.score1v1, r.ceiling).label.padEnd(24)}${wide}`);
}

console.log('\nthe 15 furthest OVER at 3v3 — which is the verdict width for these, being Side/All:');
for (const r of [...rows].sort((a, b) => b.pct3v3 - a.pct3v3).slice(0, 15)) {
    const narrow = r.pct3v3 !== r.pct1v1 ? `   (1v1 ${r.score1v1.toFixed(1)}, ${r.pct1v1 >= 0 ? '+' : ''}${r.pct1v1.toFixed(0)}%)` : '';
    console.log(`  ${r.id.padEnd(20)} ${r.cost}e  score ${r.score3v3.toFixed(1).padStart(6)}  `
        + `ceiling ${r.ceiling.toFixed(1).padStart(5)}   ${bandVerdict(r.score3v3, r.ceiling).label.padEnd(24)}${narrow}`);
}

console.log('\nthe 5 furthest UNDER at 1v1:');
for (const r of [...rows].sort((a, b) => a.pct1v1 - b.pct1v1).slice(0, 5)) {
    console.log(`  ${r.id.padEnd(20)} ${r.cost}e  score ${r.score1v1.toFixed(1).padStart(6)}  `
        + `ceiling ${r.ceiling.toFixed(1).padStart(5)}   ${bandVerdict(r.score1v1, r.ceiling).label}`);
}
