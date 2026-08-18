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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BALANCE_SPECIES, CONTROL_SPECIES, matchupScenario } from './balanceScenarios';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { quietly, summarizePaired } from './balanceReporting';
import {
    MATCHUP_THRESHOLDS,
    pairedInput,
    publishFragments,
    recordMatchup,
} from './balanceReport';
import { aggregate, runPairedBatch, type BatchResult, type PairedBatchResult } from './runBatch';

const SEEDS = 50;
const MAX_TURNS = 60;

/**
 * §2.2: "If >70%, the archetype is overtuned."
 *
 * Shared with the auditor so the assertion and the committed report cannot disagree about
 * where the line is.
 */
const OVERTUNED_WIN_RATE = MATCHUP_THRESHOLDS.overtunedWinRate;

/** §2.2: "If turns > 30, the archetype is too slow/stalling (unfun)." */
const STALL_TURN_LIMIT = MATCHUP_THRESHOLDS.stallTurnLimit;

/**
 * Ticket 47: EVERY firmware, not just `availableOS[0]`.
 *
 * The gauntlet used to take the registry's default OS for each opponent, which meant that in
 * a roster where every species carries two decks, HALF of them had never been measured against
 * the floor at all. Ratatoskr is the case that exposed it: the control loses 100% to
 * ratatoskr_v1 and *beats* ratatoskr_v2, because `baseline_purge`'s cleanse wipes the Dazed
 * pile `slander` scales on. §2.3 could not see that either - it reports the gap between the two
 * firmwares and is blind to where either sits - so a deck could be below the floor with every
 * gate green.
 *
 * Same class of blind spot as ticket 42's: an instrument that measures a difference and gets
 * read as if it measured a level.
 */
const OPPONENTS: ReadonlyArray<{ species: string; os: string }> = BALANCE_SPECIES
    .filter(species => species !== CONTROL_SPECIES)
    .flatMap(species => MingmingRegistry[species].availableOS.map(os => ({ species, os })));

interface Matchup {
    opponent: string;
    os: string;
    paired: PairedBatchResult;
}

let matchups: Matchup[];
let overall: BatchResult;

beforeAll(() => {
    matchups = OPPONENTS.map(({ species: opponent, os }) => {
        const setup = matchupScenario({ player: CONTROL_SPECIES, enemy: opponent, enemyOS: os });
        const paired = quietly(() =>
            runPairedBatch(setup, { iterations: SEEDS, maxTurns: MAX_TURNS }),
        );

        // Individual matchups carry no win-rate or turn-count redline (see the module
        // header), but their metrics are the sortable half of the report and their FTK
        // count is a §3 redline wherever it appears.
        recordMatchup(
            pairedInput(
                {
                    suite: 'archetype-gauntlet',
                    role: 'gauntlet-matchup',
                    id: `gauntlet:${CONTROL_SPECIES}-vs-${opponent}:${os}`,
                    label: `${CONTROL_SPECIES} vs ${opponent} (${os})`,
                    player: CONTROL_SPECIES,
                    playerOS: setup.player.party[0].activeOS ?? '',
                    enemy: opponent,
                    enemyOS: setup.enemies[0].activeOS ?? '',
                },
                paired,
            ),
        );

        return { opponent, os, paired };
    });

    overall = aggregate(matchups.flatMap(m => m.paired.pooled.runs));

    // The aggregate is what §2.2's two redlines are actually stated about, so it gets its
    // own record rather than being recomputed from the matchup rows by a reader.
    recordMatchup({
        suite: 'archetype-gauntlet',
        role: 'gauntlet-overall',
        id: `gauntlet:${CONTROL_SPECIES}-overall`,
        label: `${CONTROL_SPECIES} control deck vs the registry`,
        player: CONTROL_SPECIES,
        playerOS: '',
        enemy: '*registry*',
        enemyOS: '',
        pooled: overall,
    });

    // Ticket 47: the pooled number now mixes both firmwares, so the per-slot aggregates are
    // recorded too. The FIRST-slot row is the one ticket 45 calibrated the control's ~25%
    // against, and keeping it addressable is what lets that calibration still be checked.
    for (const slot of [0, 1]) {
        const inSlot = matchups.filter(
            m => MingmingRegistry[m.opponent].availableOS.indexOf(m.os) === slot,
        );
        if (inSlot.length === 0) continue;
        recordMatchup({
            suite: 'archetype-gauntlet',
            role: 'gauntlet-overall',
            id: `gauntlet:${CONTROL_SPECIES}-overall:slot${slot + 1}`,
            label: `${CONTROL_SPECIES} control deck vs every slot-${slot + 1} firmware`,
            player: CONTROL_SPECIES,
            playerOS: '',
            enemy: '*registry*',
            enemyOS: '',
            pooled: aggregate(inSlot.flatMap(m => m.paired.pooled.runs)),
        });
    }

    console.log(
        `\n${CONTROL_SPECIES} control deck vs the registry ` +
            `(${SEEDS} seeds x 2 turn orders per matchup):\n` +
            matchups.map(m => '  ' + summarizePaired(`vs ${m.opponent} (${m.os})`, m.paired)).join('\n') +
            `\n  ${'-'.repeat(28)}\n` +
            `  ${CONTROL_SPECIES} overall: decisiveWin=${(overall.decisiveWinRate * 100).toFixed(1)}% ` +
            `avgTurns=${overall.averageTurns.toFixed(1)} ` +
            `deadCards=${(overall.deadCardRatio * 100).toFixed(1)}% ` +
            `(opponent side ${(overall.enemyDeadCardRatio * 100).toFixed(1)}%) ` +
            `ftk=${overall.ftkCount}/${overall.iterations} ` +
            `stalled=${overall.truncatedCount}/${overall.iterations}`,
    );
});

// Runs even when the assertions below go red, which is the run whose report matters.
afterAll(publishFragments);

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
                    `${CONTROL_SPECIES} vs ${m.opponent} (${m.os}): ${m.paired.pooled.ftkCount}/` +
                    `${m.paired.pooled.iterations} first-turn kills`,
            );

        expect(
            ftkMatchups,
            'A first mover won on turn 1 with the opponent never having acted.',
        ).toEqual([]);
    });
});
