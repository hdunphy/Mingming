/** One matchup, measured properly. env: P, POS, E, EOS, ITER */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
const r = runPairedBatch(matchupScenario({
    player: process.env.P!, enemy: process.env.E!,
    playerOS: process.env.POS!, enemyOS: process.env.EOS!,
    seed: process.env.SEED ?? `grid:${process.env.POS}:${process.env.EOS}`,
}), { iterations: Number(process.env.ITER ?? 30) });
console.error(`${process.env.POS} vs ${process.env.EOS}: ${(r.pooled.decisiveWinRate*100).toFixed(1)}%  ` +
    `turns ${r.pooled.averageTurns.toFixed(2)}  dead ${(r.pooled.deadCardRatio*100).toFixed(1)}%  ftk ${r.pooled.ftkCount}`);
