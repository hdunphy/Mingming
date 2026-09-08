/**
 * TICKET 149 (3e) — BAND TOLERANCE, measured on the current pool.
 *
 * `scratch/bandspread.ts` (ticket 121) gave the distribution summary. This extends it with the
 * lists the tolerance rule has to name: every card that is OUT OF BAND (beyond +/-15% of its cost
 * band's ceiling), every card that is outside the band window (`under..over`) but WITHIN the 15%
 * tolerance, and the under-band-by-more-than-15% set separately. The three drawback cards Henry
 * asked about (`desperate_strike`, `dark_pact`, `wither_feast`) are flagged wherever they land.
 *
 * Deviation is measured as `score / ceiling - 1` where ceiling = `budgetBandFor(cost).over`,
 * exactly as bandspread.ts does, so the two are comparable.
 *
 * Run: npx vite-node scratch/t149_tolerance.ts -- --out results/t149_tolerance
 */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';
import fs from 'node:fs';
import { arg } from './_env';

const OUT = arg('out', 'results/t149_tolerance');
const TOL = Number(arg('tol', '15'));
const DRAWBACK = new Set(['desperate_strike', 'dark_pact', 'wither_feast']);

interface Scored {
    id: string; cost: number; score: number; ceiling: number; under: number | null; pct: number;
    element: string; target: string; inWindow: boolean; drawback: boolean;
}

const rows: Scored[] = [];
const skipped: string[] = [];
for (const [id, raw] of Object.entries(ProgramRegistry)) {
    const card = raw as unknown as ProgramData & { isToken?: boolean; baseCost?: number | string; element?: string; target?: string };
    if (card.isToken) { skipped.push(`${id} (token)`); continue; }
    const cost = typeof card.baseCost === 'number' ? card.baseCost : null;
    if (cost === null) { skipped.push(`${id} (cost ${String(card.baseCost)})`); continue; }
    let res: { score: number; over: number; under: number | null };
    try { res = calculatePowerscale(card as ProgramData); } catch (e) { skipped.push(`${id} (threw: ${(e as Error).message})`); continue; }
    const band = budgetBandFor(cost);
    const ceiling = band.over;
    if (!Number.isFinite(ceiling) || ceiling <= 0) { skipped.push(`${id} (no ceiling)`); continue; }
    const score = res.score;
    rows.push({
        id, cost, score, ceiling, under: band.under, pct: (score / ceiling - 1) * 100,
        element: card.element ?? '?', target: card.target ?? 'Single',
        inWindow: score <= ceiling && (band.under === null || score >= band.under),
        drawback: DRAWBACK.has(id),
    });
}

rows.sort((a, b) => b.pct - a.pct);
const pcts = rows.map(r => r.pct);
const mean = pcts.reduce((s, x) => s + x, 0) / pcts.length;
const sd = Math.sqrt(pcts.reduce((s, x) => s + (x - mean) ** 2, 0) / pcts.length);
const sorted = [...pcts].sort((a, b) => a - b);
const med = (a: number[]) => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
const median = med(sorted);
const mad = med([...pcts.map(x => Math.abs(x - median))].sort((a, b) => a - b));
const absMedian = med([...pcts.map(Math.abs)].sort((a, b) => a - b));

const fmt = (r: Scored) => `| ${r.id}${r.drawback ? ' (drawback)' : ''} | ${r.cost}e | ${r.element} | ${r.target} | ${r.score.toFixed(1)} | ${r.ceiling.toFixed(1)} | ${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}% |`;
const header = '| card | cost | element | scope | score | ceiling | vs ceiling |\n|---|---|---|---|---|---|---|';

const overOut = rows.filter(r => r.pct > TOL);
const underOut = rows.filter(r => r.pct < -TOL);
const withinTol = rows.filter(r => !r.inWindow && Math.abs(r.pct) <= TOL);
const inWindow = rows.filter(r => r.inWindow);

const lines: string[] = [];
lines.push(`# Ticket 149 (3e) — band tolerance on the current pool`);
lines.push('');
lines.push(`Method: every non-token card with a numeric \`baseCost\` scored by \`calculatePowerscale\`; deviation = score / \`budgetBandFor(cost).over\` - 1 (same definition as \`scratch/bandspread.ts\`). Band window = \`under..over\` of the card's cost band. n = ${rows.length} cards (${skipped.length} skipped: tokens, X-cost, or no fixed band).`);
lines.push('');
lines.push(`## Distribution (score as % of band ceiling)`);
lines.push('');
lines.push(`| stat | value |\n|---|---|`);
lines.push(`| n | ${rows.length} |`);
lines.push(`| mean | ${mean.toFixed(1)}% |`);
lines.push(`| median | ${median.toFixed(1)}% |`);
lines.push(`| sd | ${sd.toFixed(1)}% |`);
lines.push(`| median absolute deviation (from median) | ${mad.toFixed(1)}% |`);
lines.push(`| median |deviation| from ceiling | ${absMedian.toFixed(1)}% |`);
lines.push(`| in band window (under..over) | ${inWindow.length} (${(inWindow.length / rows.length * 100).toFixed(1)}%) |`);
{
    // The same summary with the |dev| > 100% tail removed (score <= 0 or > 2x ceiling): those are
    // pricing failures, not noise, and they own most of the sd.
    const core = rows.filter(r => Math.abs(r.pct) <= 100).map(r => r.pct);
    const m = core.reduce((s, x) => s + x, 0) / core.length;
    const s2 = Math.sqrt(core.reduce((s, x) => s + (x - m) ** 2, 0) / core.length);
    const cs = [...core].sort((a, b) => a - b);
    const cmed = med(cs);
    const cmad = med([...core.map(x => Math.abs(x - cmed))].sort((a, b) => a - b));
    lines.push(`| TRIMMED (|dev| <= 100%, n=${core.length}): mean / median / sd / MAD | ${m.toFixed(1)}% / ${cmed.toFixed(1)}% / ${s2.toFixed(1)}% / ${cmad.toFixed(1)}% |`);
}
lines.push('');
lines.push(`| threshold | cards over | % of pool |\n|---|---|---|`);
for (const t of [0, 5, 15, 25, 50]) {
    const n = rows.filter(r => r.pct > t).length;
    lines.push(`| > +${t}% | ${n} | ${(n / rows.length * 100).toFixed(1)}% |`);
}
for (const t of [5, 15, 25, 50]) {
    const n = rows.filter(r => r.pct < -t).length;
    lines.push(`| < -${t}% | ${n} | ${(n / rows.length * 100).toFixed(1)}% |`);
}
lines.push('');
lines.push(`## OUT OF BAND — over the ceiling by more than +${TOL}% (${overOut.length})`);
lines.push('');
lines.push(header); for (const r of overOut) lines.push(fmt(r));
lines.push('');
lines.push(`## WITHIN TOLERANCE — outside the band window but within +/-${TOL}% (${withinTol.length})`);
lines.push('');
lines.push(header); for (const r of withinTol) lines.push(fmt(r));
lines.push('');
lines.push(`## UNDER BAND — below the ceiling by more than ${TOL}% (${underOut.length})`);
lines.push('');
lines.push(header); for (const r of underOut) lines.push(fmt(r));
lines.push('');
lines.push(`## Drawback cards`);
lines.push('');
lines.push(header);
for (const id of DRAWBACK) {
    const r = rows.find(x => x.id === id);
    lines.push(r ? fmt(r) + ` ${r.pct > TOL ? 'OUT (over)' : r.pct < -TOL ? 'OUT (under)' : r.inWindow ? 'in window' : 'within tolerance'}` : `| ${id} | — | — | — | not scored (see skipped) | | |`);
}
lines.push('');
lines.push(`## Skipped (${skipped.length})`);
lines.push('');
lines.push(skipped.join(', '));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/tolerance.json`, JSON.stringify({ tol: TOL, mean, median, sd, mad, absMedian, rows }, null, 1));
fs.writeFileSync(`${OUT}/FINDINGS.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
