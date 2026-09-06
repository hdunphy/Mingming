/**
 * TICKET 144 §2 — the beam at 3v3, which is the case it exists for and the case it approximates.
 *
 * At 1v1 the grid gate says bit-identical: branching rarely exceeds 8, so there is nothing to prune.
 * At 3v3 branching is ~45 and the beam is a real choice, so this runs the SAME comps both ways —
 * `aiBeam: 0` against the default 8 — and reports the outcome delta and the time.
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';

const COMPS: Array<[string, string]> = [
    // The gym counter against the gym, the two comps the 141 ship read promoted to the panel, and
    // the archetype pair — a spread of shapes rather than four flavours of one.
    ['fenrir_v1+skoll_v1+ratatoskr_v2', 'kraken_v1+ratatoskr_v1+huldra_v1'],
    ['kraken_v1+jormungandr_v1+huldra_v2', 'huldra_v2+ratatoskr_v2+jormungandr_v2'],
    ['fenrir_v1+skoll_v1+jormungandr_v1', 'ratatoskr_v1+huldra_v1+kraken_v1'],
    ['huldra_v2+ratatoskr_v2+jormungandr_v2', 'fenrir_v2+skoll_v1+kraken_v2'],
];
const ITER = Number(process.argv[2] ?? 1);

for (const [a, b] of COMPS) {
    for (const beam of [16]) {
        const pair = (fw: string): readonly [string, string] => [fw.split('_')[0], fw];
        const setup = teamScenario({ player: a.split('+').map(pair), enemy: b.split('+').map(pair) });
        const t0 = Date.now();
        const r = runPairedBatch(setup, { iterations: ITER, aiBeam: beam });
        const ms = Date.now() - t0;
        const p = r.pooled;
        console.log(JSON.stringify({
            a, b, beam, ms,
            games: p.games, decisive: p.decisive, wins: p.wins,
            winRate: Number((p.winRate * 100).toFixed(2)),
            turns: Number(p.averageTurns.toFixed(2)),
        }));
    }
}
