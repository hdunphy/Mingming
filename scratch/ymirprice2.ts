/**
 * Ticket 106 round 2: `bracing_cold` is the only card in ymir_v2's deck that no other deck runs, so
 * it is the only one that can be moved without collateral. It sits at 2.9 against a 3.0 ceiling -
 * zero headroom for the stack raise the ticket asks for.
 *
 * The way out is the cost. GLACIAL_PACE lets him play ONE card a turn on a 2-Energy frame, so
 * Energy is not a real constraint for this deck: moving a card from 1e to 2e costs him nothing he
 * was using, and it opens the budget band from 2.4-3.0 to 5.2-6.5.
 */
import PROGRAMS from '../src/engine/data/programs.json';
const P = PROGRAMS as unknown as Record<string, { baseCost: number; actions: Array<Record<string, unknown>> }>;
const { calculatePowerscale, budgetBandFor } = await import('../src/debug/balance/powerscale');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');

function show(cost: number, pw: number, st: number) {
    const actions = [
        { type: 'ATTACK', power: pw, target: 'TARGET' },
        { type: 'STATUS', status: 'Strengthened', stacks: st, target: 'SELF' },
    ];
    P.bracing_cold.actions = actions; P.bracing_cold.baseCost = cost;
    const reg = (ProgramRegistry as Record<string, any>).bracing_cold;
    reg.actions = actions; reg.baseCost = cost;
    const s = calculatePowerscale(reg).score ?? 0;
    const b = budgetBandFor(cost);
    console.error(`  ${cost}e  ${String(pw).padStart(2)} power + ${String(st).padStart(2)} Str   ` +
        `${s.toFixed(1).padStart(6)}  band ${b.under}-${b.over}  ` +
        (s > b.over ? 'OVER' : s < b.under ? 'UNDER' : 'IN BAND'));
}

console.error('\nbracing_cold at 2 Energy - the band opens to 5.2-6.5');
for (const [pw, st] of [[15, 8], [15, 9], [15, 10], [20, 8], [20, 9], [25, 7], [25, 8], [30, 6], [30, 7]] as number[][]) show(2, pw, st);
console.error('\nfor reference, at 1 Energy (band 2.4-3.0)');
for (const [pw, st] of [[15, 3], [15, 4], [10, 5]] as number[][]) show(1, pw, st);
