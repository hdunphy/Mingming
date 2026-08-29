/**
 * 3v3 OPTIMISATION: the beam is only worth having if it buys time without reordering outcomes.
 *
 * Timing a SINGLE battle per width is worthless here - the beam changes decisions, so it changes how
 * long the battle runs, and a width that happens to end a game in 3 turns looks fast for a reason
 * that has nothing to do with the beam. (That is not hypothetical: the first pass at this read
 * widths 12/8/6/4 as 16.5/11.2/17.7/12.5s, which is noise, not a curve.) This runs a FIXED set of
 * games per width and reports wall clock beside the win rate - the same protocol ticket 108's tier
 * calibration used.
 *
 * env: ITER (default 3 -> 6 games across both orders), AI_BEAM per arm.
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { ENV } from './_env';

const ITER = Number(ENV.ITER ?? 3);
const started = Date.now();
const r = runPairedBatch(teamScenario({
    player: [['draugr', 'draugr_v2'], ['huldra', 'huldra_v1'], ['sleipnir', 'sleipnir_v1']],
    enemy: [['hel', 'hel_v2'], ['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1']],
    seed: 'beam:fixed',
}), { iterations: ITER });
const ms = Date.now() - started;
console.error(`beam=${(ENV.AI_BEAM ?? '0').padStart(2)}  ${(ms / 1000).toFixed(1)}s  ` +
    `${ITER * 2} games  win ${(r.pooled.decisiveWinRate * 100).toFixed(1)}%  ` +
    `turns ${r.pooled.averageTurns.toFixed(1)}  truncated ${r.pooled.truncatedCount}`);
