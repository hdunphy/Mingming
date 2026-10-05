/**
 * TICKET 190g - which hits are "big", and the sparks that charge into the caster's mouth.
 */
import { describe, expect, it } from 'vitest';

import { TIER_PROFILES } from '../tiers/tierProfiles';
import { damageScale } from '../tiers/tierProfiles';
import { CHARGE_MOTES_PER_MS, chargeEffect, hitScale, isBigHit } from './bigHit';
import type { ParticleSeed } from '../particles';

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

describe('198b-4 - the charge-up is the lab\'s chargeFx', () => {
    const MUZZLE = { x: 300, y: 180 };
    const FIRE = { r: 224, g: 93, b: 67 };
    const HOT = { r: 255, g: 238, b: 170 };
    const charge = () => chargeEffect({ muzzle: MUZZLE, durationMs: 220, color: FIRE, hot: HOT, rng: counter() });

    /** Run the effect for its whole life in 16 ms frames and collect what it throws. */
    const run = (): ParticleSeed[] => {
        const effect = charge();
        const seeds: ParticleSeed[] = [];
        for (let age = 16; age <= 220; age += 16) effect.step(age, 16, (batch) => seeds.push(...batch));
        return seeds;
    };

    it('runs exactly as long as the wind-up', () => {
        expect(charge().durationMs).toBe(220);
    });

    it('throws 350 motes a second (0.35 per ms), born 60-90 px from the mouth and flying straight into it', () => {
        const seeds = run();
        expect(seeds.length).toBeGreaterThanOrEqual(Math.floor(208 * CHARGE_MOTES_PER_MS));
        expect(seeds.length).toBeLessThanOrEqual(Math.ceil(224 * CHARGE_MOTES_PER_MS));
        for (const seed of seeds) {
            const r = Math.hypot(seed.x - MUZZLE.x, seed.y - MUZZLE.y);
            expect(r).toBeGreaterThanOrEqual(60 - 1e-9);
            expect(r).toBeLessThanOrEqual(90 + 1e-9);
            // Velocity times life carries it exactly to the mouth.
            const dx = seed.x + (seed.vx * seed.life) / 1000 - MUZZLE.x;
            const dy = seed.y + (seed.vy * seed.life) / 1000 - MUZZLE.y;
            expect(Math.hypot(dx, dy)).toBeLessThan(1e-6);
            expect(seed.life).toBeGreaterThanOrEqual(180);
            expect(seed.life).toBeLessThanOrEqual(260);
        }
    });

    it('each mote is a glow, 3 px growing to 7, born hot and cooling to the element colour', () => {
        for (const seed of run()) {
            expect(seed.shape).toBe('glow');
            expect(seed.size).toBe(3);
            expect(seed.size2).toBe(7);
            expect([seed.r, seed.g, seed.b]).toEqual([HOT.r, HOT.g, HOT.b]);
            expect([seed.r2, seed.g2, seed.b2]).toEqual([FIRE.r, FIRE.g, FIRE.b]);
        }
    });

    it('draws a glow at the mouth without error', () => {
        const calls: string[] = [];
        const ctx = new Proxy({} as Record<string, unknown>, {
            get: (target, name: string) => (name in target ? target[name] : (...args: unknown[]) => { calls.push(`${name}:${args.length}`); }),
            set: (target, name: string, value) => { target[name] = value; return true; },
        });
        expect(() => charge().draw(ctx as unknown as CanvasRenderingContext2D, 110)).not.toThrow();
    });

    it('is deterministic for a given rng', () => {
        expect(run()).toEqual(run());
    });
});
