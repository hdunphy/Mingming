/*
 * TICKET 160-e1's own gate — does ally enumeration grow the AI's branching?
 *
 * The ticket predicted it would: *"the AI enumerates ally targets (candidate count grows; re-run
 * the beam gate)"*. That is a prediction about a number, so it is measured rather than assumed.
 *
 * Run: AI_CENSUS=1 npx vite-node scratch/t160e1_census.ts -- --comp keeper --iter 6
 */
import { arg } from './_env';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { deriveSeeds } from '../src/debug/balance/runBatch';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction, census, censusReset } from '../src/engine/ai/TacticalAI';
import type { IBattleState } from '../src/engine/types';

const ITER = Number(arg('iter', '6'));
const MAXT = 30;

/** The keeper comp: every ally-target card in the collection sits in one of these three kits/pools. */
const A: ReadonlyArray<readonly [string, string]> = [['huldra', 'huldra_v1'], ['ratatoskr', 'ratatoskr_v1'], ['skoll', 'skoll_v1']];
const B: ReadonlyArray<readonly [string, string]> = [['kraken', 'kraken_v1'], ['jormungandr', 'jormungandr_v2'], ['fenrir', 'fenrir_v2']];

censusReset();
let turns = 0;
for (const seed of deriveSeeds('e1-census', ITER)) {
    const setup = teamScenario({ player: A, enemy: B, seed }) as never;
    let state: IBattleState = buildScenarioState(setup);
    for (let t = 0; t < MAXT; t++) {
        if (state.isBattleOver) break;
        const action = getBestAction(state, state.activeSide) as BattleAction | null;
        state = battleReducer(state, (action ?? { type: 'END_TURN', payload: {} }) as never);
        turns++;
    }
}
console.log(JSON.stringify({
    turns,
    ...census,
    enumeratedPerDecision: +(census.enumerated / Math.max(1, census.decisions)).toFixed(2),
    prunedPerDecision: +(census.pruned / Math.max(1, census.decisions)).toFixed(2),
}, null, 2));
