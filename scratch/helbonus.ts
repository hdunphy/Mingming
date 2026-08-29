/**
 * Ticket 78: with the AI fixed and `purify` cut, what should the stance bonus actually be?
 *
 * The 50/50 that measured well in ticket 77 was measured on top of the BROKEN AI and the deck
 * that still ran `purify`. All three changes stack, and the full grid says they stack to 74.0%
 * field - an overshoot from second-worst to fourth-best. This sweeps the bonus against the same
 * opponent set the grid uses (all 31 other DECKS, not 15 species on availableOS[0]), so the
 * number is directly comparable to `docs/balance/deck_grid.json`.
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { STANCE_BONUS } from '../src/engine/core/Hooks';
import { ENV } from './_env';

const ITER = Number(ENV.ITER ?? 30);
const opponents: Array<{ species: string; deck: string }> = [];
for (const species of BALANCE_SPECIES)
    if (species !== 'hel')
        for (const deck of MingmingRegistry[species].availableOS) opponents.push({ species, deck });

for (const spec of (ENV.ARMS ?? '0.50').split(';')) {
    const [d, l] = spec.split(',');
    STANCE_BONUS.dark = Number(d);
    STANCE_BONUS.light = Number(l ?? d);
    const cells: Array<{ opp: string; wr: number }> = [];
    for (const o of opponents) {
        const r = runPairedBatch(matchupScenario({
            player: 'hel', enemy: o.species, playerOS: 'hel_v1', enemyOS: o.deck,
            seed: `grid:hel_v1:${o.deck}`,
        }), { iterations: ITER });
        cells.push({ opp: o.deck, wr: r.pooled.decisiveWinRate });
    }
    const mean = cells.reduce((s, c) => s + c.wr, 0) / cells.length;
    const lo = cells.filter(c => c.wr < 0.1).length, hi = cells.filter(c => c.wr > 0.9).length;
    console.error(`ARM dark=${STANCE_BONUS.dark.toFixed(2)} light=${STANCE_BONUS.light.toFixed(2)}  ` +
        `field ${(mean * 100).toFixed(1)}%   <10%: ${lo}   >90%: ${hi}   band-viol ${lo + hi}/${cells.length}   ` +
        `0%: ${cells.filter(c => c.wr <= 0).length}  100%: ${cells.filter(c => c.wr >= 1).length}`);
}
