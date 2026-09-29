/**
 * TICKET 169j — the tier ladder's arithmetic, on hand-made runs. The walking is in
 * `tierLadder.balance.ts`; this is what it folds the walks with.
 */
import { describe, expect, it } from 'vitest';

import { firstEasierStep, formatLadder, ladderRow } from './tierLadderTable';
import type { RunDigest } from './tierLadderTable';

const fight = (kind: string, won: boolean) => ({ kind, won });
const run = (fights: Array<[string, boolean]>, outcome: 'victory' | 'defeat', scrapAtEnd = 0): RunDigest => ({
    fights: fights.map(([kind, won]) => fight(kind, won)), outcome, scrapAtEnd,
});

const RUNS: RunDigest[] = [
    // Reaches the gym and wins it: a wild and a rival won, an elite won, three gym fights won.
    run([['wild', true], ['rival', true], ['elite', true], ['gym', true], ['gym', true], ['gym', true]], 'victory', 30),
    // Dies to the elite after losing a wild.
    run([['wild', true], ['wild', false], ['elite', false]], 'defeat', 10),
];

describe('ladderRow', () => {
    const row = ladderRow('Tier 0', RUNS);

    it('averages fights won per run', () => {
        expect(row.runs).toBe(2);
        expect(row.meanFightsWon).toBe(3.5); // 6 won in run one, 1 in run two
    });

    it('counts wild and rival fights together for the wild win rate', () => {
        // Run one: wild and rival both won (2 of 2). Run two: one wild won, one lost (1 of 2). So 3 of 4.
        expect(row.wildWinPct).toBeCloseTo(75);
    });

    it('counts only elite fights for the elite win rate', () => {
        expect(row.eliteWinPct).toBeCloseTo(50);
    });

    it('takes reaching the gym as playing a gym fight, and clearing it as winning the run', () => {
        expect(row.gymReachPct).toBe(50);
        expect(row.gymClearPct).toBe(50);
    });

    it('averages the scrap left unspent', () => {
        expect(row.meanScrapUnspent).toBe(20);
    });

    it('reports a rate with no fights behind it as null rather than 0', () => {
        expect(ladderRow('none', [run([['wild', true]], 'defeat')]).eliteWinPct).toBeNull();
        expect(ladderRow('empty', []).runs).toBe(0);
    });
});

describe('formatLadder', () => {
    it('prints a markdown table, with the scrap column only when asked', () => {
        const plain = formatLadder([ladderRow('Tier 0', RUNS)]);
        expect(plain.split('\n')).toHaveLength(3);
        expect(plain).toContain('| Tier 0 | 2 | 3.50 | 75.0% | 50.0% | 50.0% | 50.0% |');
        expect(plain).not.toContain('Scrap');
        expect(formatLadder([ladderRow('Tier 0', RUNS)], { scrap: true })).toContain('Scrap unspent');
    });
});

describe('firstEasierStep', () => {
    const rowOf = (label: string, won: number) => ladderRow(label, [run(Array.from({ length: won }, () => ['wild', true] as [string, boolean]), 'defeat')]);

    it('is null for a ladder that only gets harder, or stays level', () => {
        expect(firstEasierStep([rowOf('0', 5), rowOf('1', 4), rowOf('2', 4), rowOf('3', 2)])).toBeNull();
    });

    it('names the first step that gets easier', () => {
        const found = firstEasierStep([rowOf('0', 5), rowOf('1', 4), rowOf('2', 6), rowOf('3', 1)]);
        expect(found?.from.label).toBe('1');
        expect(found?.to.label).toBe('2');
    });
});
