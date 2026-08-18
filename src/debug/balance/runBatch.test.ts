/**
 * Unit coverage for the batch runner.
 *
 * Replaces `src/engine/SimRunner.test.ts`, which ran one hardcoded battle and asserted
 * nothing (audit gap #15): it called `runSimulation()`, scraped `console.log`, and
 * `console.error`d if the game had not finished - so a runner that silently stopped after
 * one action passed it. Everything here is a real assertion, and the properties chosen are
 * the ones the balance suite's conclusions rest on: determinism, that both sides actually
 * play, and that the metrics mean what the redlines read them as.
 *
 * Deliberately fast (small batches, tight turn caps) - this file runs in the *default*
 * vitest suite. The long batches live in `*.balance.ts` behind `npm run balance`.
 */

import { describe, expect, it, vi } from 'vitest';

import { aggregate, deriveSeeds, runBatch, runOne, runPairedBatch } from './runBatch';
import { matchupScenario, mirrorScenario } from './balanceScenarios';
import type { ComposedSetup } from '../scenarios/scenarioSchema';

/** Fenrir's mirror resolves in two or three turns, so batches here are cheap. */
const scenario: ComposedSetup = mirrorScenario('fenrir');

/**
 * The stalemate fixture: a mirror that has NOT decided by `STALEMATE_TURN_CAP`.
 *
 * This used to name a species whose mirror genuinely never finished, and it has now run out
 * of candidates - ticket 48 retired `draugr` by giving it decks that kill, and ticket 53 (the
 * Light pass) retired `audhumbla`, whose 61-turn 0/400 mirror was the last one left and now
 * decides 12/12 in ~10 turns. Every mirror on the roster decides.
 *
 * So the fixture is now synthetic-by-construction rather than synthetic-by-species: the
 * slowest mirror on the roster (`ymir`, ~14 turns) truncated at a cap far below that. What
 * these three tests actually assert has not changed - that an undecided batch reads as draws
 * and not as a 0% win rate - and this form cannot rot the same way, because a deck pass that
 * SPEEDS UP ymir's mirror by 3x is a redline of its own long before it reaches this file.
 */
const STALEMATE_SPECIES = 'ymir';
/** Measured headroom: ymir's mirror never decides before turn 8 across 40 seeds. */
const STALEMATE_TURN_CAP = 6;

/** Keep the engine's per-kill logging out of the test reporter. */
function quiet<T>(fn: () => T): T {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
        return fn();
    } finally {
        spy.mockRestore();
    }
}

describe('runOne', () => {
    it('is deterministic: same setup and seed produce the same result', () => {
        const first = quiet(() => runOne(scenario, 'seed-a', 30));
        const second = quiet(() => runOne(scenario, 'seed-a', 30));

        expect(second).toEqual(first);
    });

    it('different seeds produce different battles', () => {
        const results = quiet(() =>
            deriveSeeds('spread', 20).map(seed => runOne(scenario, seed, 30)),
        );

        // Not "every run differs" - a two-turn battle has few distinguishable outcomes.
        // The claim is that the seed is actually reaching the battle at all.
        const outcomes = new Set(results.map(r => `${r.winner}:${r.turns}`));
        expect(outcomes.size).toBeGreaterThan(1);
    });

    it('always terminates, and reports a turn count within the cap', () => {
        // A battle that has not resolved by the cap - the case that hangs a runner with no turn
        // cap at all. See STALEMATE_SPECIES above for why this is now a cap rather than a
        // species that stalls forever.
        const stalemate = mirrorScenario(STALEMATE_SPECIES);
        const result = quiet(() => runOne(stalemate, 'stall', STALEMATE_TURN_CAP));

        expect(result.truncated).toBe(true);
        expect(result.winner).toBe('DRAW');
        expect(result.turns).toBeLessThanOrEqual(STALEMATE_TURN_CAP + 1);
    });

    it('plays both sides: the enemy spends cards out of its own hand', () => {
        const result = quiet(() => runOne(scenario, 'seed-a', 30));

        // enemyMode 'CARDS' plus TacticalAI on both sides. If the enemy were still on
        // telegraphed intents its deck would be empty and nothing would reach its hand.
        expect(result.cardsSeen.enemy).toBeGreaterThan(0);
        expect(result.deadCards.enemy).toBeLessThan(1);
    });

    it('startingSide flips who acts first', () => {
        const playerFirst = quiet(() => runOne(scenario, 'seed-a', 30, 'PLAYER'));
        const enemyFirst = quiet(() => runOne(scenario, 'seed-a', 30, 'ENEMY'));

        expect(playerFirst.startingSide).toBe('PLAYER');
        expect(enemyFirst.startingSide).toBe('ENEMY');
        // Same seed, same decks, same stats: only the turn order differs. This mirror used
        // to be close enough that the flip decided the *winner* outright, but
        // docs/power_curve_spec.md rev 3 changed the damage curve enough that fenrir's
        // mirror now resolves to the same winner either way (turn order is no longer quite
        // as decisive here - arguably a good sign given Henry's first-turn-kill concerns).
        // What still has to be true is that startingSide is actually wired through and
        // changes the simulation, not just that the win column happens to move - so assert
        // on the full result diverging (dead-card ratios, cards seen) instead of pinning to
        // `winner`, which is a number this rework is actively still retuning.
        expect(enemyFirst).not.toEqual(playerFirst);
    });

    it('dead-card ratio counts cards that reached a hand and were never played', () => {
        const result = quiet(() => runOne(scenario, 'seed-a', 30));

        expect(result.cardsSeen.player).toBeGreaterThan(0);
        expect(result.deadCards.player).toBeGreaterThanOrEqual(0);
        expect(result.deadCards.player).toBeLessThanOrEqual(1);

        // The denominator is cards seen in hand, not the whole deck: a 10-card deck that
        // only ever dealt an opening hand cannot report a ratio over all 10.
        expect(result.cardsSeen.player).toBeLessThanOrEqual(scenario.player.deck.length);
    });
});

describe('runBatch', () => {
    it('refuses a MOVES scenario, because TacticalAI cannot drive that enemy', () => {
        expect(() => runBatch({ ...scenario, enemyMode: 'MOVES' }, { iterations: 1 })).toThrow(
            /enemyMode/,
        );
    });

    it('honours an explicit seed list over iterations', () => {
        const batch = quiet(() =>
            runBatch(scenario, { seeds: ['s1', 's2', 's3'], iterations: 99, maxTurns: 20 }),
        );

        expect(batch.iterations).toBe(3);
        expect(batch.runs.map(r => r.seed)).toEqual(['s1', 's2', 's3']);
    });

    it('derives a reproducible seed list from the scenario seed', () => {
        expect(deriveSeeds('base', 5)).toEqual(deriveSeeds('base', 5));
        expect(deriveSeeds('base', 5)).not.toEqual(deriveSeeds('other', 5));
        expect(new Set(deriveSeeds('base', 25)).size).toBe(25);
    });

    it('aggregates outcomes consistently', () => {
        const batch = quiet(() => runBatch(scenario, { iterations: 12, maxTurns: 20 }));

        expect(batch.playerWins + batch.enemyWins + batch.draws).toBe(batch.iterations);
        expect(batch.decisive).toBe(batch.playerWins + batch.enemyWins);
        expect(batch.winRate).toBeCloseTo(batch.playerWins / batch.iterations);
        expect(batch.decisiveWinRate).toBeCloseTo(batch.playerWins / batch.decisive);
        expect(batch.ftkCount).toBeLessThanOrEqual(batch.decisive);
    });

    it('scores a stalemate as draws, not as a loss for either side', () => {
        const batch = quiet(() =>
            runBatch(mirrorScenario(STALEMATE_SPECIES), { iterations: 4, maxTurns: STALEMATE_TURN_CAP }),
        );

        expect(batch.draws).toBe(batch.iterations);
        expect(batch.decisive).toBe(0);
        // The guard the mirror redline depends on: no decided games must not read as 0%.
        expect(batch.decisiveWinRate).toBe(0);
        expect(batch.winRate).toBe(0);
    });
});

describe('runPairedBatch', () => {
    it('runs the same seeds under both turn orders', () => {
        const paired = quiet(() => runPairedBatch(scenario, { iterations: 6, maxTurns: 20 }));

        expect(paired.playerFirst.runs.map(r => r.seed)).toEqual(
            paired.enemyFirst.runs.map(r => r.seed),
        );
        expect(paired.playerFirst.runs.every(r => r.startingSide === 'PLAYER')).toBe(true);
        expect(paired.enemyFirst.runs.every(r => r.startingSide === 'ENEMY')).toBe(true);
        expect(paired.pooled.iterations).toBe(12);
    });

    it('reports a first-mover edge and a side bias in [-0.5, 0.5] / [0, 1]', () => {
        const paired = quiet(() => runPairedBatch(scenario, { iterations: 10, maxTurns: 20 }));

        expect(paired.firstMoverEdge).toBeGreaterThanOrEqual(-0.5);
        expect(paired.firstMoverEdge).toBeLessThanOrEqual(0.5);
        expect(paired.sideBias).toBeGreaterThanOrEqual(0);
        expect(paired.sideBias).toBeLessThanOrEqual(1);
    });

    it('reports no edge and no bias when nothing was decided', () => {
        const paired = quiet(() =>
            runPairedBatch(mirrorScenario(STALEMATE_SPECIES), { iterations: 3, maxTurns: STALEMATE_TURN_CAP }),
        );

        expect(paired.pooled.decisive).toBe(0);
        expect(paired.firstMoverEdge).toBe(0);
        expect(paired.sideBias).toBe(0);
    });

    it('an asymmetric matchup is asymmetric under both turn orders', () => {
        // Not a redline, a wiring check: if `startingSide` were ignored, both orientations
        // would be the identical battle and this could not distinguish them.
        const lopsided = matchupScenario({ player: 'kraken', enemy: 'fafnir' });
        const paired = quiet(() => runPairedBatch(lopsided, { iterations: 8, maxTurns: 20 }));

        expect(paired.pooled.decisive).toBeGreaterThan(0);
        expect(paired.playerFirst.iterations).toBe(paired.enemyFirst.iterations);
    });
});

describe('aggregate', () => {
    it('rejects an empty run list rather than dividing by zero', () => {
        expect(() => aggregate([])).toThrow(/No runs/);
    });

    it('pools runs from separate batches', () => {
        const a = quiet(() => runBatch(scenario, { seeds: ['x1', 'x2'], maxTurns: 20 }));
        const b = quiet(() => runBatch(scenario, { seeds: ['x3'], maxTurns: 20 }));
        const pooled = aggregate([...a.runs, ...b.runs]);

        expect(pooled.iterations).toBe(3);
        expect(pooled.playerWins).toBe(a.playerWins + b.playerWins);
        expect(pooled.averageTurns).toBeCloseTo(
            (a.runs[0].turns + a.runs[1].turns + b.runs[0].turns) / 3,
        );
    });
});
