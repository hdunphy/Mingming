/**
 * THE LEDGER PRINTER — ticket 149c.
 *
 * Every row of 149c reprices something, and §4.6 rules that *"a card that moves under an honest
 * price is reported, never auto-tuned"*. This prints the report: every card's score, the band its
 * cost is budgeted against, and how far over or under that band it sits.
 *
 * To build a before/after ledger for a row, run it before the change and after it and diff:
 *
 *     npx vite-node scratch/t149c_draw20.ts > /tmp/before.tsv
 *     ...make the change...
 *     npx vite-node scratch/t149c_draw20.ts > /tmp/after.tsv
 *     diff <(cut -f1,2 /tmp/before.tsv) <(cut -f1,2 /tmp/after.tsv)
 *
 * Named for 149c-2 because that is the row that needed it first; it is not draw-specific.
 *
 * TSV rather than a formatted table on purpose — the formatting belongs in whatever reads it, and
 * a column layout would make the diff above useless.
 */
import { getInflatedProgramRegistry } from '../src/engine/data/programRegistry';
import { budgetBandFor, calculatePowerscale } from '../src/debug/balance/powerscale';
import { numericBaseCost } from '../src/engine/types';

console.log(['id', 'score', 'cost', 'band', 'pctVsBand'].join('\t'));

const all = Object.values(getInflatedProgramRegistry());
for (const card of all.sort((a, b) => a.id.localeCompare(b.id))) {
    const { score } = calculatePowerscale(card);
    const cost = numericBaseCost(card.baseCost);
    const band = budgetBandFor(cost).over;
    const pct = Math.round(((score - band) / band) * 100);
    console.log([card.id, score, cost, band, pct].join('\t'));
}
