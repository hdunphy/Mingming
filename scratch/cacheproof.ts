/**
 * Ticket 97's correctness gate: a cached assembly must be BIT-IDENTICAL to a forced full re-run.
 *
 * Runs a slice of the grid three times against a throwaway cache file:
 *   1. cold  - every cell computed, cache written
 *   2. warm  - every cell served from the cache
 *   3. forced - `FORCE_FULL` semantics, every cell recomputed and nothing read
 *
 * Then compares the three assemblies byte for byte. A cache that is fast and wrong is worse than no
 * cache at all, so this is the piece that has to pass before the grid is allowed to trust it.
 *
 * env: SLICE (how many decks to include, default 4 -> 12 cells)
 */
import { rmSync, existsSync } from 'node:fs';

import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { CellCache, cellKey } from '../src/debug/balance/cellCache';

const ITER = Number(process.env.ITER ?? 6);
const SLICE = Number(process.env.SLICE ?? 4);
const TMP = 'docs/balance/.cell-cache.proof.json';

const decks: Array<{ species: string; deck: string }> = [];
for (const species of BALANCE_SPECIES)
    for (const deck of MingmingRegistry[species].availableOS) decks.push({ species, deck });
const slice = decks.slice(0, SLICE);

interface Row { deck: string; opponent: string; winRate: number; turns: number; ftk: number; dead: number }

function assemble(useCache: boolean): { rows: Row[]; hits: number; misses: number } {
    const cache = new CellCache(TMP);
    const rows: Row[] = [];
    for (const a of slice) {
        for (const b of slice) {
            if (a.species === b.species) continue;
            const seed = `grid:${a.deck}:${b.deck}`;
            const key = cellKey({
                playerSpecies: a.species, playerOS: a.deck,
                enemySpecies: b.species, enemyOS: b.deck,
                seed, iterations: ITER,
            });
            const cached = useCache
                ? cache.get<{ pooled: { decisiveWinRate: number; averageTurns: number; ftkCount: number; deadCardRatio: number } }>(key)
                : undefined;
            const r = cached ?? runPairedBatch(
                matchupScenario({ player: a.species, enemy: b.species, playerOS: a.deck, enemyOS: b.deck, seed }),
                { iterations: ITER });
            if (!cached) {
                cache.set(key, { pooled: {
                    iterations: r.pooled.iterations, decisive: r.pooled.decisive,
                    decisiveWinRate: r.pooled.decisiveWinRate, averageTurns: r.pooled.averageTurns,
                    ftkCount: r.pooled.ftkCount, deadCardRatio: r.pooled.deadCardRatio,
                } });
            }
            rows.push({
                deck: a.deck, opponent: b.deck,
                winRate: Number(r.pooled.decisiveWinRate.toFixed(4)),
                turns: Number(r.pooled.averageTurns.toFixed(2)),
                ftk: r.pooled.ftkCount,
                dead: Number(r.pooled.deadCardRatio.toFixed(4)),
            });
        }
    }
    cache.save();
    const s = cache.stats();
    return { rows, hits: s.hits, misses: s.misses };
}

if (existsSync(TMP)) rmSync(TMP);

const cold = assemble(true);
const warm = assemble(true);
const forced = assemble(false);

const j = (r: Row[]) => JSON.stringify(r);
const coldWarm = j(cold.rows) === j(warm.rows);
const coldForced = j(cold.rows) === j(forced.rows);

console.error(`cells ${cold.rows.length}   iterations ${ITER}`);
console.error(`  cold   ${cold.hits} hit / ${cold.misses} miss`);
console.error(`  warm   ${warm.hits} hit / ${warm.misses} miss   <- every cell should be a hit`);
console.error(`  forced ${forced.hits} hit / ${forced.misses} miss  <- every cell should be a miss`);
console.error(`\n  cold === warm    ${coldWarm ? 'BIT-IDENTICAL' : 'DIFFERS'}`);
console.error(`  cold === forced  ${coldForced ? 'BIT-IDENTICAL' : 'DIFFERS'}`);

rmSync(TMP, { force: true });

if (!coldWarm || !coldForced || warm.misses !== 0 || warm.hits !== cold.rows.length) {
    console.error('\nPROOF FAILED');
    process.exit(1);
}
console.error('\nPROOF PASSED');
