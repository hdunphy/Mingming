import { readdirSync, readFileSync } from 'node:fs';
import { loadScenario } from '../src/debug/scenarios/scenarioIO';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
const one = buildScenarioState((loadScenario(readFileSync('playtest-pack/A2-narrow-fenrir_v1.scenario.json','utf8')) as { scenario: { setup: never } }).scenario.setup);
console.log('state keys:', Object.keys(one));
console.log('playerDeck keys:', Object.keys((one as unknown as { playerDeck: object }).playerDeck ?? {}));
console.log();
let ok = 0;
for (const f of readdirSync('playtest-pack').sort()) {
    const { scenario } = loadScenario(readFileSync(`playtest-pack/${f}`, 'utf8')) as { scenario: { setup: never } };
    const st = buildScenarioState(scenario.setup) as unknown as {
        playerParty: Array<{ name: string; maxHp: number; currentEnergy: number }>;
        enemyParty: Array<{ name: string; maxHp: number }>;
        playerDeck: Record<string, unknown[]>;
    };
    const p = st.playerParty[0], e = st.enemyParty[0];
    const piles = Object.entries(st.playerDeck).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`).join(' ');
    console.log(`${f.replace('.scenario.json','').padEnd(40)} ${p.name} ${p.maxHp}hp ${p.currentEnergy}e vs ${e.name} ${e.maxHp}hp | ${piles}`);
    ok++;
}
console.log(`\n${ok} scenarios build cleanly`);
