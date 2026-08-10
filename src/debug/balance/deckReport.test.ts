/**
 * Ticket 26. The claims worth pinning are the ones a reader would be misled by if they broke:
 * that telemetry is genuinely off unless asked for, that the two per-card denominators mean
 * what the column headers say, and that `measuredScore` only moves the terms it claims to.
 */

import { describe, expect, it } from 'vitest';

import { mirrorScenario } from './balanceScenarios';
import { runBatch, runOne } from './runBatch';
import { calculatePowerscale } from './powerscale';
import { GetProgramData } from '../../engine/data/programRegistry';
import { buildDeckReport, DECK_REPORT_THRESHOLDS } from './deckReport';
import { quietly } from './balanceReporting';

describe('runBatch telemetry', () => {
    it('is absent unless asked for - the commit gate must not pay for it', () => {
        const run = quietly(() => runOne(mirrorScenario('ratatoskr'), 'telemetry-off', 20));
        expect(run.telemetry).toBeUndefined();

        const batch = quietly(() => runBatch(mirrorScenario('ratatoskr'), { iterations: 2, maxTurns: 20 }));
        expect(batch.runs.every(r => r.telemetry === undefined)).toBe(true);
    });

    it('records plays, damage and status stacks when it is', () => {
        const batch = quietly(() =>
            runBatch(mirrorScenario('ratatoskr'), { iterations: 3, maxTurns: 30, telemetry: true }));
        const t = batch.runs[0].telemetry;
        expect(t).toBeDefined();
        expect(Object.keys(t!.PLAYER.played).length).toBeGreaterThan(0);
        expect(t!.PLAYER.totalDamage).toBeGreaterThan(0);
        // Every card that dealt damage must also have been played - the two maps are keyed the
        // same way, and a damage entry with no play would mean the attribution slipped a frame.
        for (const id of Object.keys(t!.PLAYER.directDamage)) {
            expect(t!.PLAYER.played[id]).toBeGreaterThan(0);
        }
    });

    it('keeps the two denominators separate: instances for dead rate, hand entries for play rate', () => {
        const batch = quietly(() =>
            runBatch(mirrorScenario('ratatoskr'), { iterations: 5, maxTurns: 40, telemetry: true }));
        for (const run of batch.runs) {
            const t = run.telemetry!.PLAYER;
            for (const [id, instances] of Object.entries(t.seen)) {
                // An instance can enter hand more than once (reshuffles), never fewer times than
                // it exists. This is the invariant that stops `playRate` exceeding 1, which is
                // exactly what the first version of this did.
                expect(t.handEntries[id] ?? 0).toBeGreaterThanOrEqual(instances);
                // And a copy cannot be "played at least once" more often than it exists.
                expect(t.instancesPlayed[id] ?? 0).toBeLessThanOrEqual(instances);
            }
        }
    });
});

describe('powerscale portions', () => {
    it('splits the score into the two terms the deck report re-measures', () => {
        // `nettle_sting` is 22 power plus 1 Poison - one action of each kind, so the split is
        // checkable by hand rather than by restating the formula.
        const r = calculatePowerscale(GetProgramData('nettle_sting'));
        expect(r.damagePortion).toBeGreaterThan(0);
        expect(r.statusPortion).toBeGreaterThan(0);
        expect(r.damagePortion + r.statusPortion).toBeCloseTo(r.score, 1);
    });

    it('leaves a card with no damage or status terms fully deterministic', () => {
        // `squirrel_away` is Draw 2 and nothing else, so there is nothing for the measured pass
        // to replace and `measuredScore` must equal `staticScore`.
        const r = calculatePowerscale(GetProgramData('squirrel_away'));
        expect(r.damagePortion).toBe(0);
        expect(r.statusPortion).toBe(0);
    });
});

describe('buildDeckReport', () => {
    it('builds a report whose card rows agree with the telemetry they came from', () => {
        const paired = quietly(() => ({
            playerFirst: runBatch(mirrorScenario('ratatoskr'), { iterations: 4, maxTurns: 40, telemetry: true, startingSide: 'PLAYER' }),
            enemyFirst: runBatch(mirrorScenario('ratatoskr'), { iterations: 4, maxTurns: 40, telemetry: true, startingSide: 'ENEMY' }),
        }));
        const pooled = quietly(() => runBatch(mirrorScenario('ratatoskr'), { iterations: 8, maxTurns: 40, telemetry: true }));

        const { report, warnings } = buildDeckReport({
            command: 'test',
            config: {
                suites: ['mirror'], iterations: 4, maxTurns: 40,
                seedBase: 'test', thresholds: DECK_REPORT_THRESHOLDS,
            },
            control: null,
            subjects: [{
                id: 'ratatoskr_v1', species: 'ratatoskr', os: 'ratatoskr_v1',
                matchups: [{
                    id: 'test:mirror', suite: 'mirror', role: 'mirror', label: 'test',
                    subjectId: 'ratatoskr_v1', subjectSpecies: 'ratatoskr', subjectOS: 'ratatoskr_v1',
                    opponent: 'ratatoskr', opponentOS: 'ratatoskr_v1', subjectSide: 'PLAYER',
                    paired: {
                        ...paired,
                        pooled,
                        firstMoverEdge: 0,
                        sideBias: 0,
                    },
                }],
            }],
        });

        expect(report.schemaVersion).toBe(2);
        // Nothing is a placeholder any more - that field exists so a stale viewer cannot
        // silently start trusting mock data, and an empty array is the assertion that it is real.
        expect(report.notes.instrumentationPending).toEqual([]);
        expect(warnings).toEqual([]);
        expect(report.cards.length).toBeGreaterThan(0);
        expect(report.cards.every(c => c.isMocked === false)).toBe(true);

        for (const card of report.cards) {
            expect(card.playRate).toBeLessThanOrEqual(1);
            expect(card.deadRate).toBeGreaterThanOrEqual(0);
            expect(card.deadRate).toBeLessThanOrEqual(1);
            // measuredScore only ever moves the damage and status terms, so a card the search
            // never played must land exactly on its static score.
            if (card.timesPlayed === 0) expect(card.measuredScore).toBe(card.staticScore);
            expect(card.confidence).toBe(
                card.timesPlayed >= DECK_REPORT_THRESHOLDS.cardPlays ? 'ok' : 'low-sample');
        }
    });
});
