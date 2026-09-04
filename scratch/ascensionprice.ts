/**
 * TICKET 113 — price a NON-EXHAUST `ascension` on the curve before measuring it.
 *
 * Henry: *"can we just redesign the 2e exhaust card to not be so strong and remove exhaust?"* — which
 * is the knob my first sweep skipped entirely. Every previous arm either kept `ascension` as printed
 * or swapped it for `supernova_v2` (108 power), so "the same card, non-exhaust, re-costed down" was
 * never tested.
 *
 * PRICE IT BEFORE MEASURING IT, per the repo's habit: the 2e budget band is **5.2 under / 6.5 over**,
 * and the scorer gives exhaust only a **x0.9 discount** (`powerscale.ts:956`) — so dropping exhaust
 * raises a card's score by about 11%, no more. That is a much smaller correction than "supernova is
 * too strong" implied, and it means the power give-back needed is small.
 *
 * This sweeps `ascension` at its printed shape (50 power + 2 Strengthened + 2 Sharp) with exhaust
 * removed, walking the attack power down IN FIVES per Henry's rule, and prints where each variant
 * lands against the band. Nothing is measured or mutated permanently — this is the ledger step, and
 * `valkarms.ts` runs the arms it picks out.
 *
 * Run: npx vite-node scratch/ascensionprice.ts
 */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

const band = budgetBandFor(2);
const printed = ProgramRegistry['ascension'] as unknown as ProgramData;

/** Build a variant of ascension: attack power `power`, exhaust on or off. */
function variant(power: number, exhaust: boolean): ProgramData {
    const c = JSON.parse(JSON.stringify(printed)) as ProgramData;
    (c as unknown as Record<string, unknown>).exhaust = exhaust;
    for (const a of c.actions ?? []) {
        if ((a as { type?: string }).type === 'ATTACK') (a as { power?: number }).power = power;
    }
    return c;
}

const verdict = (score: number): string =>
    score > band.over ? `OVER  (band ${band.under}-${band.over})`
        : score < band.under ? `under (band ${band.under}-${band.over})`
            : `IN BAND (${band.under}-${band.over})`;

console.log(`2e budget band: under ${band.under} / over ${band.over}`);
console.log(`exhaust discount in the scorer: x0.9 — so removing it costs about 11% of headroom\n`);

const asPrinted = calculatePowerscale(variant(50, true));
console.log(`PRINTED   50 power, exhaust      score ${asPrinted.score.toFixed(1)}  ` +
    `(dmg ${asPrinted.damagePortion.toFixed(1)} / status ${asPrinted.statusPortion.toFixed(1)})  ${verdict(asPrinted.score)}`);
const noExhaust = calculatePowerscale(variant(50, false));
console.log(`SAME, no exhaust                 score ${noExhaust.score.toFixed(1)}  ${verdict(noExhaust.score)}\n`);

console.log('walking the attack power down in FIVES, exhaust REMOVED:');
let best: { power: number; score: number } | null = null;
for (let power = 50; power >= 20; power -= 5) {
    const r = calculatePowerscale(variant(power, false));
    const mark = r.score <= band.over && r.score >= band.under ? '  <-- in band' : '';
    console.log(`  ${String(power).padStart(3)} power   score ${r.score.toFixed(1)}   ` +
        `(dmg ${r.damagePortion.toFixed(1)} / status ${r.statusPortion.toFixed(1)})${mark}`);
    if (!best && r.score <= band.over) best = { power, score: r.score };
}

console.log(best
    ? `\nHighest power that is not OVER band, without exhaust: ${best.power} (score ${best.score.toFixed(1)}).`
    : '\nNo power in the swept range lands under the band ceiling — the STATUS half is carrying it.');
console.log('\nNote: the 2 Strengthened + 2 Sharp are priced as the status portion above. If the status');
console.log('half alone pushes the card over, the power dial cannot fix it and the stacks are the knob.');
