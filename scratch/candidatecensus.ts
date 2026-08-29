/**
 * 3v3 OPTIMISATION: what does the same-turn enumeration actually walk?
 *
 * `findBestSequence` recurses over SEQUENCES of plays inside a turn, so its cost is roughly
 * `branching ^ MAX_DEPTH`. This counts the reducer simulations that produces, and the share of them
 * that are byte-identical repeats inside a single node (a Self card whose target loop re-emits the
 * same action once per target).
 *
 * env: AI_CENSUS=1 (required), AI_BEAM, N.
 */
import { census, censusReset, censusNewDecision, getBestAction, AI_TIER } from '../src/engine/ai/TacticalAI';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { battleReducer } from '../src/engine/battleReducer';
import { ENV } from './_env';
type St = import('../src/engine/types').IBattleState;

const SQUAD: Array<readonly [string, string]> = [
    ['draugr', 'draugr_v2'], ['huldra', 'huldra_v1'], ['sleipnir', 'sleipnir_v1'],
];
const FOE: Array<readonly [string, string]> = [
    ['hel', 'hel_v2'], ['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1'],
];

for (const n of (ENV.N ?? '1,2,3').split(',').map(Number)) {
    const setup = teamScenario({ player: SQUAD.slice(0, n), enemy: FOE.slice(0, n), seed: `cen:${n}` });
    let st = buildScenarioState({ ...setup, seed: `cen:${n}` }) as St;
    const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);
    censusReset();
    let guard = 0;
    const t0 = performance.now();
    while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
        censusNewDecision();
        const a = getBestAction(st);
        let next = battleReducer(st, a);
        if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
        st = next;
    }
    const ms = performance.now() - t0;
    const c = census;
    console.error(`${n}v${n} tier=${AI_TIER} beam=${ENV.AI_BEAM ?? 0}  ` +
        `${(ms / 1000).toFixed(1)}s  decisions ${c.decisions}`);
    console.error(`   reducer sims ${c.simulated}  (${(c.simulated / c.decisions).toFixed(0)} per decision, ` +
        `${(ms * 1000 / c.simulated).toFixed(0)}us each)   pruned by beam ${c.pruned}`);
    console.error(`   DUPLICATE    ${c.duplicate} = ${((c.duplicate / Math.max(1, c.enumerated)) * 100).toFixed(1)}%` +
        ` of ${c.enumerated} enumerated - identical (source,target,card) inside one node`);
}
