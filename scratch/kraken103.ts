/** Ticket 103: can kraken_v2's Sharp live on a card that stays INSIDE its budget band? */
import PROGRAMS from '../src/engine/data/programs.json';
import { ENV } from './_env';
const P = PROGRAMS as unknown as Record<string, { baseCost: number; actions: unknown[] }>;
const S = (st: string, n: number) => ({ type: 'STATUS', status: st, stacks: n, target: 'SELF' });
const ARM = ENV.ARM ?? 'W0';
const SURGE = [{ type: 'ATTACK', power: 40, target: 'TARGET' },
    { type: 'ENERGY', amount: 1, target: 'SELF', conditionals: [{ id: 'card_drawn_check' }] }];

switch (ARM) {
    case 'W0': break;                                    // as shipped: capacitor + 3 Sharp (7.2, +0.7)
    case 'W1':                                           // Sharp moved to surge_protection, in band
        P.capacitor.actions = [S('Energized', 2)];
        P.surge_protection.actions = [{ ...SURGE[0], power: 30 }, SURGE[1], S('Sharp', 3)];
        break;
    case 'W2':                                           // both, in-band surge + capacitor Sharp 1
        P.capacitor.actions = [S('Energized', 2), S('Sharp', 1)];
        P.surge_protection.actions = [{ ...SURGE[0], power: 30 }, SURGE[1], S('Sharp', 3)];
        break;
}
const { calculatePowerscale, budgetBandFor } = await import('../src/debug/balance/powerscale');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');
for (const id of ['capacitor', 'surge_protection']) {
    const c = (ProgramRegistry as Record<string, any>)[id];
    const s = calculatePowerscale(c).score ?? 0; const b = budgetBandFor(c.baseCost);
    console.error(`  price ${id.padEnd(18)}${s.toFixed(1).padStart(6)}  band ${b.under}-${b.over}  ` +
        (s > b.over ? 'OVER' : s < b.under ? 'UNDER' : 'IN BAND'));
}
const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== 'kraken')
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
let sum = 0, dead = 0; const cells: number[] = [];
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: 'kraken', enemy: o.sp, playerOS: 'kraken_v2', enemyOS: o.deck, seed: `grid:kraken_v2:${o.deck}`,
    }), { iterations: Number(ENV.ITER ?? 10) });
    sum += r.pooled.decisiveWinRate; dead += r.pooled.deadCardRatio; cells.push(r.pooled.decisiveWinRate * 100);
}
const n = opponents.length;
console.error(`kraken_v2 ${ARM}  field ${((sum / n) * 100).toFixed(1)}%  dead ${((dead / n) * 100).toFixed(1)}%` +
    `  absolutes ${cells.filter(c => c >= 100 || c <= 0).length}`);
