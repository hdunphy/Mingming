/**
 * TICKET 134 - what actually moved the grid? Test the candidates instead of assuming.
 *
 * `scratch/gridshift.ts` tested Henry's percentage-vs-power hypothesis and got r = 0.298 - present,
 * but nowhere near the whole story. Decks with NO percentage cards at all moved +15.6 and -24.3.
 * So this tests the other two things ticket 131b changed, against the same field deltas.
 */
import fs from 'node:fs';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { numericBaseCost } from '../src/engine/types';
import type { ProgramData } from '../src/engine/types';

const reg = ProgramRegistry as unknown as Record<string, ProgramData>;
const OLD: Record<string, number> = {}, NEW: Record<string, number> = {};
for (const line of fs.readFileSync('/tmp/grid.log', 'utf8').split('\n')) {
    const m = line.match(/\]\s+(\S+)\s+field\s+([\d.]+)%\s+\(was\s+([\d.]+)%\)/);
    if (m) { NEW[m[1]] = Number(m[2]); OLD[m[1]] = Number(m[3]); }
}
const pearson = (xs: number[], ys: number[]): number => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    return num / Math.sqrt(dx * dy);
};

interface R { deck: string; delta: number; zeroShare: number; avgCost: number; pctShare: number }
const rows: R[] = [];
for (const deck of Object.keys(NEW)) {
    const sp = deck.replace(/_v[12]$/, '');
    const list: string[] = (MingmingRegistry as Record<string, { decks: Record<string, string[]> }>)[sp]?.decks?.[deck] ?? [];
    if (!list.length) continue;
    const costs = list.map(id => numericBaseCost(reg[id]?.baseCost ?? 1));
    rows.push({
        deck, delta: NEW[deck] - OLD[deck],
        zeroShare: (costs.filter(c => c === 0).length / list.length) * 100,
        avgCost: costs.reduce((a, b) => a + b, 0) / list.length,
        pctShare: (list.filter(id => (reg[id]?.actions ?? []).some(a =>
            a.type === 'HEAL' || (a.type === 'STATUS' && ['Burn', 'Poison', 'Regen']
                .includes((a as { status?: string }).status ?? '')))).length / list.length) * 100,
    });
}
const d = rows.map(r => r.delta);
console.log(`\n${rows.length} decks. What correlates with the field shift?\n`);
console.log(`  share of 0-cost cards      r = ${pearson(rows.map(r => r.zeroShare), d).toFixed(3)}`);
console.log(`  AVERAGE CARD COST          r = ${pearson(rows.map(r => r.avgCost), d).toFixed(3)}`);
console.log(`  share of %-denominated     r = ${pearson(rows.map(r => r.pctShare), d).toFixed(3)}`);

console.log('\n  delta   avg cost   0e%   %-denom   deck');
for (const r of [...rows].sort((a, b) => b.delta - a.delta)) {
    console.log(`  ${(r.delta >= 0 ? '+' : '') + r.delta.toFixed(1).padStart(5)}   `
        + `${r.avgCost.toFixed(2).padStart(4)}      ${r.zeroShare.toFixed(0).padStart(3)}%   ${r.pctShare.toFixed(0).padStart(3)}%    ${r.deck}`);
}

// The headline nobody should miss: how badly is the roster dispersed now?
const inBand = (v: number) => v >= 35 && v <= 65;
const before = Object.values(OLD), after = Object.values(NEW);
const sd = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
console.log(`\n  IN BAND (35-65%)   before ${before.filter(inBand).length}/32   after ${after.filter(inBand).length}/32`);
console.log(`  spread             before ${Math.min(...before).toFixed(1)}-${Math.max(...before).toFixed(1)}   after ${Math.min(...after).toFixed(1)}-${Math.max(...after).toFixed(1)}`);
console.log(`  standard deviation before ${sd(before).toFixed(1)}   after ${sd(after).toFixed(1)}`);
