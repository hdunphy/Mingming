/** Ticket 90: what a sleipnir_v1 card actually deals vs the control, card by card. */
import { readFileSync } from 'node:fs';
import { loadScenario } from '../src/debug/scenarios/scenarioIO';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { calculateDamage } from '../src/engine/combatUtils';
import { getEffectiveAttackPower, getDamageScalingMultiplier } from '../src/engine/actions/ActionExecutors';

const { scenario } = loadScenario(readFileSync('playtest-pack/A1-wide-sleipnir_v1.scenario.json', 'utf8')) as { scenario: { setup: never } };
const st = buildScenarioState(scenario.setup);
const me = st.playerParty[0], foe = st.enemyParty[0];
console.log(`${me.name} lvl${me.level} atk ${me.attack} vs ${foe.name} def ${foe.defense} hp ${foe.maxHp}\n`);
const deck = [...new Set(scenario.setup['player'].deck as string[])];
console.log('card             power  dmg@1card  dmg@3cards  dmg@5cards   (a health bar is ' + foe.maxHp + ')');
for (const id of deck) {
    const d = GetProgramData(id);
    const atk = d.actions.find(a => a.type === 'ATTACK');
    if (!atk) { console.log(`${id.padEnd(17)} -      (no attack action)`); continue; }
    const power = getEffectiveAttackPower(me, atk as never, foe);
    const base = calculateDamage(me, foe, d, power, st);
    const at = (n: number) => Math.floor(base * getDamageScalingMultiplier(
        { ...st, cardsPlayedThisTurn: n, lastEnergySpent: d.baseCost as number } as never,
        (atk as { scaling?: string }).scaling, d.element, foe));
    console.log(`${id.padEnd(17)}${String((atk as {power?:number}).power ?? 0).padStart(5)}${String(at(1)).padStart(11)}${String(at(3)).padStart(12)}${String(at(5)).padStart(12)}`);
}
