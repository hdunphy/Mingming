/**
 * Ticket 102: every card against its budget band, over AND under.
 *
 * The balance report only surfaces cards OVER budget - they are the redlines. Henry asked for both
 * ends, and the under-budget end is where a re-denomination is most likely to leave something
 * stranded: a card whose whole payload is a status that used to be capped.
 */
import { calculatePowerscale, BUDGET_BANDS } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

const band = (cost: number) => BUDGET_BANDS.find(b => b.cost === cost) ?? BUDGET_BANDS[BUDGET_BANDS.length - 1];

interface Row { id: string; cost: number; score: number; over: number; under: number; delta: number; kind: string }
const rows: Row[] = [];
for (const [id, data] of Object.entries(ProgramRegistry as Record<string, ProgramData>)) {
    const cost = typeof data.baseCost === 'number' ? data.baseCost : NaN;
    if (!Number.isFinite(cost)) continue;                 // X-cost cards have no fixed band
    const result = calculatePowerscale(data);
    if (result.score === undefined || Number.isNaN(result.score)) continue;
    const b = band(cost);
    const delta = result.score > b.over ? result.score - b.over
        : result.score < b.under ? result.score - b.under
        : 0;
    rows.push({ id, cost, score: result.score, over: b.over, under: b.under, delta,
        kind: delta > 0 ? 'OVER' : delta < 0 ? 'UNDER' : 'in band' });
}

const over = rows.filter(r => r.kind === 'OVER').sort((a, b) => b.delta - a.delta);
const under = rows.filter(r => r.kind === 'UNDER').sort((a, b) => a.delta - b.delta);
console.error(`${rows.length} priced cards: ${over.length} OVER, ${under.length} UNDER, ${rows.length - over.length - under.length} in band\n`);
console.error('MOST OVER BUDGET');
for (const r of over.slice(0, 20)) console.error(`  ${r.id.padEnd(24)}${r.cost}e  score ${r.score.toFixed(1).padStart(6)}  band ${r.under}-${r.over}   +${r.delta.toFixed(1)}`);
console.error('\nMOST UNDER BUDGET');
for (const r of under.slice(0, 20)) console.error(`  ${r.id.padEnd(24)}${r.cost}e  score ${r.score.toFixed(1).padStart(6)}  band ${r.under}-${r.over}   ${r.delta.toFixed(1)}`);
for (const r of [...over, ...under]) console.error(`CSV,${r.id},${r.cost},${r.score.toFixed(2)},${r.under},${r.over},${r.delta.toFixed(2)},${r.kind}`);
