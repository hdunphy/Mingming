/**
 * THE DAEMON LEDGER — ticket 149c-6.
 *
 * Prints every daemon's score with its two hook columns and the build-around index (§4.4), so the
 * effect of replacing `EXPECTED_DAEMON_PROCS` with per-trigger measured rates is a table rather
 * than an assertion.
 *
 * Run: npx vite-node scratch/t149c_daemons.ts
 */
import { calculatePowerscale, budgetBandFor, classifyHook, hooksOf } from '../src/debug/balance/powerscale';
import { getInflatedProgramRegistry } from '../src/engine/data/programRegistry';
import { numericBaseCost } from '../src/engine/types';

const daemons = Object.values(getInflatedProgramRegistry()).filter(c => c.category === 'Daemon');
console.log(`${'daemon'.padEnd(22)} ${'e'} ${'score'.padStart(6)} ${'band'.padStart(5)} ${'floor'.padStart(6)} ${'ceil'.padStart(6)} ${'x'.padStart(5)}  trigger classes`);
for (const card of daemons) {
    const s = calculatePowerscale(card);
    const cost = numericBaseCost(card.baseCost);
    const band = budgetBandFor(cost).over;
    const idx = s.hookFloor > 0 ? (s.hookCeiling / s.hookFloor).toFixed(1) : '-';
    const classes = hooksOf(card).map(h => classifyHook(h) ?? `?${h.trigger}`).join(',');
    console.log(`${card.id.padEnd(22)} ${cost} ${String(s.score).padStart(6)} ${String(band).padStart(5)} `
        + `${String(s.hookFloor).padStart(6)} ${String(s.hookCeiling).padStart(6)} ${idx.padStart(5)}  ${classes}`
        + (s.manualReview.length ? `   [${s.manualReview.join(' ')}]` : ''));
}
