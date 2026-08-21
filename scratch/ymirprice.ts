/** Ticket 106: price ymir_v2's build cards against their bands as the stack counts rise. */
import PROGRAMS from '../src/engine/data/programs.json';
const P = PROGRAMS as unknown as Record<string, { baseCost: number; actions: Array<Record<string, unknown>> }>;
const { calculatePowerscale, budgetBandFor } = await import('../src/debug/balance/powerscale');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');

function price(id: string): string {
    const c = (ProgramRegistry as Record<string, any>)[id];
    const s = calculatePowerscale(c).score ?? 0;
    const b = budgetBandFor(c.baseCost);
    return `${s.toFixed(1).padStart(6)}  band ${b.under}-${b.over}  ` +
        (s > b.over ? 'OVER' : s < b.under ? 'UNDER' : 'IN BAND');
}
function set(id: string, mut: (a: Array<Record<string, unknown>>) => void) {
    const copy = JSON.parse(JSON.stringify(P[id].actions));
    mut(copy);
    P[id].actions = copy;
    (ProgramRegistry as Record<string, any>)[id].actions = copy;
}

console.error('\nbracing_cold (1e, printed 15 power + N Strengthened)');
for (const [pw, st] of [[15, 3], [15, 6], [15, 8], [15, 10], [20, 6], [25, 5], [25, 8], [30, 4]] as number[][]) {
    set('bracing_cold', a => {
        (a.find(x => x.type === 'ATTACK') as { power: number }).power = pw;
        (a.find(x => x.type === 'STATUS') as { stacks: number }).stacks = st;
    });
    console.error(`  ${pw} power + ${String(st).padStart(2)} Str   ${price('bracing_cold')}`);
}

console.error('\nnumbing_gale (1e, printed 20 power + N Dazed on target)');
for (const st of [2, 3, 4, 5, 6]) {
    set('numbing_gale', a => { (a.find(x => x.type === 'STATUS') as { stacks: number }).stacks = st; });
    console.error(`  20 power + ${st} Dazed   ${price('numbing_gale')}`);
}

console.error('\nthaw (1e, printed 8 power + N Str + N Sharp)');
for (const st of [3, 5, 6, 8]) {
    set('thaw', a => { for (const x of a) if (x.type === 'STATUS') (x as { stacks: number }).stacks = st; });
    console.error(`  8 power + ${st} Str/Sharp   ${price('thaw')}`);
}

console.error('\nice_spear (1e, printed 22 power + N Weakened on target)');
for (const st of [1, 2, 3]) {
    set('ice_spear', a => { (a.find(x => x.type === 'STATUS') as { stacks: number }).stacks = st; });
    console.error(`  22 power + ${st} Weakened   ${price('ice_spear')}`);
}
