/**
 * Field census - the standing full-field gate (ticket 73 task 3).
 *
 * Every other suite here is an AGGREGATE: the mirror, the control gauntlet and the OS variance
 * audit each read 67 matchups between them. That is why "FTK 0" was reported for months while
 * ticket 69's 480-cell census found **43 first-turn kills in 14 cells** - the suite was not
 * blind to FTKs, it was blind to the matchups they happened in. `jormungandr_v1` was on one
 * side of all 43 and appears in exactly one gauntlet row.
 *
 * So this suite runs the whole field: every deck against every other species, both turn orders.
 * Its job is that **FTK 0 means 0 EVERYWHERE, permanently.**
 *
 * ## The cost, stated plainly
 *
 * 480 cells x `CENSUS_ITERATIONS` x 2 orders. Each cell is a full battle, so at 30 iterations
 * this is ~28 minutes on two cores - four times the rest of `npm run balance` put together.
 * The default is therefore **10** (20 games a cell, ~9 CPU-minutes, halved across the two
 * shards), which is a smoke alarm rather than a proof: it reliably catches a cell that FTKs at
 * 10-17% (the shape all 14 census cells had) and will miss a 1-in-60 cell. **The authoritative
 * read is `CENSUS_ITERATIONS=30 npm run balance`**, and that is what a ticket claiming FTK 0
 * should quote.
 *
 * ## What it asserts, and what it only records
 *
 * - **FTK 0 is a hard gate.** Any cell with a first-turn kill fails this suite.
 * - The **band data** (Henry's 2026-08-16 bucket-band standard: no absolute 0%/100% in a
 *   NEUTRAL type cell) is written to the artifact and logged, but NOT asserted. It currently
 *   fails - ticket 69 measured 46.5% of cells out of band - and the queue (jormungandr_v1 cut,
 *   hel_v1, hraesvelgr, dead-card cleanup) is the plan for closing it. Asserting it today would
 *   paint the suite red for work that is already scheduled. Turn it on when the queue lands.
 *
 * The full grid goes to `docs/balance/field_census.json` - the committed artifact the ticket
 * asked for, and the thing to diff between tickets.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { matchupScenario, BALANCE_SPECIES } from './balanceScenarios';
import { runOne, deriveSeeds, DEFAULT_MAX_TURNS } from './runBatch';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { ElementalMatrix } from '../../engine/combatUtils';

/** Games a cell gets is this x2 (both turn orders). See the cost note above. */
const CENSUS_ITERATIONS = Number(process.env.CENSUS_ITERATIONS ?? 10);
const ARTIFACT = 'docs/balance/field_census.json';

export interface FieldCell {
    deck: string;
    species: string;
    opponent: string;
    /** Attacker-perspective elemental bucket - the axis Henry's bucket-band standard splits on. */
    bucket: 'ADV' | 'NEU' | 'DIS';
    games: number;
    decisive: number;
    winRate: number;
    ftk: number;
}

function bucketOf(a: string, b: string): FieldCell['bucket'] {
    const ea = MingmingRegistry[a].primaryElement as never;
    const eb = MingmingRegistry[b].primaryElement as never;
    const out = (ElementalMatrix as Record<string, Record<string, number>>)[ea]?.[eb] ?? 1;
    const inc = (ElementalMatrix as Record<string, Record<string, number>>)[eb]?.[ea] ?? 1;
    if (out > 1 && inc <= 1) return 'ADV';
    if (inc > 1 && out <= 1) return 'DIS';
    return 'NEU';
}

/** Every (deck, opponent species) pair in the registry, in a stable order. */
export function fieldCells(): Array<{ species: string; deck: string; opponent: string }> {
    const out: Array<{ species: string; deck: string; opponent: string }> = [];
    for (const species of BALANCE_SPECIES)
        for (const deck of MingmingRegistry[species].availableOS)
            for (const opponent of BALANCE_SPECIES)
                if (opponent !== species) out.push({ species, deck, opponent });
    return out;
}

/**
 * Merge this shard's rows into the artifact.
 *
 * Shards run in separate workers, so each one reads-modifies-writes rather than owning the
 * file. Rows are keyed by `deck|opponent` and sorted, so the result is byte-stable regardless
 * of which shard finishes first - the same property the report's `id` sort gives it.
 */
function publish(rows: FieldCell[]): void {
    const key = (c: FieldCell) => `${c.deck}|${c.opponent}`;
    const merged = new Map<string, FieldCell>();
    if (existsSync(ARTIFACT)) {
        try {
            const prior = JSON.parse(readFileSync(ARTIFACT, 'utf8')) as { cells?: FieldCell[] };
            for (const c of prior.cells ?? []) merged.set(key(c), c);
        } catch { /* a malformed artifact is replaced, not honoured */ }
    }
    for (const c of rows) merged.set(key(c), c);
    const cells = [...merged.values()].sort((a, b) => key(a).localeCompare(key(b)));

    const viol = cells.filter(c => c.winRate > 0.9 || c.winRate < 0.1);
    const neutralAbsolutes = cells.filter(c => c.bucket === 'NEU' && (c.winRate >= 1 || c.winRate <= 0));
    const payload = {
        schemaVersion: 1,
        note: 'Ticket 73 task 3. Every deck vs every opponent species, both turn orders. FTK is a hard gate; the band numbers are diagnostic until the queue lands.',
        iterationsPerOrder: CENSUS_ITERATIONS,
        summary: {
            cells: cells.length,
            ftk: cells.reduce((a, c) => a + c.ftk, 0),
            ftkCells: cells.filter(c => c.ftk).length,
            bandViolations: viol.length,
            bandViolationRate: cells.length ? Number((viol.length / cells.length).toFixed(4)) : 0,
            neutralAbsolutes: neutralAbsolutes.length,
        },
        cells,
    };
    mkdirSync(dirname(ARTIFACT), { recursive: true });
    writeFileSync(ARTIFACT, `${JSON.stringify(payload, null, 1)}\n`);
}

/** Sharded like the mirror and OS suites so the two workers split the field. */
export function defineFieldCensusSuite(shardIndex: number, shardCount: number): void {
    const all = fieldCells();
    const size = Math.ceil(all.length / shardCount);
    const mine = all.slice(shardIndex * size, (shardIndex + 1) * size);
    const rows: FieldCell[] = [];

    afterAll(() => publish(rows));

    describe(`Field census shard ${shardIndex + 1}/${shardCount} (ticket 73 - FTK everywhere)`, () => {
        it(`scans ${mine.length} cells and finds no first-turn kill`, () => {
            for (const { species, deck, opponent } of mine) {
                const setup = matchupScenario({
                    player: species, enemy: opponent, playerOS: deck,
                    // Same seed base as ticket 69's census, so the two are directly comparable.
                    seed: `band:${deck}:${opponent}`,
                });
                let ftk = 0, wins = 0, decisive = 0, games = 0;
                for (const seed of deriveSeeds(setup.seed, CENSUS_ITERATIONS))
                    for (const side of ['PLAYER', 'ENEMY'] as const) {
                        const r = runOne(setup, seed, DEFAULT_MAX_TURNS, side);
                        games++;
                        if (r.ftk) ftk++;
                        if (r.winner === 'PLAYER') { wins++; decisive++; }
                        else if (r.winner === 'ENEMY') decisive++;
                    }
                rows.push({
                    deck, species, opponent, bucket: bucketOf(species, opponent),
                    games, decisive, winRate: decisive ? wins / decisive : 0, ftk,
                });
            }

            const offenders = rows.filter(c => c.ftk);
            const band = rows.filter(c => c.winRate > 0.9 || c.winRate < 0.1);
            const neutralAbsolutes = rows.filter(c => c.bucket === 'NEU' && (c.winRate >= 1 || c.winRate <= 0));
            console.log(
                `  field census shard ${shardIndex + 1}: ${rows.length} cells at ${CENSUS_ITERATIONS}x2 games` +
                `\n    FTK ${rows.reduce((a, c) => a + c.ftk, 0)} in ${offenders.length} cells` +
                `\n    band violations ${band.length}/${rows.length} (diagnostic)` +
                `\n    NEUTRAL absolutes ${neutralAbsolutes.length} (diagnostic - Henry's bucket-band gate, not yet asserted)`,
            );

            // The hard gate. A first-turn kill is a correctness failure at any rate.
            expect(
                offenders.map(c => `${c.deck} vs ${c.opponent}: ${c.ftk}/${c.games}`),
                'A first-turn kill means one side won on turn 1 before the other played a card. ' +
                'Ticket 73 fixed the mechanism that made it reachable (unbounded per-event-count ' +
                'scalers); a new one here means a new uncapped multiplier or a new turn-1 chain.',
            ).toEqual([]);
        });
    });
}
