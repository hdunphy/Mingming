/**
 * TICKET 190e - the bursts where an attack lands.
 *
 * Particle count = round((12 + 26 s) x matchup x the tier's particleScale). Each element throws its
 * own thing; a super-effective hit adds a white ring and star sparks; a resisted one adds a grey
 * fizzle; a kill adds a white ring. Everything here is pure (seeds in, seeds out).
 */
import { describe, expect, it } from 'vitest';

import type { ParticleSeed } from '../particles';
import { TIER_PROFILES } from '../tiers/tierProfiles';
import { buildImpact } from './buildImpact';
import type { ImpactInput } from './ImpactInput';
import { impactCount, matchupOf } from './impactCount';

/** A repeatable rng: the same sequence every time. */
const counter = (): (() => number) => {
    let i = 0;
    return () => { i += 1; return ((i * 7919) % 1000) / 1000; };
};

const AT = { x: 900, y: 100, w: 190, h: 190 };
const base: ImpactInput = {
    at: AT, s: 0.5, matchup: 'normal', isKill: false, direction: 1, particleScale: 1, rng: counter(),
    color: { r: 224, g: 93, b: 67 },
};
const build = (element: Parameters<typeof buildImpact>[0], over: Partial<ImpactInput> = {}): ParticleSeed[] =>
    buildImpact(element, { ...base, rng: counter(), ...over });
const ofShape = (seeds: ParticleSeed[], shape: string): ParticleSeed[] => seeds.filter((seed) => seed.shape === shape);
const isWhite = (seed: ParticleSeed): boolean => seed.r >= 250 && seed.g >= 250 && seed.b >= 250;

describe('190e - how many particles a hit throws', () => {
    it('is round((12 + 26 s) x matchup x the tier scale)', () => {
        expect(impactCount(0, 'normal', 1)).toBe(12);
        expect(impactCount(1, 'normal', 1)).toBe(38);
        expect(impactCount(0.5, 'normal', 1)).toBe(25);
        expect(impactCount(0.5, 'super', 1)).toBe(Math.round(25 * 1.5));
        expect(impactCount(0.5, 'resisted', 1)).toBe(Math.round(25 * 0.5));
        expect(impactCount(0.5, 'normal', 1.3)).toBe(Math.round(25 * 1.3));
    });

    it('grows with the damage scale and with a super-effective hit, and shrinks when resisted', () => {
        expect(impactCount(1, 'normal', 1)).toBeGreaterThan(impactCount(0.2, 'normal', 1));
        expect(impactCount(0.5, 'super', 1)).toBeGreaterThan(impactCount(0.5, 'normal', 1));
        expect(impactCount(0.5, 'resisted', 1)).toBeLessThan(impactCount(0.5, 'normal', 1));
    });

    it('reads the matchup off the card (doubled / resisted)', () => {
        expect(matchupOf(true, false)).toBe('super');
        expect(matchupOf(false, true)).toBe('resisted');
        expect(matchupOf(false, false)).toBe('normal');
    });

    it('is built from the active tier: Slow throws more than Showy, Showy more than Snappy', () => {
        const slow = impactCount(0.5, 'normal', TIER_PROFILES.slow.particleScale);
        const showy = impactCount(0.5, 'normal', TIER_PROFILES.showy.particleScale);
        const snappy = impactCount(0.5, 'normal', TIER_PROFILES.snappy.particleScale);
        expect(slow).toBeGreaterThan(showy);
        expect(showy).toBeGreaterThan(snappy);
    });
});

describe('190e - each element throws its own thing', () => {
    it('Fire: embers spray away from the attacker, dark smoke, an orange ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const ahead = build('Fire', { direction: 1 });
        const embers = ofShape(ahead, 'flame');
        expect(embers).toHaveLength(count);
        expect(embers.every((e) => e.vx > 0)).toBe(true);
        expect(build('Fire', { direction: -1 }).filter((s) => s.shape === 'flame').every((e) => e.vx < 0)).toBe(true);
        const smoke = ofShape(ahead, 'puff');
        expect(smoke.length).toBeGreaterThan(0);
        expect(smoke.every((p) => p.r < 120 && p.g < 120 && p.b < 120)).toBe(true);
        const ring = ofShape(ahead, 'ring');
        expect(ring).toHaveLength(1);
        expect(ring[0].r).toBeGreaterThan(ring[0].b);
    });

    it('Water: drops arc up and fall, a mist, a blue ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const seeds = build('Water', { color: { r: 61, g: 155, b: 224 } });
        const drops = ofShape(seeds, 'drop');
        expect(drops).toHaveLength(count);
        expect(drops.every((d) => d.vy < 0 && (d.gravity ?? 0) > 0)).toBe(true);
        expect(ofShape(seeds, 'puff').length).toBeGreaterThan(0);
        const ring = ofShape(seeds, 'ring');
        expect(ring).toHaveLength(1);
        expect(ring[0].b).toBeGreaterThan(ring[0].r);
    });

    it('Nature: leaves tumble, green sparks, a ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const seeds = build('Nature', { color: { r: 67, g: 180, b: 95 } });
        expect(ofShape(seeds, 'leaf')).toHaveLength(count);
        const sparks = ofShape(seeds, 'spark');
        expect(sparks.length).toBeGreaterThan(0);
        expect(sparks.every((p) => p.g > p.r && p.g > p.b)).toBe(true);
        expect(ofShape(seeds, 'ring')).toHaveLength(1);
    });

    it('None: white streaks and a ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const seeds = build('None', { color: { r: 154, g: 163, b: 173 } });
        const streaks = ofShape(seeds, 'streak');
        expect(streaks).toHaveLength(count);
        expect(streaks.every(isWhite)).toBe(true);
        expect(ofShape(seeds, 'ring')).toHaveLength(1);
    });

    it('an element with no effect of its own throws streaks in its colour', () => {
        const seeds = build('Ice', { color: { r: 127, g: 214, b: 255 } });
        const streaks = ofShape(seeds, 'streak');
        expect(streaks).toHaveLength(impactCount(0.5, 'normal', 1));
        expect(streaks.some((s) => s.r < 250)).toBe(true);
    });

    it('the main burst scales with s', () => {
        const small = ofShape(build('Fire', { s: 0.1 }), 'flame').length;
        const big = ofShape(build('Fire', { s: 1 }), 'flame').length;
        expect(big).toBeGreaterThan(small);
        expect(small).toBe(impactCount(0.1, 'normal', 1));
        expect(big).toBe(impactCount(1, 'normal', 1));
    });
});

describe('190e - how a matchup and a kill read', () => {
    it('super effective: 1.5x the particles, a white ring, star sparks', () => {
        const normal = build('Fire');
        const sup = build('Fire', { matchup: 'super' });
        expect(ofShape(sup, 'flame')).toHaveLength(impactCount(0.5, 'super', 1));
        expect(ofShape(sup, 'flame').length).toBeGreaterThan(ofShape(normal, 'flame').length);
        expect(ofShape(sup, 'ring').some(isWhite)).toBe(true);
        expect(ofShape(normal, 'ring').some(isWhite)).toBe(false);
        expect(ofShape(sup, 'spark').length).toBeGreaterThanOrEqual(6);
        expect(ofShape(normal, 'spark')).toHaveLength(0);
    });

    it('resisted: half the particles and a grey fizzle puff, no white ring', () => {
        const resisted = build('Fire', { matchup: 'resisted' });
        expect(ofShape(resisted, 'flame')).toHaveLength(impactCount(0.5, 'resisted', 1));
        const grey = ofShape(resisted, 'puff').filter((p) => Math.abs(p.r - p.g) < 12 && Math.abs(p.g - p.b) < 12 && p.r > 100);
        expect(grey.length).toBeGreaterThan(0);
        expect(ofShape(resisted, 'ring').some(isWhite)).toBe(false);
        expect(ofShape(resisted, 'spark')).toHaveLength(0);
    });

    it('a kill adds a white ring', () => {
        expect(ofShape(build('Water'), 'ring').some(isWhite)).toBe(false);
        expect(ofShape(build('Water', { isKill: true }), 'ring').some(isWhite)).toBe(true);
    });

    it('stays inside the particle pool even at the biggest case', () => {
        const worst = build('Fire', { s: 1, matchup: 'super', isKill: true, particleScale: TIER_PROFILES.slow.particleScale });
        expect(worst.length).toBeLessThan(250);
    });

    it('is deterministic for a given rng', () => {
        expect(build('Nature')).toEqual(build('Nature'));
    });
});
