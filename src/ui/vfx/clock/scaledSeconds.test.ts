/**
 * TICKET 189a — a framer-motion duration expressed through the clock multiplier.
 *
 * For motion that cannot be held to the clock by pause/resume (the played card's flight is a
 * `calc()`-valued transform that must keep running on framer's own engine), the next best thing is
 * to START it at the right length: the speed tiers and Instant then still shorten it.
 */
import { describe, expect, it } from 'vitest';

import { scaledSeconds } from './scaledSeconds';
import { INSTANT } from './speedPolicy';

describe('189a — scaledSeconds', () => {
    it('is ms / 1000 at speed 1', () => {
        expect(scaledSeconds(180, 1)).toBeCloseTo(0.18, 8);
    });

    it('divides by the multiplier', () => {
        expect(scaledSeconds(200, 2)).toBeCloseTo(0.1, 8);
        expect(scaledSeconds(200, 0.5)).toBeCloseTo(0.4, 8);
    });

    it('is 0 at Instant, so skipping animation skips the flight too', () => {
        expect(scaledSeconds(180, INSTANT)).toBe(0);
    });

    it('treats a nonsense multiplier as 1', () => {
        expect(scaledSeconds(100, 0)).toBeCloseTo(0.1, 8);
        expect(scaledSeconds(100, Number.NaN)).toBeCloseTo(0.1, 8);
    });
});
