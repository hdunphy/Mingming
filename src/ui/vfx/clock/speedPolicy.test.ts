/**
 * TICKET 189a — the speed policy: ONE function that says how fast the battle clock runs.
 *
 * In 189 it says 1. Ticket 190a adds the tier setting, hold-to-fast-forward and catch-up as INPUTS
 * to this same function, so nothing downstream (the clock, hit-stop, the driver) changes again.
 */
import { describe, expect, it } from 'vitest';

import { BATTLE_SPEEDS, tierMultiplier } from './battleSpeedTiers';
import {
    CATCH_UP_MAX_QUEUED, FAST_FORWARD_MULTIPLIER, INSTANT, catchUpFactor, isInstantSpeed, speedMultiplier,
} from './speedPolicy';

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

describe('190a — the tiers, hold-to-fast-forward and catch-up feed the same function', () => {
    it('returns 1 / 1 / 1 / 2 / Instant for Slow, Showy, Snappy, Fast, Instant', () => {
        const got = BATTLE_SPEEDS.map((tier) => speedMultiplier({ tier }));
        expect(got).toEqual([1, 1, 1, 2, INSTANT]);
    });

    it('reads the table through tierMultiplier, with Instant as Infinity', () => {
        expect(tierMultiplier('fast')).toBe(2);
        expect(isInstantSpeed(tierMultiplier('instant'))).toBe(true);
    });

    it('is x3 while the fast-forward key is held, on top of the tier', () => {
        expect(FAST_FORWARD_MULTIPLIER).toBe(3);
        expect(speedMultiplier({ tier: 'showy', fastForward: true })).toBe(3);
        expect(speedMultiplier({ tier: 'fast', fastForward: true })).toBe(6);
        expect(speedMultiplier({ tier: 'showy', fastForward: false })).toBe(1);
    });

    it('is x1.4 with two cards queued, and tops out at x1.6 for a long pile-up', () => {
        expect(speedMultiplier({ tier: 'showy', queued: 2, catchUp: true })).toBeCloseTo(1.4);
        expect(speedMultiplier({ tier: 'showy', queued: 3, catchUp: true })).toBeCloseTo(1.6);
        expect(speedMultiplier({ tier: 'showy', queued: 40, catchUp: true })).toBeCloseTo(1.6);
        expect(CATCH_UP_MAX_QUEUED).toBe(3);
    });

    it('does nothing with catch-up off, or with nothing queued', () => {
        expect(speedMultiplier({ tier: 'showy', queued: 3, catchUp: false })).toBe(1);
        expect(speedMultiplier({ tier: 'showy', queued: 0, catchUp: true })).toBe(1);
        expect(catchUpFactor(-4, true)).toBe(1);
        expect(catchUpFactor(Number.NaN, true)).toBe(1);
    });

    it('is Instant at the Instant tier whatever else is set', () => {
        expect(isInstantSpeed(speedMultiplier({ tier: 'instant', fastForward: true, queued: 3, catchUp: true }))).toBe(true);
    });

    it('lets the old multiplier input still win over the tier, so the 189 tests keep their meaning', () => {
        expect(speedMultiplier({ multiplier: 2, tier: 'slow' })).toBe(2);
    });
});
