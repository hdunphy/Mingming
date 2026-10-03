/**
 * TICKET 189a — the speed policy: ONE function that says how fast the battle clock runs.
 *
 * In 189 it says 1. Ticket 190a adds the tier setting, hold-to-fast-forward and catch-up as INPUTS
 * to this same function, so nothing downstream (the clock, hit-stop, the driver) changes again.
 */
import { describe, expect, it } from 'vitest';

import { INSTANT, isInstantSpeed, speedMultiplier } from './speedPolicy';

describe('189a — speedMultiplier', () => {
    it('is 1 with no inputs: this ticket ships one speed', () => {
        expect(speedMultiplier()).toBe(1);
        expect(speedMultiplier({})).toBe(1);
    });

    it('passes a finite positive multiplier through, for 190 to feed', () => {
        expect(speedMultiplier({ multiplier: 2 })).toBe(2);
        expect(speedMultiplier({ multiplier: 0.5 })).toBe(0.5);
    });

    it('falls back to 1 on a nonsense multiplier instead of freezing or exploding the clock', () => {
        expect(speedMultiplier({ multiplier: 0 })).toBe(1);
        expect(speedMultiplier({ multiplier: -3 })).toBe(1);
        expect(speedMultiplier({ multiplier: Number.NaN })).toBe(1);
    });

    it('says INSTANT (Infinity) when instant is asked for, whatever else is set', () => {
        expect(speedMultiplier({ instant: true })).toBe(INSTANT);
        expect(speedMultiplier({ instant: true, multiplier: 2 })).toBe(INSTANT);
        expect(isInstantSpeed(INSTANT)).toBe(true);
        expect(isInstantSpeed(1)).toBe(false);
    });
});
