/**
 * TICKET 129, follow-up — are 0e cards over-priced as a class?
 *
 * Henry: *"Do we need to reduce the damage on 0e cards? maybe thats why zoo is so strong."*
 *
 * Ticket 129 answered the FIELD half of that and said no: 0e cards are 38-41% of every card cast and
 * that share barely moves when you add draw, so extra draw is not funnelling into free cards. What it
 * explicitly did NOT answer is whether the 39 of them are individually mispriced. This is that audit
 * - the band, not a field arm, which is the cheap and honest way to ask the question.
 *
 * The 0e band is 0.8-1.0, and it is the narrowest rung on the curve: at zero energy the cost factor
 * is `max(0.5, 0)^1.25`, so a 0e card has no denominator to hide in and small absolute errors read
 * as large percentages. Read the COUNT over band before reading any one card.
 *
 * Run: npx vite-node scratch/zeroaudit.ts
 */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { numericBaseCost } from '../src/engine/types';
import type { ProgramData } from '../src/engine/types';

const reg = ProgramRegistry as unknown as Record<string, ProgramData>;
const band = budgetBandFor(0);
const mid = (band.under + band.over) / 2;

// Which decks run each card, so an over-band card can be read against who actually holds it.
const holders = new Map<string, string[]>();
for (const [sp, def] of Object.entries(MingmingRegistry as Record<string, { availableOS: string[]; decks: Record<string, string[]> }>)) {
    if (sp === 'control') continue;
    for (const os of def.availableOS) for (const c of def.decks[os] ?? []) {
        const list = holders.get(c) ?? [];
        if (!list.includes(os)) list.push(os);
        holders.set(c, list);
    }
}

interface Row { id: string; score: number; pct: number; decks: string[] }
const rows: Row[] = [];
for (const [id, card] of Object.entries(reg)) {
    if (numericBaseCost(card.baseCost) !== 0) continue;
    if (card.isToken) continue;                       // tokens are not drafted or decked
    const score = calculatePowerscale(card).score;
    rows.push({ id, score, pct: ((score - mid) / mid) * 100, decks: holders.get(id) ?? [] });
}
rows.sort((a, b) => b.score - a.score);

const over = rows.filter(r => r.score > band.over);
const under = rows.filter(r => r.score < band.under);
console.log(`\n0e band ${band.under}-${band.over}.  ${rows.length} non-token 0e cards.`);
console.log(`  OVER band:  ${over.length}  (${((over.length / rows.length) * 100).toFixed(0)}%)`);
console.log(`  in band:    ${rows.length - over.length - under.length}`);
console.log(`  UNDER band: ${under.length}`);
const decked = rows.filter(r => r.decks.length > 0);
const overDecked = decked.filter(r => r.score > band.over);
console.log(`  of the ${decked.length} that a shipped deck actually runs, ${overDecked.length} are over band`);
const meanAbs = rows.reduce((s, r) => s + Math.abs(r.pct), 0) / rows.length;
console.log(`  mean absolute deviation from band centre: ${meanAbs.toFixed(1)}%`
    + `   (ticket 121 measured 10.0% across all 208 costed cards)`);

console.log('\n  score  vs mid   card                 decks that run it');
for (const r of rows) {
    const mark = r.score > band.over ? 'OVER ' : r.score < band.under ? 'under' : '  .  ';
    console.log(`  ${r.score.toFixed(2).padStart(5)}  ${(r.pct >= 0 ? '+' : '') + r.pct.toFixed(0) + '%'} ${mark} `
        + `${r.id.padEnd(20)}${r.decks.join(', ') || '(not in any deck)'}`);
}
