/** One matchup, measured properly. env: P, POS, E, EOS, ITER */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { ENV } from './_env';
const r = runPairedBatch(matchupScenario({
    player: ENV.P!, enemy: ENV.E!,
    playerOS: ENV.POS!, enemyOS: ENV.EOS!,
    seed: ENV.SEED ?? `grid:${ENV.POS}:${ENV.EOS}`,
}), { iterations: Number(ENV.ITER ?? 30) });
console.error(`${ENV.POS} vs ${ENV.EOS}: ${(r.pooled.decisiveWinRate*100).toFixed(1)}%  ` +
    `turns ${r.pooled.averageTurns.toFixed(2)}  dead ${(r.pooled.deadCardRatio*100).toFixed(1)}%  ftk ${r.pooled.ftkCount}`);
