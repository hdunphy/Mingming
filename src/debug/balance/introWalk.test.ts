/**
 * TICKET 182c — the intro walk's plumbing. The measurement itself (3 starters x 30 seeds) is run by
 * hand with `runIntroWalk.ts` and written up in `docs/balance/intro-run-182.md`; what is pinned here
 * is only that the walker can walk the intro at all, and reads it the way the report says it does.
 */
import { describe, expect, it } from 'vitest';

import { INTRO_STARTERS_V1, minutesAt, summariseIntro, walkIntro, type IntroWalkRow } from './introWalk';
import { walkRun } from './runWalker';

describe('182c the intro walk', () => {
    it('walks the intro map: two fights on the way at most, the free recruit, then the one-fight leader', () => {
        const result = walkRun({ seed: 'intro-walk-test:kraken_v1:0', starter: 'kraken_v1', gymIndex: 0, intro: true, ghost: true });
        const kinds = result.fights.map((f) => f.kind);
        expect(kinds[kinds.length - 1]).toBe('gym');
        expect(kinds.filter((k) => k === 'gym')).toHaveLength(1);
        expect(result.fights.length).toBeLessThanOrEqual(4);
        expect(result.log.events.some((e) => e.kind === 'RECRUITED')).toBe(true);
        // The intro has no patch bench anywhere.
        expect(result.patches).toEqual([]);
    });

    it('is deterministic in its seed', () => {
        const a = walkIntro('fenrir_v1', 2, 'intro-walk-det');
        const b = walkIntro('fenrir_v1', 2, 'intro-walk-det');
        expect(b).toEqual(a);
    });

    it('reads the leader as the gym fight, and the rate as wins over runs that reached it', () => {
        const row = (over: Partial<IntroWalkRow>): IntroWalkRow => ({
            seed: 's', starter: 'x', reachedLeader: true, leaderWon: true, cleared: true,
            fights: 3, turns: 12, recruited: 'fenrir', leaderTurns: 4, maxFightTurns: 5, ...over,
        });
        const summary = summariseIntro('x', [
            row({}), row({ leaderWon: false, cleared: false }), row({ reachedLeader: false, leaderWon: false, cleared: false, fights: 1, turns: 3, recruited: null }),
        ]);
        expect(summary.runs).toBe(3);
        expect(summary.reachedLeader).toBe(2);
        expect(summary.leaderWins).toBe(1);
        expect(summary.leaderWinRate).toBeCloseTo(0.5);
        expect(summary.clearRate).toBeCloseTo(1 / 3);
        expect(summary.recruits).toEqual({ fenrir: 2 });
        expect(summary.turnsPerFight).toBeCloseTo(27 / 7);
        expect(summary.maxFightTurns).toBe(5);
        expect(minutesAt(summary, 20)).toBeCloseTo((summary.meanTurns * 20) / 60);
    });

    it('measures the three starters', () => {
        expect(INTRO_STARTERS_V1).toEqual(['kraken_v1', 'fenrir_v1', 'ratatoskr_v1']);
    });
});
