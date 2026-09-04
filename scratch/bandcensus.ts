/** Ticket 69: every deck x every opponent species against Henry's 10-90% single-matchup band. */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ElementalMatrix } from '../src/engine/combatUtils';
import { ENV } from './_env';

const ITER = Number(ENV.ITER ?? 30);
const decks: Array<{ sp: string; os: string }> = [];
for (const sp of BALANCE_SPECIES)
    for (const os of (MingmingRegistry as any)[sp].availableOS) decks.push({ sp, os });

/** Attacker-perspective type bucket: does the PLAYER species' primary beat the opponent's? */
function bucket(a: string, b: string): 'ADV' | 'DIS' | 'NEU' {
    const ea = (MingmingRegistry as any)[a].primaryElement as never;
    const eb = (MingmingRegistry as any)[b].primaryElement as never;
    const out = (ElementalMatrix as any)[ea]?.[eb] ?? 1.0;
    const inc = (ElementalMatrix as any)[eb]?.[ea] ?? 1.0;
    if (out > 1 && inc <= 1) return 'ADV';
    if (inc > 1 && out <= 1) return 'DIS';
    return 'NEU';
}

const rows: any[] = [];
for (const { sp, os } of decks) {
    for (const opp of BALANCE_SPECIES) {
        if (opp === sp) continue;
        const r = runPairedBatch(
            matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `band:${os}:${opp}` }),
            { iterations: ITER });
        rows.push({
            deck: os, sp, opp, bucket: bucket(sp, opp),
            wr: r.pooled.decisiveWinRate, decided: r.pooled.decisive, iters: r.pooled.iterations,
            draws: r.pooled.draws, turns: r.pooled.averageTurns, ftk: r.pooled.ftkCount,
        });
    }
    const mine = rows.filter(x => x.deck === os);
    const v = mine.filter(x => x.wr > 0.9 || x.wr < 0.1).length;
    console.error(`[${rows.length}] ${os}: mean ${(mine.reduce((a, b) => a + b.wr, 0) / mine.length * 100).toFixed(1)}%  violations ${v}/15`);
}
console.log(JSON.stringify({ iterations: ITER, rows }));
