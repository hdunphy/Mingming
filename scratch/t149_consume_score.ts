/** TICKET 149 (3c): shipped scores of the consume family + what-if constants. Read-only. */
import { calculatePowerscale, budgetBandFor, statusPileValue, burnPower } from '../src/debug/balance/powerscale';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { numericBaseCost } from '../src/engine/types';
const ids = ['umbral_feast', 'contagion', 'hexbloom', 'corrosive_leak', 'ash_communion', 'momentum_crash', 'starfall', 'stampede', 'serpents_coil', 'carrion_swoop', 'fire_punch_v2', 'baseline_strike'];
for (const id of ids) {
    const c = GetProgramData(id);
    const r = calculatePowerscale(c);
    const band = budgetBandFor(numericBaseCost(c.baseCost));
    console.log(`${id.padEnd(16)} cost ${c.baseCost} score ${r.score} (dmg ${r.damagePortion}, status ${r.statusPortion}) band over ${band.over} -> ${((r.score / band.over - 1) * 100).toFixed(0)}%  review ${r.manualReview.join(',') || '-'}`);
}
console.log('poisonPower(n)=1.5n(n+1):', [1,2,3,4,5,6,8,10,12].map(n => `${n}:${statusPileValue('Poison', n)}`).join(' '));
console.log('burnPower:', [1,1.5,2,3,4].map(n => `${n}:${burnPower(n)}`).join(' '));
console.log('Weakened pile value:', [1,3,5,8].map(n => `${n}:${statusPileValue('Weakened', n)}`).join(' '));
console.log('Strengthened pile value:', [1,3,5,8].map(n => `${n}:${statusPileValue('Strengthened', n)}`).join(' '));
console.log('Energized 1:', statusPileValue('Energized', 1));
