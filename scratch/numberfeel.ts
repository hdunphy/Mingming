/**
 * TICKET 131 - what do the numbers on screen actually look like, and what would scaling them cost?
 *
 * Henry: *"should we scale all our numbers by 10 or even 5. Bigger numbers often feel better 10
 * damage is better than 1 and 400 might feel better than 40."*
 *
 * Before proposing anything: PRINT THE NUMBERS A PLAYER SEES. The question is about felt size, and
 * nobody in this project has written down what the damage floats actually read at the balance frame.
 */
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { calculateDamage, calculateHeal } from '../src/engine/combatUtils';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { numericBaseCost } from '../src/engine/types';
import type { ProgramData } from '../src/engine/types';

const st = buildScenarioState(matchupScenario({
    player: 'kraken', enemy: 'huldra', playerOS: 'kraken_v1', enemyOS: 'huldra_v1', seed: 'numberfeel',
}));
const a = st.playerParty[0], d = st.enemyParty[0];
console.log(`frame: ${a.name} atk ${a.attack} def ${a.defense} maxHp ${a.maxHp}`);
console.log(`       ${d.name} atk ${d.attack} def ${d.defense} maxHp ${d.maxHp}`);
console.log(`       damage = floor(floor(8 x power x atk/def) / 45 x modifier)\n`);

const rows: Array<[string, number, number, number]> = [];
for (const [id, card] of Object.entries(ProgramRegistry as unknown as Record<string, ProgramData>)) {
    const atk = card.actions?.find(x => x.type === 'ATTACK') as { power?: number } | undefined;
    if (!atk?.power) continue;
    const dmg = calculateDamage(a, d, GetProgramData(id), atk.power, st);
    rows.push([id, numericBaseCost(card.baseCost), atk.power, dmg]);
}
rows.sort((x, y) => x[3] - y[3]);
const dmgs = rows.map(r => r[3]);
const pct = (p: number) => dmgs[Math.floor(dmgs.length * p)];
console.log(`${rows.length} attack cards. Damage a player reads off the float:`);
console.log(`  min ${dmgs[0]}   p25 ${pct(0.25)}   median ${pct(0.5)}   p75 ${pct(0.75)}   max ${dmgs[dmgs.length - 1]}`);
console.log(`  as a share of a ${d.maxHp} HP frame: median ${((pct(0.5) / d.maxHp) * 100).toFixed(1)}%\n`);
console.log('  weakest five: ' + rows.slice(0, 5).map(r => `${r[0]}(${r[2]}p -> ${r[3]})`).join(', '));
console.log('  strongest five: ' + rows.slice(-5).map(r => `${r[0]}(${r[2]}p -> ${r[3]})`).join(', '));
const ones = rows.filter(r => r[3] <= 3);
console.log(`\n  cards that read 3 damage or LESS: ${ones.length} of ${rows.length}`);
console.log('    ' + ones.slice(0, 10).map(r => `${r[0]} ${r[3]}`).join(', '));

// Heals are a % of the RECEIVING frame, so they already scale with HP - unlike damage.
console.log(`\n  a 30-power heal on this frame: ${calculateHeal(a, a, 30)} HP `
    + `(= maxHp x power / 400, so it auto-scales with any HP change)`);
console.log(`  one duality stack is worth ${1} POWER, added before the /45 divisor `
    + `-> ${Math.floor((8 * 1 * a.attack / d.defense) / 45)} damage at this frame`);
