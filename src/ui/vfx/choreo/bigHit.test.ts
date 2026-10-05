/**
 * TICKET 190g - which hits are "big", and the sparks that charge into the caster's mouth.
 */
import { describe, expect, it } from 'vitest';

import { TIER_PROFILES } from '../tiers/tierProfiles';
import { damageScale } from '../tiers/tierProfiles';
import { chargeSparks, hitScale, isBigHit } from './bigHit';

const counter = (): (() => number) => {
    let i = 0;
    return () => { i += 1; return ((i * 7919) % 1000) / 1000; };
};

describe('190g - what counts as a big hit', () => {
    it('is the hit\'s damage scale s, against the tier\'s threshold (194k-2)', () => {
        expect(hitScale(50, 1150)).toBeCloseTo(damageScale(50, 1150), 12);
        expect(hitScale(10, 0)).toBe(0);
        expect(isBigHit(0.6, 0.6)).toBe(true);
        expect(isBigHit(0.59, 0.6)).toBe(false);
    });

    it('194k-2: a median game hit (50 of 1,150, s 0.54) charges up on Showy and dims on Slow; a 103 dims on Showy', () => {
        const median = hitScale(50, 1150);
        expect(isBigHit(median, TIER_PROFILES.showy.chargeFrom)).toBe(true);
        expect(isBigHit(median, TIER_PROFILES.showy.dimFrom)).toBe(false);
        expect(isBigHit(median, TIER_PROFILES.slow.dimFrom)).toBe(true);
        expect(isBigHit(hitScale(103, 1150), TIER_PROFILES.showy.dimFrom)).toBe(true);
        // A 20-damage chip (s 0.34) is nobody's big hit on Showy.
        expect(isBigHit(hitScale(20, 1150), TIER_PROFILES.showy.chargeFrom)).toBe(false);
    });

    it('a tier with no threshold never has one', () => {
        expect(isBigHit(1, null)).toBe(false);
        expect(TIER_PROFILES.snappy.dimFrom).toBeNull();
        expect(TIER_PROFILES.snappy.chargeFrom).toBeNull();
        expect(TIER_PROFILES.snappy.cameraPunch).toBe(0);
    });

    it('Slow starts earlier than Showy', () => {
        expect(TIER_PROFILES.slow.dimFrom!).toBeLessThan(TIER_PROFILES.showy.dimFrom!);
        expect(TIER_PROFILES.slow.chargeFrom!).toBeLessThan(TIER_PROFILES.showy.chargeFrom!);
        expect(TIER_PROFILES.slow.cameraPunch).toBeGreaterThan(TIER_PROFILES.showy.cameraPunch);
    });
});

describe('190g - the charge-up', () => {
    const MUZZLE = { x: 300, y: 180 };
    const sparks = (s: number, over: Partial<Parameters<typeof chargeSparks>[0]> = {}) =>
        chargeSparks({ muzzle: MUZZLE, durationMs: 220, s, particleScale: 1, color: { r: 224, g: 93, b: 67 }, rng: counter(), ...over });

    it('throws sparks that start away from the mouth and end in it', () => {
        const seeds = sparks(0.8);
        expect(seeds.length).toBeGreaterThan(0);
        for (const seed of seeds) {
            const start = seed.path!(0);
            const end = seed.path!(1);
            expect(Math.hypot(start.x - MUZZLE.x, start.y - MUZZLE.y)).toBeGreaterThan(40);
            expect(Math.hypot(end.x - MUZZLE.x, end.y - MUZZLE.y)).toBeLessThan(1);
        }
    });

    it('arrive as the wind-up ends', () => {
        for (const seed of sparks(0.8)) expect(seed.life).toBe(220);
    });

    it('throws more for a bigger hit and for a showier tier', () => {
        expect(sparks(1).length).toBeGreaterThan(sparks(0.3).length);
        expect(sparks(0.8, { particleScale: 1.5 }).length).toBeGreaterThan(sparks(0.8, { particleScale: 0.85 }).length);
    });

    it('is deterministic for a given rng', () => {
        expect(sparks(0.5).map((s) => s.path!(0.2))).toEqual(sparks(0.5).map((s) => s.path!(0.2)));
    });
});
