/**
 * TICKET 157 — the walker's EXPENSIVE claims, in the suite that pays for battles.
 *
 * `runWalker.test.ts` holds the policy and the joins, which are pure functions and cost nothing.
 * These three play whole runs — real encounters at the encounter's own beam — and one of them costs
 * more than a fifth of `npm run gate`. That is the line `*.balance.ts` exists to draw: `npm run
 * balance` runs this suite, the gate does not.
 *
 * What is here and nowhere else:
 *
 *  - **determinism in the seed**, which is the whole value of a seeded harness and cannot be shown
 *    without walking twice;
 *  - **the summary table**, because §3's four outputs are only meaningful over a SET of runs;
 *  - **the twelve starters all walk**, which is the claim a report over the EA twelve rests on and
 *    the one that would otherwise be discovered at hour three of an overnight job.
 */
import { describe, expect, it } from 'vitest';

import { walkRun, summarise, walkStarter, eaStarters } from './runWalker';

describe('157 — a walk is reproducible', () => {
    it('is deterministic in its seed', () => {
        // Asserted on the fight list rather than on the log, because the log carries a run key
        // derived from the start timestamp.
        const a = walkRun({ seed: 'walker-determinism', starter: 'fenrir_v1', gymIndex: 1 });
        const b = walkRun({ seed: 'walker-determinism', starter: 'fenrir_v1', gymIndex: 1 });
        expect(b.fights).toEqual(a.fights);
        expect(b.finalDeck).toEqual(a.finalDeck);
        expect(b.picks).toEqual(a.picks);
        expect(b.recruits).toEqual(a.recruits);
        expect(b.outcome).toBe(a.outcome);
    });

    it('varies with the seed, so a batch is a sample and not one run repeated', () => {
        // The other half, and the failure it guards is the one `sampleFight`'s header describes:
        // a harness that varies only the shuffle replays the same fight N times and calls it N.
        const runs = walkStarter('kraken_v1', 3, 'walker-spread');
        // Compared on the whole fight list, not its length. Three different walks can die at the
        // same fight by chance: on 2026-09-27, after 164h's new PRNG re-rolled every seed, all three
        // of these lost fight 4 (the next five seeds died at 4, 7, 3, 7 and 9). That is a
        // coincidence of length, not one run replayed, and only the length check could not tell.
        expect(new Set(runs.map((r) => JSON.stringify(r.fights))).size).toBe(runs.length);
    });
});

describe('157 — the summary is §3\'s four outputs', () => {
    it('folds a set of walks into the deck-power curve, the per-index win rate and the pick census', () => {
        const runs = walkStarter('kraken_v1', 3, 'walker-summary');
        const summary = summarise('kraken_v1', runs);

        expect(summary.runs).toBe(3);
        expect(summary.byFightIndex[0].played).toBe(3);
        // Conditional on reaching it: later indices can only have been played by fewer runs.
        for (let i = 1; i < summary.byFightIndex.length; i += 1) {
            expect(summary.byFightIndex[i].played).toBeLessThanOrEqual(summary.byFightIndex[i - 1].played);
        }
        expect(summary.picks.offered).toBeGreaterThanOrEqual(summary.picks.taken);
        expect(summary.picks.toCollection).toBeLessThanOrEqual(summary.picks.taken);
        expect(summary.deckPowerAt.f1).not.toBeNull();
        expect(summary.victories + Object.values(summary.diedAtBiome).reduce((a, b) => a + b, 0)).toBe(3);
    });
});

describe('157 — every EA starter walks', () => {
    it.each(eaStarters())('%s plays a run without throwing', (starter: string) => {
        // One seed each. The point is coverage of the twelve, not a measurement — the measurement is
        // `npm run balance:walk`. This is what stops an overnight job dying on starter nine.
        const result = walkRun({ seed: `walker-smoke:${starter}`, starter, gymIndex: 0 });
        expect(result.fights.length).toBeGreaterThan(0);
        expect(result.starter).toBe(starter);
    });
});
