/**
 * The pooled scrap curve and its before/after tables — ticket 174d.
 *
 * `scrapCurve.test.ts` holds the per-run arithmetic. This holds what is new here: the pooling
 * (means over the runs that reached a biome, not over all runs) and that the tables print.
 */

import { describe, expect, it } from 'vitest';

import { walkRun, type WalkResult } from './runWalker';
import { summariseScrapCurves } from './scrapCurveWalk';
import { formatBiomeComparison, formatRunComparison, formatSpendComparison } from './scrapCurveWalkReport';
import { scrapCurve, sumByReason } from '../../engine/run/scrapCurve';

const WALKS: WalkResult[] = [['fenrir_v2', 0], ['kraken_v1', 0]]
    .map(([starter, i]) => walkRun({ seed: `t174d:x:${starter}:${i}`, starter: starter as string, gymIndex: i as number, upgrades: true }));

describe('summariseScrapCurves', () => {
    const summary = summariseScrapCurves(WALKS);

    it('counts the walks and takes means over the runs that reached each biome', () => {
        expect(summary.runs).toBe(2);
        const biome0 = summary.biomes.find((b) => b.biome === 0)!;
        expect(biome0.reached).toBe(2);
        const expected = WALKS.map((w) => scrapCurve(w.log)[0].fights);
        expect(biome0.fights).toBeCloseTo((expected[0] + expected[1]) / 2, 10);
        for (const biome of summary.biomes) {
            expect(biome.reached).toBeLessThanOrEqual(summary.runs);
            expect(biome.incomeTotal).toBeCloseTo(Object.values(biome.income).reduce((a, b) => a + b, 0), 10);
            expect(biome.spentTotal).toBeCloseTo(Object.values(biome.spent).reduce((a, b) => a + b, 0), 10);
        }
    });

    it('agrees with scrapCurve on a single run', () => {
        const [only] = summariseScrapCurves([WALKS[0]]).biomes;
        const row = scrapCurve(WALKS[0].log)[0];
        expect(only.spentTotal).toBe(sumByReason(row.spent));
        expect(only.lowPoint).toBe(row.lowPoint);
        expect(only.scrapAtEnd).toBe(row.scrapAtEnd);
    });

    it('reads win rates off the walker\'s fight records', () => {
        const wilds = WALKS.flatMap((w) => w.fights).filter((f) => f.kind === 'wild');
        expect(summary.wild.played).toBe(wilds.length);
        expect(summary.wild.wins).toBe(wilds.filter((f) => f.won).length);
    });
});

describe('the before/after tables', () => {
    const summary = summariseScrapCurves(WALKS);

    it('print one block per biome and a row per spend reason', () => {
        const biomes = formatBiomeComparison(summary, summary);
        expect(biomes).toContain('### Biome 0');
        expect(biomes).toContain('| low point (scrap) |');
        expect(formatSpendComparison(summary, summary)).toContain('| biome | reason |');
        expect(formatRunComparison(summary, summary)).toContain('wild fights won');
    });

    it('show no change when an arm is compared with itself', () => {
        expect(formatBiomeComparison(summary, summary)).toContain('| +0.0 |'.replace('+0.0', '0.0'));
    });
});
