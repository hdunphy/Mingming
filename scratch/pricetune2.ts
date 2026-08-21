/**
 * Ticket 103, round 2: the three riders all landed OVER because their host cards sit at the TOP of
 * their bands already (capacitor 6.3/6.5, purify 3.0/3.0, shrug_off 1.0/1.0 - zero headroom). So
 * pay for the rider by TRADING part of the existing payload instead of stacking on top of it.
 */
import PROGRAMS from '../src/engine/data/programs.json';
const P = PROGRAMS as unknown as Record<string, { baseCost: number; actions: unknown[] }>;
const { calculatePowerscale, budgetBandFor } = await import('../src/debug/balance/powerscale');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');

function show(label: string, id: string, actions: unknown[], cost?: number) {
    P[id].actions = actions; const reg = (ProgramRegistry as Record<string, any>)[id];
    reg.actions = actions;
    if (cost !== undefined) { P[id].baseCost = cost; reg.baseCost = cost; }
    const r = calculatePowerscale(reg); const b = budgetBandFor(reg.baseCost);
    const s = r.score ?? 0;
    console.error(`  ${label.padEnd(44)}${s.toFixed(1).padStart(6)}  band ${b.under}-${b.over}  ` +
        (s > b.over ? 'OVER' : s < b.under ? 'UNDER' : 'IN BAND'));
}
const S = (st: string, n: number, t = 'SELF') => ({ type: 'STATUS', status: st, stacks: n, target: t });

console.error('\ncapacitor (2e, base 6.3 = Energized 2)');
show('Energized 2 + Sharp 1', 'capacitor', [S('Energized', 2), S('Sharp', 1)]);
show('Energized 1 + Sharp 3', 'capacitor', [S('Energized', 1), S('Sharp', 3)]);
show('Energized 1 + Sharp 4', 'capacitor', [S('Energized', 1), S('Sharp', 4)]);
show('Energized 1 + Sharp 5', 'capacitor', [S('Energized', 1), S('Sharp', 5)]);
P.capacitor.actions = [S('Energized', 2)]; (ProgramRegistry as any).capacitor.actions = P.capacitor.actions;

console.error('\nsurge_protection (2e) - the other kraken candidate');
const SURGE = [{ type: 'ATTACK', power: 40, target: 'TARGET' },
    { type: 'ENERGY', amount: 1, target: 'SELF', conditionals: [{ id: 'card_drawn_check' }] }];
show('as printed', 'surge_protection', SURGE);
show('+ Sharp 2', 'surge_protection', [...SURGE, S('Sharp', 2)]);
show('power 30 + Sharp 3', 'surge_protection',
    [{ ...SURGE[0], power: 30 }, SURGE[1], S('Sharp', 3)]);

console.error('\npurify (1e, base 3.0 = shed 2 Poison + 2 Burn)');
const PUR = (pb: number, wd: number, sharp: number) => [
    S('Poison', -pb), S('Burn', -pb), S('Weakened', -wd), S('Dazed', -wd),
    ...(sharp ? [S('Sharp', sharp)] : [])];
show('shed 1 P/B, shed 2 W/D, no Sharp', 'purify', PUR(1, 2, 0));
show('shed 1 P/B, shed 3 W/D, no Sharp', 'purify', PUR(1, 3, 0));
show('shed 2 P/B, shed 3 W/D, 2 Sharp  @2e', 'purify', PUR(2, 3, 2), 2);
show('shed 2 P/B, shed 2 W/D, 2 Sharp  @2e', 'purify', PUR(2, 2, 2), 2);

console.error('\nshrug_off (0e, base 1.0 = shed 1 Dazed + 1 Weakened)');
show('shed 1 Dazed only + Sharp 1', 'shrug_off', [S('Dazed', -1), S('Sharp', 1)]);
show('shed 1 Dazed only + Sharp 2', 'shrug_off', [S('Dazed', -1), S('Sharp', 2)]);
show('shed 1 Weakened only + Sharp 2', 'shrug_off', [S('Weakened', -1), S('Sharp', 2)]);
show('no shed, Sharp 3', 'shrug_off', [S('Sharp', 3)]);
show('no shed, Sharp 4', 'shrug_off', [S('Sharp', 4)]);
