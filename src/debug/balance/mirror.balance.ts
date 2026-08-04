/**
 * The Mirror Test - `docs/balance_testing.md` §2.1.
 *
 * Run this before trusting anything else in the suite. Identical species, identical deck,
 * identical firmware, identical stats: if the two sides do not split the decided games
 * evenly, the harness is measuring the harness and every other number here is noise.
 *
 * WHY EACH MIRROR IS RUN TWICE
 * ----------------------------
 * `buildScenarioState` always gives the opening turn to PLAYER, and moving first is worth
 * up to 12 points in this engine - base-deck battles are decided in two or three turns, so
 * the first mover often gets one more action phase than the second. A single-orientation
 * mirror therefore *cannot* come out 50/50 even when the AI is perfectly even-handed, and
 * asserting that it does would be asserting that first-mover advantage does not exist.
 *
 * So each mirror runs the same 100 seeds twice, once with each side moving first, and the
 * redline is applied to the pooled result. What that measures is exactly §2.1's stated
 * goal - "the Tactical AI is performing consistently for both sides" - with turn order,
 * which is a property of the game rather than of the AI, divided out. `firstMoverEdge` in
 * the printed summary is that turn-order effect, reported rather than asserted on.
 *
 * WHY THE REDLINE USES `decisiveWinRate`
 * --------------------------------------
 * A draw is symmetric: neither deck won. Scoring it as a loss for the PLAYER side would
 * manufacture a bias out of stalling, and several base decks stall a lot. Stalling has its
 * own redline (§2.2's turn count), which is the second describe block below.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE_SPECIES, mirrorScenario } from './balanceScenarios';
import { quietly, summarizePaired } from './balanceReporting';
import { runPairedBatch, type PairedBatchResult } from './runBatch';

/**
 * §2.1 asks for "100 times with randomized seeds". This runs 200 per orientation, so 400
 * battles per species, for a measurement reason rather than a thoroughness one.
 *
 * Re-running these mirrors under six independent base-seed sets at 100 seeds each gave a
 * pooled decisive win rate spanning 42%-58% (sleipnir 46.5/51.0/51.5/42.0/53.0/53.5,
 * fenrir 52.7/49.5/48.1/58.2/46.6/53.2) - centred on 50%, but with a spread that reaches
 * the ±10 point tolerance below. At 100 seeds this test would go red on a seed change with
 * nothing wrong. Doubling the sample halves the spread instead of doubling the tolerance,
 * which is the fix that makes the test stricter rather than looser.
 */
const SEEDS = 200;

/**
 * Battle length cap. Also the stall detector: a mirror that has not resolved by turn 60
 * is not going to.
 */
const MAX_TURNS = 60;

/**
 * How far from 50% still counts as "~50%". Two standard errors of a fair coin over the
 * ~400 decided games a 200-seed mirror produces is 5 points, so 10 is roughly a 4-sigma
 * band: wide enough that sampling noise will not trip it, narrow enough that a real side
 * bias cannot hide in it (the smallest interesting asymmetry - the AI mis-signing one
 * side's board evaluation - would put this at 0% or 100%, not 55%).
 */
const TOLERANCE = 0.10;

/** §2.2's turn-count redline, applied here to the simplest possible matchup. */
const STALL_TURN_LIMIT = 30;

const results = new Map<string, PairedBatchResult>();

function mirrorOf(species: string): PairedBatchResult {
    const existing = results.get(species);
    if (existing) return existing;

    const paired = quietly(() =>
        runPairedBatch(mirrorScenario(species), { iterations: SEEDS, maxTurns: MAX_TURNS }),
    );
    results.set(species, paired);
    return paired;
}

describe('Mirror Test - harness validation (balance_testing.md 2.1)', () => {
    it.each([...BALANCE_SPECIES])(
        '%s: identical decks split the decided games evenly',
        species => {
            const paired = mirrorOf(species);
            console.log(summarizePaired(`mirror ${species}`, paired));

            if (paired.pooled.decisive === 0) {
                // Nothing was decided, so there is no split to be even or uneven. This is
                // not a pass by omission: the same species fails the stalemate redline
                // below, which is where a mirror that cannot end a game belongs.
                expect(paired.pooled.draws).toBe(paired.pooled.iterations);
                return;
            }

            expect(paired.pooled.decisiveWinRate).toBeGreaterThan(0.5 - TOLERANCE);
            expect(paired.pooled.decisiveWinRate).toBeLessThan(0.5 + TOLERANCE);

            // The same statement from the other direction: whatever moving first is worth,
            // it must be worth the same to both sides.
            expect(paired.sideBias).toBeLessThanOrEqual(2 * TOLERANCE);
        },
    );

    it('reports the turn-order effect the pooled redline divides out', () => {
        const edges = [...BALANCE_SPECIES]
            .map(species => ({ species, edge: mirrorOf(species).firstMoverEdge }))
            .sort((a, b) => b.edge - a.edge);

        console.log(
            '\nFirst-mover edge by species (positive = moving first wins):\n' +
                edges
                    .map(e => `  ${e.species.padEnd(14)} ${(e.edge * 100).toFixed(1)}%`)
                    .join('\n'),
        );

        // Not a balance redline - a sanity bound. An |edge| of 1.0 would mean the first
        // mover always wins, which would make every other batch in this suite a
        // measurement of turn order rather than of decks.
        for (const { species, edge } of edges) {
            expect(Math.abs(edge), `${species} first-mover edge`).toBeLessThan(1);
        }
    });
});

describe('Mirror Test - stalemate redline (balance_testing.md 2.2 turn count)', () => {
    it('every archetype can finish a game against itself', () => {
        const stalled = [...BALANCE_SPECIES]
            .map(species => ({ species, paired: mirrorOf(species) }))
            .filter(({ paired }) => paired.pooled.averageTurns > STALL_TURN_LIMIT)
            .map(
                ({ species, paired }) =>
                    `${species} (avg ${paired.pooled.averageTurns.toFixed(1)} turns, ` +
                    `${paired.pooled.draws}/${paired.pooled.iterations} draws)`,
            );

        expect(
            stalled,
            `Base decks that cannot close out a mirror within ${STALL_TURN_LIMIT} turns. ` +
                'Section 2.2 calls a matchup over 30 average turns "too slow/stalling (unfun)"; ' +
                'these never end at all, so their win rates carry no information.',
        ).toEqual([]);
    });
});
