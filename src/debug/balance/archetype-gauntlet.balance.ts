/**
 * The Archetype Gauntlet - `docs/balance_testing.md` §2.2.
 *
 * One control archetype (Kraken, the §2.2 example) against every other species in the
 * registry, base deck vs base deck. §2.2's redlines are stated about the *archetype*, not
 * about individual matchups - "if >70%, the archetype is overtuned" - so they are asserted
 * on the gauntlet aggregate. Polarised individual matchups are printed, not redlined:
 * rock-paper-scissors between two archetypes is a design choice, and a per-matchup cap
 * would flag it as a bug.
 *
 * Every matchup runs under both turn orders and is pooled (see `runPairedBatch`). Without
 * that, a 60% win rate could be entirely first-mover advantage.
 *
 * Dead-card ratio is reported rather than asserted: §2.2 lists it as a metric for finding
 * trap cards and gives it no threshold, and inventing one here would be a redline this
 * repo never agreed to.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { BALANCE_SPECIES, CONTROL_SPECIES, matchupScenario } from './balanceScenarios';
import { quietly, summarizePaired } from './balanceReporting';
import { aggregate, runPairedBatch, type BatchResult, type PairedBatchResult } from './runBatch';

const SEEDS = 50;
const MAX_TURNS = 60;

/** §2.2: "If >70%, the archetype is overtuned." */
const OVERTUNED_WIN_RATE = 0.70;

/** §2.2: "If turns > 30, the archetype is too slow/stalling (unfun)." */
const STALL_TURN_LIMIT = 30;

const OPPONENTS = BALANCE_SPECIES.filter(species => species !== CONTROL_SPECIES);

interface Matchup {
    opponent: string;
    paired: PairedBatchResult;
}

let matchups: Matchup[];
let overall: BatchResult;

beforeAll(() => {
    matchups = OPPONENTS.map(opponent => ({
        opponent,
        paired: quietly(() =>
            runPairedBatch(matchupScenario({ player: CONTROL_SPECIES, enemy: opponent }), {
                iterations: SEEDS,
                maxTurns: MAX_TURNS,
            }),
        ),
    }));

    overall = aggregate(matchups.flatMap(m => m.paired.pooled.runs));

    console.log(
        `\n${CONTROL_SPECIES} control deck vs the registry ` +
            `(${SEEDS} seeds x 2 turn orders per matchup):\n` +
            matchups.map(m => '  ' + summarizePaired(`vs ${m.opponent}`, m.paired)).join('\n') +
            `\n  ${'-'.repeat(28)}\n` +
            `  ${CONTROL_SPECIES} overall: decisiveWin=${(overall.decisiveWinRate * 100).toFixed(1)}% ` +
            `avgTurns=${overall.averageTurns.toFixed(1)} ` +
            `deadCards=${(overall.deadCardRatio * 100).toFixed(1)}% ` +
            `(opponent side ${(overall.enemyDeadCardRatio * 100).toFixed(1)}%) ` +
            `ftk=${overall.ftkCount}/${overall.iterations} ` +
            `stalled=${overall.truncatedCount}/${overall.iterations}`,
    );
});

describe('Archetype Gauntlet (balance_testing.md 2.2)', () => {
    it(`${CONTROL_SPECIES} is not overtuned against the registry`, () => {
        expect(
            overall.decisiveWinRate,
            `${CONTROL_SPECIES} wins ${(overall.decisiveWinRate * 100).toFixed(1)}% of decided ` +
                `games across ${OPPONENTS.length} matchups. Over ${OVERTUNED_WIN_RATE * 100}% ` +
                'means the archetype is overtuned.',
        ).toBeLessThanOrEqual(OVERTUNED_WIN_RATE);
    });

    it(`${CONTROL_SPECIES} does not stall the game out`, () => {
        expect(
            overall.averageTurns,
            `${CONTROL_SPECIES} matchups average ${overall.averageTurns.toFixed(1)} turns. ` +
                `Over ${STALL_TURN_LIMIT} means the archetype is too slow to be fun.`,
        ).toBeLessThanOrEqual(STALL_TURN_LIMIT);
    });

    it('no matchup is won before the opponent gets to act', () => {
        // balance_testing.md section 3, "Zero-Interaction Wins (FTK)". The runner only
        // flags a turn-1 win by the side that *moved* first, so this is strictly "the
        // loser never played a card", not merely "the game was short".
        const ftkMatchups = matchups
            .filter(m => m.paired.pooled.ftkCount > 0)
            .map(
                m =>
                    `${CONTROL_SPECIES} vs ${m.opponent}: ${m.paired.pooled.ftkCount}/` +
                    `${m.paired.pooled.iterations} first-turn kills`,
            );

        expect(
            ftkMatchups,
            'A first mover won on turn 1 with the opponent never having acted.',
        ).toEqual([]);
    });
});
