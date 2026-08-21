/**
 * TICKET 98: is a 3v3 battle slow because it makes MANY decisions, or because each decision is
 * EXPENSIVE? The two have different fixes - many cheap decisions is a game-length problem, few
 * expensive ones is a branching problem - and the AI-tier evidence already rules out search depth
 * (greedy, which has no lookahead at all, still costs 34s a battle against full's 52s).
 *
 * This walks a real battle and times every `getBestAction` call, so the answer is counted rather
 * than profiled. (The profiler route died on tsx's parent/child split; the walker is the pattern
 * that already works elsewhere in scratch/.)
 */
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction, AI_TIER } from '../src/engine/ai/TacticalAI';
type St = import('../src/engine/types').IBattleState;

const SQUAD: Array<readonly [string, string]> = [
    ['draugr', 'draugr_v2'], ['huldra', 'huldra_v1'], ['sleipnir', 'sleipnir_v1'],
];
const FOE: Array<readonly [string, string]> = [
    ['hel', 'hel_v2'], ['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1'],
];

for (const n of [1, 2, 3]) {
    const setup = teamScenario({ player: SQUAD.slice(0, n), enemy: FOE.slice(0, n), seed: `dec:${n}` });
    let st = buildScenarioState({ ...setup, seed: `dec:${n}` }) as St;
    const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);

    const times: number[] = [];
    let plays = 0, guard = 0;
    while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
        const t = performance.now();
        const a = getBestAction(st);
        times.push(performance.now() - t);
        if (a.type === 'PLAY_PROGRAM') plays++;
        let next = battleReducer(st, a);
        if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
        st = next;
    }
    const total = times.reduce((x, y) => x + y, 0);
    const sorted = [...times].sort((x, y) => x - y);
    console.error(`${n}v${n} tier=${AI_TIER}  decisions ${times.length} (${plays} plays)  ` +
        `total ${(total / 1000).toFixed(1)}s  mean ${(total / times.length).toFixed(0)}ms  ` +
        `median ${sorted[Math.floor(sorted.length / 2)].toFixed(0)}ms  ` +
        `p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(0)}ms  ` +
        `max ${sorted[sorted.length - 1].toFixed(0)}ms  turns ${st.turn}`);
}
