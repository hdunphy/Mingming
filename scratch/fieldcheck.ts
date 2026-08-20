/** Ticket 103: field win rate for one deck against the whole roster, on the LIVE registry. */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';

const DECK = process.env.DECK ?? 'sleipnir_v1';
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(process.env.ITER ?? 10);

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

let sum = 0, dead = 0, turns = 0;
const cells: Array<{ opponent: string; win: number }> = [];
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `grid:${DECK}:${o.deck}`,
    }), { iterations: ITER });
    sum += r.pooled.decisiveWinRate; dead += r.pooled.deadCardRatio; turns += r.pooled.averageTurns;
    cells.push({ opponent: o.deck, win: r.pooled.decisiveWinRate * 100 });
}
const n = opponents.length;
cells.sort((a, b) => b.win - a.win);
console.error(`\n${DECK.padEnd(16)} field ${((sum / n) * 100).toFixed(1)}%   opp ${n}` +
    `   dead ${((dead / n) * 100).toFixed(1)}%   turns ${(turns / n).toFixed(2)}` +
    `   absolutes ${cells.filter(c => c.win >= 100 || c.win <= 0).length}`);
console.error(`  worst ${cells.slice(-3).map(c => `${c.opponent} ${c.win.toFixed(0)}%`).join('  ')}`);
