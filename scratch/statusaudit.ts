/**
 * EVERY STATUS APPLIER AGAINST ITS BAND — Henry, 2026-09-07: *"if everything status applier is off
 * we need to fix that now."*
 *
 * That instruction followed a claim of mine that turned out to be WRONG, and this instrument is how
 * the claim gets checked instead of repeated. I read the "Status prices" table at the top of
 * `docs/power_curve_spec.md` — Strengthened/Dazed at 15 power a stack, annotated "2%/stack, 25%
 * cap" — noticed the engine has shipped ticket 102's uncapped POWER shape since, and concluded the
 * whole price table lagged the engine. It does not. The spec is APPEND-ONLY: rev 3.4 (ticket 28)
 * repriced the stream statuses 15 -> 5 and 10 -> 3.5 further down the same file, and ticket 102
 * re-derived the POWER shape to the same 5 from the other direction (`powerPerStack` x a 5-attack
 * horizon). `powerscale.ts` reads `STATUS_MODEL` directly, so the scorer cannot lag the engine.
 *
 * What is left is the question Henry actually asked, and it is answerable: score every card that
 * applies a status and report which sit outside their budget band, split by whether the status IS
 * the card or merely rides on it. A pure-status card that scores under band is the shape ticket
 * 29's "status top-up" existed to fix, so a fresh crop of them would be the real regression.
 *
 *   npx vite-node scratch/statusaudit.ts            # off-band only
 *   npx vite-node scratch/statusaudit.ts --all      # every applier
 */
import { calculatePowerscale, BUDGET_BANDS, BUFFS, DEBUFFS } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { STATUS_MODEL } from '../src/engine/core/Hooks';
import type { ProgramData } from '../src/engine/types';

const ALL = ((globalThis as unknown as { process?: { argv?: string[] } }).process?.argv ?? []).includes('--all');
const band = (cost: number) => BUDGET_BANDS.find(b => b.cost === cost) ?? BUDGET_BANDS[BUDGET_BANDS.length - 1];
const KNOWN = new Set([...BUFFS, ...DEBUFFS]);

interface Row {
    id: string; cost: number; score: number; lo: number; hi: number; delta: number;
    statuses: string; pure: boolean;
}
const rows: Row[] = [];

for (const [id, data] of Object.entries(ProgramRegistry as Record<string, ProgramData>)) {
    const actions = data.actions ?? [];
    const applied = actions.filter(a => a.type === 'STATUS' && (a.stacks ?? 0) > 0 && a.status);
    if (applied.length === 0) continue;
    const cost = typeof data.baseCost === 'number' ? data.baseCost : NaN;
    if (!Number.isFinite(cost)) continue;               // X-cost cards have no fixed band
    const { score } = calculatePowerscale(data);
    if (score === undefined || Number.isNaN(score)) continue;

    const b = band(cost);
    const delta = score > b.over ? score - b.over : score < b.under ? score - b.under : 0;
    // "Pure": the status IS the card. Anything that also deals damage, heals, draws or generates is
    // a hybrid, and a hybrid under band is a statement about its other half, not about statuses.
    const pure = actions.every(a => a.type === 'STATUS' || a.type === 'REMOVE_STATUS');
    rows.push({
        id, cost, score, lo: b.under, hi: b.over, delta, pure,
        statuses: [...new Set(applied.map(a => `${a.status}${KNOWN.has(a.status as string) ? '' : '?'}`))].join('+'),
    });
}

const shown = ALL ? rows : rows.filter(r => r.delta !== 0);
shown.sort((a, b) => a.delta - b.delta);

console.log(`STATUS_MODEL: shape=${STATUS_MODEL.shape} powerPerStack=${STATUS_MODEL.powerPerStack}`
    + ` (pctPerStack=${STATUS_MODEL.pctPerStack} cap=${STATUS_MODEL.pctCap} — inert under POWER)`);
console.log(`${rows.length} cards apply a status. ${rows.filter(r => r.pure).length} are pure-status.`);
console.log(`${rows.filter(r => r.delta < 0).length} under band, ${rows.filter(r => r.delta > 0).length} over.\n`);
console.log('card                     cost  score   band          delta  kind    statuses');
for (const r of shown) {
    console.log(`${r.id.padEnd(24)} ${r.cost}e  ${r.score.toFixed(2).padStart(5)}`
        + `  ${r.lo.toFixed(1)}–${r.hi.toFixed(1)}`.padEnd(14)
        + `${(r.delta > 0 ? '+' : '') + r.delta.toFixed(2)}`.padStart(7)
        + `  ${(r.pure ? 'pure' : 'hybrid').padEnd(6)}  ${r.statuses}`);
}
