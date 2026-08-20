/** Ticket 103: price just the cards this ticket edited, against their bands. */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

for (const id of (process.env.CARDS ?? 'momentum_crash,capacitor,purify,shrug_off,glass_cannon').split(',')) {
    const card = (ProgramRegistry as Record<string, ProgramData>)[id];
    const r = calculatePowerscale(card);
    const b = budgetBandFor(card.baseCost as number);
    const verdict = (r.score ?? 0) > b.over ? 'OVER' : (r.score ?? 0) < b.under ? 'UNDER' : 'in band';
    console.error(`  ${id.padEnd(18)}${card.baseCost}e  score ${(r.score ?? 0).toFixed(1).padStart(6)}  band ${b.under}-${b.over}   ${verdict}`);
}
