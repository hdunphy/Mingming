/** Ticket 101: find in-band printings for the two new cards, now that Regen's consume count is seeded. */
import PROGRAMS from '../src/engine/data/programs.json';
const P = PROGRAMS as unknown as Record<string, { baseCost: number; actions: Array<Record<string, unknown>> }>;
const { calculatePowerscale, budgetBandFor } = await import('../src/debug/balance/powerscale');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');

function show(id: string, cost: number, actions: unknown[], label: string) {
    P[id].actions = actions as Array<Record<string, unknown>>; P[id].baseCost = cost;
    const reg = (ProgramRegistry as Record<string, any>)[id];
    reg.actions = actions; reg.baseCost = cost;
    const s = calculatePowerscale(reg).score ?? 0;
    const b = budgetBandFor(cost);
    console.error(`  ${label.padEnd(30)}${s.toFixed(1).padStart(6)}  band ${b.under}-${b.over}  ` +
        (s > b.over ? 'OVER' : s < b.under ? 'UNDER' : 'IN BAND'));
}

console.error('\nmorning_dew - the battery');
for (const cost of [1, 2]) for (const st of [3, 4, 5, 6]) {
    show('morning_dew', cost, [{ type: 'STATUS', status: 'Regen', stacks: st, target: 'SELF' }],
        `${cost}e  gain ${st} Regen`);
}
console.error('\nmorning_dew with a small attack rider (Light, so it still reads as her card)');
for (const [cost, st, pw] of [[1, 3, 10], [1, 4, 5], [2, 5, 20], [2, 6, 15]] as number[][]) {
    show('morning_dew', cost, [
        { type: 'ATTACK', power: pw, target: 'TARGET' },
        { type: 'STATUS', status: 'Regen', stacks: st, target: 'SELF' },
    ], `${cost}e  ${pw} power + ${st} Regen`);
}

console.error('\ndrink_deep - the payoff (consume all Regen, N power per stack)');
for (const cost of [2, 3]) for (const pw of [10, 15, 20, 25]) {
    show('drink_deep', cost, [
        { type: 'STATUS', status: 'Regen', consume: true, target: 'SELF' },
        { type: 'ATTACK', power: pw, scaling: 'STATUS_CONSUMED', target: 'TARGET' },
    ], `${cost}e  ${pw} power per stack`);
}
