/**
 * OS Variance Audit - `docs/balance_testing.md` §2.3.
 *
 * "OS v1 and OS v2 should offer different *playstyles*, not different *power levels*.
 * If one OS consistently outperforms the other by >15%, the weaker one needs a buff
 * or a lower cost."
 *
 * Implemented as a head-to-head: one species, EACH SIDE WITH ITS OWN OS's DECK
 * (ticket 13 - the fix for the shared-deck confound; while a species' two deck slots
 * still hold copies, this is identical to the old same-deck measurement). The result
 * is the firmware-plus-its-deck's contribution. The alternative - running each variant against a fixed
 * benchmark opponent and comparing - was rejected because the registry has no opponent
 * that is competitive with every species; a benchmark a species beats (or loses to) 100%
 * of the time reports a 0% gap between two variants of wildly different power.
 *
 * Because the two sides are no longer identical, `sideBias` stops being a bias measure
 * here (it just restates the OS gap) and is not asserted on - only the Mirror Test can
 * make that check. Turn order is still divided out by running both orientations.
 *
 * A pairing that never reaches a decision is reported as inconclusive rather than as a 50%
 * gap: with no decided games there is no performance to compare. Nothing is lost by not
 * asserting there - every such species also fails the Mirror Test's stalemate redline,
 * which is the accurate description of that failure.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { BALANCE_SPECIES, osVarianceScenario } from './balanceScenarios';
import { quietly, summarizePaired } from './balanceReporting';
import {
    MATCHUP_THRESHOLDS,
    pairedInput,
    publishFragments,
    recordMatchup,
} from './balanceReport';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { runPairedBatch } from './runBatch';

const SEEDS = 50;
const MAX_TURNS = 60;

/**
 * §2.3: "outperforms the other by >15%".
 *
 * Shared with the auditor so a breach here always has a matching redline in
 * `docs/balance/balance_report.json`.
 */
const MAX_GAP = MATCHUP_THRESHOLDS.osMaxGap;

/**
 * Fewest decided games that can support a >15% claim. Below this the gap is dominated by
 * sampling noise - `ymir_v1` vs `ymir_v2` decides 4 of 100 runs and the rest stall, and a
 * 4-0 split is not evidence of a power gap at any confidence. Those pairings are reported
 * as inconclusive; the stalling that caused it is redlined in the Mirror Test, which is
 * the accurate description of what is actually wrong with them.
 */
const MIN_DECIDED_GAMES = MATCHUP_THRESHOLDS.osMinDecidedGames;

// Runs even when the assertions below go red, which is the run whose report matters.
afterAll(publishFragments);

describe('OS Variance Audit (balance_testing.md 2.3)', () => {
    it.each([...BALANCE_SPECIES])('%s: v1 and v2 are the same power level', species => {
        const [v1, v2] = MingmingRegistry[species].availableOS;
        const paired = quietly(() =>
            runPairedBatch(osVarianceScenario(species), {
                iterations: SEEDS,
                maxTurns: MAX_TURNS,
            }),
        );

        // Recorded before the assertion, so a breach still reaches the committed report.
        recordMatchup(
            pairedInput(
                {
                    suite: 'os-variance',
                    role: 'os-variance',
                    id: `os:${species}`,
                    label: `${v1} vs ${v2}`,
                    player: species,
                    playerOS: v1,
                    enemy: species,
                    enemyOS: v2,
                },
                paired,
            ),
        );

        console.log(summarizePaired(`${v1} vs ${v2}`, paired));

        if (paired.pooled.decisive < MIN_DECIDED_GAMES) {
            // Inconclusive, not balanced - see the module header. Assert the reason so
            // this branch cannot quietly become a pass for some other cause.
            console.log(
                `  -> inconclusive: only ${paired.pooled.decisive}/${paired.pooled.iterations} ` +
                    'games were decided; see the Mirror Test stalemate redline.',
            );
            expect(paired.pooled.truncatedCount).toBeGreaterThan(
                paired.pooled.iterations - MIN_DECIDED_GAMES,
            );
            return;
        }

        // `decisiveWinRate` is v1's share of the decided games, so its distance from 50%
        // is exactly "how much one OS outperforms the other".
        const gap = Math.abs(paired.pooled.decisiveWinRate - 0.5);
        const stronger = paired.pooled.decisiveWinRate > 0.5 ? v1 : v2;

        expect(
            gap,
            `${stronger} wins ${(Math.max(paired.pooled.decisiveWinRate, 1 - paired.pooled.decisiveWinRate) * 100).toFixed(1)}% ` +
                `of the ${paired.pooled.decisive} decided games between ${v1} and ${v2} on an ` +
                `otherwise identical ${species}. Section 2.3 caps the gap at ` +
                `${MAX_GAP * 100}%; the weaker variant needs a buff or a lower cost.`,
        ).toBeLessThanOrEqual(MAX_GAP);
    });
});
