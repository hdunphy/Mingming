/**
 * TICKET 129 - price the cards Henry called out, and the candidate rewrites, against their bands.
 *
 * `scratch/pricecards.ts` does this already and reads its card list from `ENV`, which under
 * vite-node is empty - so it has been silently pricing its own default list. Flags, per the repo's
 * stated convention.
 *
 * Variants are declared inline rather than edited into `programs.json`, so nothing in the registry
 * moves until Henry rules. `GetProgramData` inflates a fresh object per call (ticket note: mutate
 * `ProgramRegistry`, not the copy), so these are built as literals off the real card.
 *
 * Run: npx vite-node scratch/pricewhat.ts
 */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

const reg = ProgramRegistry as unknown as Record<string, ProgramData>;

function show(label: string, card: ProgramData): void {
    const r = calculatePowerscale(card);
    const cost = typeof card.baseCost === 'number' ? card.baseCost : 2;
    const b = budgetBandFor(cost);
    const v = r.score > b.over ? 'OVER ' : r.score < b.under ? 'UNDER' : ' in  ';
    const pct = ((r.score - (b.under + b.over) / 2) / ((b.under + b.over) / 2)) * 100;
    console.log(`  ${label.padEnd(42)}${cost}e  ${r.score.toFixed(1).padStart(6)}   band ${b.under}-${b.over}  ${v} ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`);
}

const v = (base: string, over: Partial<ProgramData>): ProgramData => ({ ...reg[base], ...over } as ProgramData);
const acts = (base: string) => [...reg[base].actions];

console.log('\nAS PRINTED');
for (const id of ['whirlpool_v2', 'pressure_point', 'ink_stream', 'undertow', 'maelstrom', 'feedback_loop_daemon']) {
    show(id, reg[id]);
}

console.log('\nWHIRLPOOL CANDIDATES  (today: 1e, 8 power, draw 1)');
show('+ 1 Dazed to the SIDE', v('whirlpool_v2', {
    target: 'Side',
    actions: [...acts('whirlpool_v2'), { type: 'STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' }] as never,
}));
show('+ 1 Weakened to the SIDE', v('whirlpool_v2', {
    target: 'Side',
    actions: [...acts('whirlpool_v2'), { type: 'STATUS', status: 'Weakened', stacks: 1, target: 'TARGET' }] as never,
}));
show('+ 1 Dazed, single target', v('whirlpool_v2', {
    actions: [...acts('whirlpool_v2'), { type: 'STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' }] as never,
}));
show('power 8 -> 15, no rider', v('whirlpool_v2', {
    actions: [{ type: 'ATTACK', power: 15, target: 'TARGET' }, { type: 'DRAW', amount: 1, target: 'SELF' }] as never,
}));
show('power 8 -> 20, no rider', v('whirlpool_v2', {
    actions: [{ type: 'ATTACK', power: 20, target: 'TARGET' }, { type: 'DRAW', amount: 1, target: 'SELF' }] as never,
}));

console.log('\nFEEDBACK_LOOP CANDIDATES  (today: 2e, 5 power per triggered draw)');
show('as printed, 2e', reg['feedback_loop_daemon']);
show('same card at 1e', v('feedback_loop_daemon', { baseCost: 1 }));
console.log('  (the proc itself is a hook, so power changes are shown by hand below)');
