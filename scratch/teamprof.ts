/** TICKET 98: one 3v3 battle, for the profiler. */
import { runBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
const r = runBatch(teamScenario({
    player: [['draugr', 'draugr_v2'], ['huldra', 'huldra_v1'], ['sleipnir', 'sleipnir_v1']],
    enemy: [['hel', 'hel_v2'], ['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1']],
    seed: 'prof:3',
}), { iterations: 1 });
console.error(`turns ${r.averageTurns} truncated ${r.truncatedCount}`);
