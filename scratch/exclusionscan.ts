/**
 * TICKET 111 GRID GATE, step 1 — WHICH decks can even reach the changed code path?
 *
 * A full 960-cell before/after is ~10 hours a side, and the ticket-97 cell cache cannot help because
 * the fix changes engine `.ts` and every cell key misses. So rather than re-run everything, this
 * measures where the fix can POSSIBLY bite: a reshuffle that happened while a card was resolving AND
 * whose shuffle input the exclusion actually changed. A deck that never increments that counter is
 * provably bit-identical across the fix, and needs no re-measure at all.
 *
 * Cheap on purpose: every deck against a five-deck spread at 10 iterations. This is a screen for
 * WHERE to look, not a balance reading, so the tier does not matter.
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { __exclusionStats } from '../src/engine/deckLogic';
import fs from 'node:fs';

interface Cell { deck: string; species: string; opponent: string; opponentSpecies: string }
const grid: { cells: Cell[] } = JSON.parse(fs.readFileSync('docs/balance/deck_grid.json', 'utf8'));
const decks = [...new Map(grid.cells.map(c => [c.deck, c])).values()];
const SPREAD = ['huldra_v1', 'kraken_v1', 'skoll_v1', 'ymir_v1', 'audhumbla_v2'];
const opp = (id: string) => grid.cells.find(c => c.opponent === id)!;

const out: Array<{ deck: string; reshuffles: number; mattered: number }> = [];
for (const d of decks) {
    __exclusionStats.reshuffles = 0; __exclusionStats.exclusionsThatMattered = 0;
    for (const o of SPREAD) {
        if (o === d.deck) continue;
        const oc = opp(o);
        runPairedBatch(teamScenario({
            player: [[d.species, d.deck]], enemy: [[oc.opponentSpecies, oc.opponent]],
            seed: `exclscan:${d.deck}:${o}`,
        }), { iterations: 10 });
    }
    out.push({ deck: d.deck, reshuffles: __exclusionStats.reshuffles, mattered: __exclusionStats.exclusionsThatMattered });
    console.error(`  ${d.deck.padEnd(18)} reshuffles ${String(__exclusionStats.reshuffles).padStart(4)}   ` +
        `exclusion mattered ${String(__exclusionStats.exclusionsThatMattered).padStart(4)}` +
        (__exclusionStats.exclusionsThatMattered ? '   <-- NEEDS RE-MEASURE' : ''));
}
fs.writeFileSync('/root/probe/exclusionscan.json', JSON.stringify(out, null, 1));
const hot = out.filter(o => o.mattered > 0);
console.error(`\n${hot.length} of ${out.length} decks can reach the changed path: ${hot.map(h => h.deck).join(', ') || 'none'}`);
