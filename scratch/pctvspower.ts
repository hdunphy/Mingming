/**
 * TICKET 134 - the +50% HP buff moved percentage effects and power effects apart.
 *
 * Henry: *"I'm worried about the numbers we have using percentages instead of power."*
 *
 * He is right and it is worth writing down exactly. The engine denominates effects two ways:
 *
 *   POWER-BASED   damage = floor(8 x power x atk/def / 45) x NUMBER_SCALE
 *                 Does NOT read maxHp. A card's damage is the same on any size frame.
 *   PERCENT-BASED heals   = maxHp x power / 400
 *                 Burn/Poison ticks = damagePercent x maxHp
 *                 hel_v2's blood toll = 6% of maxHp per printed Energy
 *                 These scale WITH the frame.
 *
 * Ticket 131b multiplied every frame by 1.5. So in the only currency that matters - FRACTION OF A
 * HEALTH BAR - percentage effects are unchanged and power effects are 1/1.5 = 67% of what they were.
 * Healing and damage-over-time did not get stronger in absolute terms by accident; attack cards got
 * WEAKER relative to them, by a third.
 *
 * (Ticket 131c's x10 is NOT part of this. It scaled damage and health by the same factor, so it
 * moves nothing here. This is entirely 131b's buff.)
 *
 * Run: npx vite-node scratch/pctvspower.ts
 */
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { calculateDamage, calculateHeal } from '../src/engine/combatUtils';
import { GetProgramData, ProgramRegistry } from '../src/engine/data/programRegistry';
import { HP_MULTIPLIER } from '../src/engine/types';
import type { ProgramData } from '../src/engine/types';

const st = buildScenarioState(matchupScenario({
    player: 'kraken', enemy: 'huldra', playerOS: 'kraken_v1', enemyOS: 'huldra_v1', seed: 'pctvspower',
}));
const a = st.playerParty[0], d = st.enemyParty[0];
console.log(`frame: ${d.name} maxHp ${d.maxHp}   (HP_MULTIPLIER ${HP_MULTIPLIER})\n`);

const reg = ProgramRegistry as unknown as Record<string, ProgramData>;
let power = 0, heal = 0, dot = 0, other = 0;
const pctCards: string[] = [];
for (const [id, card] of Object.entries(reg)) {
    if (card.isToken) continue;
    const acts = card.actions ?? [];
    const hasAttack = acts.some(x => x.type === 'ATTACK' && (x as { power?: number }).power);
    const hasHeal = acts.some(x => x.type === 'HEAL');
    const hasDot = acts.some(x => x.type === 'STATUS'
        && ['Burn', 'Poison', 'Regen'].includes((x as { status?: string }).status ?? ''));
    if (hasHeal || hasDot) { (hasHeal ? heal++ : dot++); pctCards.push(id); }
    else if (hasAttack) power++;
    else other++;
}
console.log(`CARD POOL, by what its numbers are denominated in:`);
console.log(`  power-based only (attack)      ${power}`);
console.log(`  carries a HEAL                 ${heal}   <- scales with maxHp`);
console.log(`  carries Burn / Poison / Regen  ${dot}   <- scales with maxHp`);
console.log(`  neither                        ${other}`);
console.log(`  => ${heal + dot} of ${power + heal + dot + other} cards got a relative 1.5x from the HP buff\n`);

// The same effect, priced both ways, as a share of the frame - the currency that decides a fight.
const shareOfBar = (n: number) => `${((n / d.maxHp) * 100).toFixed(2)}%`;
const medianAttack = 40;   // the pool's modal-ish printed power
const dmg = calculateDamage(a, d, GetProgramData('water_slap'), medianAttack, st);
console.log(`A ${medianAttack}-power attack lands ${dmg} = ${shareOfBar(dmg)} of the bar.`);
console.log(`  before ticket 131b, on a ${Math.round(d.maxHp / HP_MULTIPLIER)} HP frame, the SAME card`);
console.log(`  was ${((dmg / (d.maxHp / HP_MULTIPLIER)) * 100).toFixed(2)}% of the bar - it lost a third of its reach.\n`);
const h = calculateHeal(a, d, 30);
console.log(`A 30-power heal restores ${h} = ${shareOfBar(h)} of the bar - IDENTICAL before and after,`);
console.log(`  because calculateHeal is maxHp x power / 400.\n`);
console.log(`So the ratio heal:attack moved by exactly HP_MULTIPLIER = ${HP_MULTIPLIER}x in healing's favour,`);
console.log(`and the same is true of every Burn and Poison tick.`);
