/**
 * TICKET 134 - does a deck's field shift track how much of it is denominated in PERCENTAGES?
 *
 * Henry: *"I'm worried about the numbers we have using percentages instead of power."*
 *
 * The mechanism (scratch/pctvspower.ts): power-based damage does not read maxHp, while heals,
 * Burn, Poison and Regen are all a percentage OF maxHp. Ticket 131b multiplied every frame by 1.5,
 * so measured in fractions of a health bar the percentage effects held their value and attack cards
 * lost a third of theirs.
 *
 * If that is really what moved the grid, then a deck's field change should track its share of
 * percentage-denominated cards. This prints that correlation. It is the difference between "the
 * numbers moved" and "we know why they moved".
 *
 * Run: npx vite-node scratch/gridshift.ts
 */
import fs from 'node:fs';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

const reg = ProgramRegistry as unknown as Record<string, ProgramData>;

/** Is this card's payload denominated in a fraction of maxHp rather than in power? */
function isPercentDenominated(id: string): boolean {
    const c = reg[id];
    if (!c?.actions) return false;
    return c.actions.some(a =>
        a.type === 'HEAL'
        || (a.type === 'STATUS' && ['Burn', 'Poison', 'Regen'].includes((a as { status?: string }).status ?? '')));
}

const OLD: Record<string, number> = {};
const NEW: Record<string, number> = {};
for (const line of fs.readFileSync('/tmp/grid.log', 'utf8').split('\n')) {
    const m = line.match(/\]\s+(\S+)\s+field\s+([\d.]+)%\s+\(was\s+([\d.]+)%\)/);
    if (m) { NEW[m[1]] = Number(m[2]); OLD[m[1]] = Number(m[3]); }
}

interface Row { deck: string; pct: number; before: number; after: number; delta: number }
const rows: Row[] = [];
for (const deck of Object.keys(NEW)) {
    const species = deck.replace(/_v[12]$/, '');
    const list: string[] = (MingmingRegistry as Record<string, { decks: Record<string, string[]> }>)[species]?.decks?.[deck] ?? [];
    if (list.length === 0) continue;
    const pct = (list.filter(isPercentDenominated).length / list.length) * 100;
    rows.push({ deck, pct, before: OLD[deck], after: NEW[deck], delta: NEW[deck] - OLD[deck] });
}
rows.sort((a, b) => b.delta - a.delta);

console.log(`${rows.length} decks measured.\n`);
console.log('  delta   before   after   %-denominated cards   deck');
for (const r of rows) {
    const bar = '#'.repeat(Math.round(r.pct / 5));
    console.log(`  ${(r.delta >= 0 ? '+' : '') + r.delta.toFixed(1).padStart(5)}   ${r.before.toFixed(1).padStart(5)}   ${r.after.toFixed(1).padStart(5)}   `
        + `${r.pct.toFixed(0).padStart(3)}%  ${bar.padEnd(20)} ${r.deck}`);
}

// Pearson correlation between "share of percentage-denominated cards" and "field delta".
const n = rows.length;
const mx = rows.reduce((s, r) => s + r.pct, 0) / n;
const my = rows.reduce((s, r) => s + r.delta, 0) / n;
let num = 0, dx = 0, dy = 0;
for (const r of rows) { num += (r.pct - mx) * (r.delta - my); dx += (r.pct - mx) ** 2; dy += (r.delta - my) ** 2; }
const r = num / Math.sqrt(dx * dy);
console.log(`\n  mean share of %-denominated cards: ${mx.toFixed(1)}%`);
console.log(`  mean field delta:                  ${my >= 0 ? '+' : ''}${my.toFixed(1)} points`);
console.log(`  CORRELATION between the two:       r = ${r.toFixed(3)}`);
console.log(r > 0.5
    ? '  -> strong positive: the decks that gained are the ones paid in percentages. Henry was right.'
    : r > 0.25 ? '  -> weak positive: the mechanism is present but not the whole story.'
    : '  -> no clear relationship: something else moved these numbers, go looking.');
