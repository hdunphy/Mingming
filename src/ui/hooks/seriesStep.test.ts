/**
 * TICKET 162e — the stated-series `step`, which is what stops a per-hit hook going silent.
 *
 * 147b coalesces identical SFX names fired within 60 ms so one event firing twice in a frame does
 * not double up. `step` is the documented exemption: a caller that says *"this is the Nth of a
 * series I meant"* both pitches the sound and skips the coalescer.
 *
 * EMBER_FUSE moved to a per-hit trigger on 2026-09-24, so Pack Tactics fires it three times inside
 * one reducer tick. All three cues carry the same name and land in the same millisecond, so without
 * a step the player HEARS ONE PROC while the board takes three Burn — the audio contradicting the
 * thing it is there to teach. That is the failure this file pins.
 *
 * `nextSeriesStep` is one rule with two callers (a cast's per-target impacts, and a hook firing per
 * swing), so it is tested once, here, rather than through either of them.
 */
import { describe, it, expect } from 'vitest';

import { nextSeriesStep, MAX_HIT_STEP } from './useBattleVfx';
import { SFX_COALESCE_WINDOW_MS, SfxRateLimiter } from '../audio/limiters';

const fresh = { key: '', step: 0, at: 0 };

describe('162e — a repeated hook is a stated series, not an accident', () => {
    it('climbs while the same key keeps firing inside one cast', () => {
        // Pack Tactics: three swings, three EMBER_FUSE procs, all in the same tick.
        let prior = fresh;
        const steps: number[] = [];
        for (const at of [1000, 1000, 1000]) {
            const step = nextSeriesStep(prior, 'skoll_v2_ember_fuse', at);
            steps.push(step);
            prior = { key: 'skoll_v2_ember_fuse', step, at };
        }
        expect(steps).toEqual([0, 1, 2]);
    });

    it('clamps, because a fourth rising semitone is not information', () => {
        let prior = fresh;
        const steps: number[] = [];
        // Serpent Flurry+ is four swings.
        for (let i = 0; i < 5; i += 1) {
            const step = nextSeriesStep(prior, 'h', 1000);
            steps.push(step);
            prior = { key: 'h', step, at: 1000 };
        }
        expect(steps).toEqual([0, 1, 2, 2, 2]);
        expect(Math.max(...steps)).toBe(MAX_HIT_STEP);
    });

    it('starts over for a DIFFERENT hook firing in the same beat', () => {
        // Two firmware going off together are two events, not a series. Stepping the second would
        // pitch it for a reason the player could never work out.
        const prior = { key: 'skoll_v2_ember_fuse', step: 1, at: 1000 };
        expect(nextSeriesStep(prior, 'cinder_wall', 1000)).toBe(0);
    });

    it('starts over for the same hook on the NEXT cast', () => {
        const prior = { key: 'h', step: 2, at: 1000 };
        expect(nextSeriesStep(prior, 'h', 1000 + 400)).toBe(0);
    });

    it('a lone event is step 0, so it is still protected by the coalescer', () => {
        /*
         * The half that matters as much as the climbing: `step` bypasses 147b's rate limiter, so a
         * counter that pitched every event would ALSO exempt every event from coalescing, and the
         * accidental double-fire the limiter exists for would come back. A single proc must read
         * as 0.
         */
        expect(nextSeriesStep(fresh, 'skoll_v2_ember_fuse', 5000)).toBe(0);
    });

    it('the window it is protecting against is real — three cues in a tick coalesce to one', () => {
        // Not a test of `nextSeriesStep`: a test that the problem exists. If the limiter ever stops
        // coalescing, this file is describing a danger that is gone and should be revisited.
        const limiter = new SfxRateLimiter();
        const plays = [0, 0, 0].map((_, i) => limiter.shouldPlay('osEmberFuse', 1000 + i));
        expect(plays).toEqual([true, false, false]);
        expect(SFX_COALESCE_WINDOW_MS).toBeGreaterThan(0);
    });
});
