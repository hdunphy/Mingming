/**
 * TICKET 98: how expensive is a team battle, and WHY. The canary timed out on its first run
 * (72 games, >10 minutes, against 600 1v1 games in 30 seconds), so the cost has to be
 * characterised before any team measurement can be planned.
 *
 * Reports per-battle wall clock and turn count at 1v1, 2v2 and 3v3 on the same species, so the
 * growth curve is visible rather than inferred. env: TIER via AI_LITE/AI_GREEDY.
 */
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import { runBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';

const SQUAD: Array<readonly [string, string]> = [
    ['draugr', 'draugr_v2'], ['huldra', 'huldra_v1'], ['sleipnir', 'sleipnir_v1'],
];
const FOE: Array<readonly [string, string]> = [
    ['hel', 'hel_v2'], ['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1'],
];

for (const n of [1, 2, 3]) {
    const started = Date.now();
    const r = runBatch(teamScenario({
        player: SQUAD.slice(0, n), enemy: FOE.slice(0, n), seed: `cost:${n}`,
    }), { iterations: 2 });
    const ms = Date.now() - started;
    console.error(`${n}v${n}  tier=${AI_TIER}  ${(ms / 2 / 1000).toFixed(1)}s per battle   ` +
        `turns ${r.averageTurns.toFixed(1)}   truncated ${r.truncatedCount}/2   ` +
        `deck ${n * 9} cards`);
}
