/** TICKET 149 (3a) — scorer output for the Side cards under Side and under a temporary Single. */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';
const IDS = ['frost_bite', 'numbing_gale', 'killing_frost', 'rimefrost', 'ice_spear', 'ink_cloud', 'spreading_rot', 'tidal_battery'];
console.log('| card | cost | ceiling | score Side | score Single | scorer ratio | Side vs ceiling | Single vs ceiling |');
console.log('|---|---|---|---|---|---|---|---|');
for (const id of IDS) {
    const raw = ProgramRegistry[id] as unknown as ProgramData & { baseCost: number; target: string };
    const side = calculatePowerscale(raw).score;
    const single = calculatePowerscale({ ...raw, target: 'Single' } as ProgramData).score;
    const c = budgetBandFor(raw.baseCost).over;
    console.log(`| ${id} | ${raw.baseCost}e | ${c} | ${side.toFixed(1)} | ${single.toFixed(1)} | ${(side / single).toFixed(2)} | ${((side / c - 1) * 100).toFixed(0)}% | ${((single / c - 1) * 100).toFixed(0)}% |`);
}
