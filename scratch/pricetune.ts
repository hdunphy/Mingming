/**
 * Ticket 103: find the parameter value that lands each edited card INSIDE its budget band.
 *
 * The first cut of all four edits priced OVER: `momentum_crash` 8.4 against a 3 band,
 * `purify` 6.5 against 3, `capacitor` 7.2 against 6.5, `shrug_off` 1.9 against 1. Four new
 * redlines to fix five decks is a bad trade, so this sweeps each knob against the pricer - which
 * is deterministic and instant - and only the surviving values go to the sim.
 */
import PROGRAMS from '../src/engine/data/programs.json';

const P = PROGRAMS as unknown as Record<string, { baseCost: number; actions: unknown[] }>;
const BASE = JSON.parse(JSON.stringify(PROGRAMS)) as Record<string, { baseCost: number; actions: unknown[] }>;

const { calculatePowerscale, budgetBandFor } = await import('../src/debug/balance/powerscale');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');

function score(id: string): { s: number; verdict: string; band: string } {
    const card = (ProgramRegistry as Record<string, any>)[id];
    const r = calculatePowerscale(card);
    const b = budgetBandFor(card.baseCost as number);
    const s = r.score ?? 0;
    return {
        s,
        verdict: s > b.over ? 'OVER' : s < b.under ? 'UNDER' : 'IN BAND',
        band: `${b.under}-${b.over}`,
    };
}

/** ProgramRegistry resolves off the same JSON object, so mutating it re-prices in place. */
function set(id: string, actions: unknown[], cost?: number) {
    P[id].actions = actions;
    if (cost !== undefined) P[id].baseCost = cost;
    const reg = (ProgramRegistry as Record<string, any>)[id];
    reg.actions = actions;
    if (cost !== undefined) reg.baseCost = cost;
}
const reset = (id: string) => set(id, JSON.parse(JSON.stringify(BASE[id].actions)), BASE[id].baseCost);

console.error('\nmomentum_crash - consume the pile, N power per stack consumed');
for (const cost of [1, 2]) for (const power of [4, 5, 6, 8, 10, 12, 15]) {
    set('momentum_crash', [
        { type: 'STATUS', status: 'Strengthened', consume: true, target: 'SELF' },
        { type: 'ATTACK', power, scaling: 'STATUS_CONSUMED', target: 'TARGET' },
    ], cost);
    const r = score('momentum_crash');
    console.error(`  ${cost}e power ${String(power).padStart(2)}   ${r.s.toFixed(1).padStart(6)}  band ${r.band}  ${r.verdict}`);
}
reset('momentum_crash');

console.error('\ncapacitor - Energized 2 plus N Sharp');
for (const n of [1, 2, 3]) {
    set('capacitor', [
        { type: 'STATUS', status: 'Energized', stacks: 2, target: 'SELF' },
        { type: 'STATUS', status: 'Sharp', stacks: n, target: 'SELF' },
    ]);
    const r = score('capacitor');
    console.error(`  Sharp ${n}   ${r.s.toFixed(1).padStart(6)}  band ${r.band}  ${r.verdict}`);
}
reset('capacitor');

console.error('\npurify - shed Poison/Burn 2, plus shed N Weakened/Dazed, plus M Sharp');
for (const shed of [2, 3]) for (const sharp of [0, 1, 2]) {
    set('purify', [
        { type: 'STATUS', status: 'Poison', stacks: -2, target: 'SELF' },
        { type: 'STATUS', status: 'Burn', stacks: -2, target: 'SELF' },
        { type: 'STATUS', status: 'Weakened', stacks: -shed, target: 'SELF' },
        { type: 'STATUS', status: 'Dazed', stacks: -shed, target: 'SELF' },
        ...(sharp ? [{ type: 'STATUS', status: 'Sharp', stacks: sharp, target: 'SELF' }] : []),
    ]);
    const r = score('purify');
    console.error(`  shed ${shed} sharp ${sharp}   ${r.s.toFixed(1).padStart(6)}  band ${r.band}  ${r.verdict}`);
}
reset('purify');

console.error('\nshrug_off - shed 1 Dazed / 1 Weakened, plus N Sharp');
for (const n of [1, 2, 3]) {
    set('shrug_off', [
        { type: 'STATUS', status: 'Dazed', stacks: -1, target: 'SELF' },
        { type: 'STATUS', status: 'Weakened', stacks: -1, target: 'SELF' },
        { type: 'STATUS', status: 'Sharp', stacks: n, target: 'SELF' },
    ]);
    const r = score('shrug_off');
    console.error(`  Sharp ${n}   ${r.s.toFixed(1).padStart(6)}  band ${r.band}  ${r.verdict}`);
}
reset('shrug_off');

console.error('\nglass_cannon - N power, 20 recoil (currently -5.1 UNDER, the worst in the registry)');
for (const power of [45, 55, 60, 65, 70]) {
    set('glass_cannon', [
        { type: 'ATTACK', power, target: 'TARGET' },
        { type: 'ATTACK', power: 15, target: 'SELF', damageOverride: 20 },
    ]);
    const r = score('glass_cannon');
    console.error(`  power ${power}   ${r.s.toFixed(1).padStart(6)}  band ${r.band}  ${r.verdict}`);
}
reset('glass_cannon');
