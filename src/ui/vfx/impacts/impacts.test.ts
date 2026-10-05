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

describe('198b-4 - each element throws the lab\'s burst', () => {
    it('Fire: glow embers spray on from the attacker, dark soft smoke, an orange ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const ahead = build('Fire', { direction: 1 });
        const embers = ofShape(ahead, 'glow');
        expect(embers).toHaveLength(count);
        expect(embers.every((e) => e.vx > 0 && e.size >= 6 && e.size <= 11 && e.size2 === 2)).toBe(true);
        expect(embers.every((e) => e.r === 255 && e.g === 238 && e.b === 170 && e.r2 === 224 && e.g2 === 93 && e.b2 === 67)).toBe(true);
        expect(ofShape(build('Fire', { direction: -1 }), 'glow').every((e) => e.vx < 0)).toBe(true);
        const smoke = ofShape(ahead, 'soft');
        expect(smoke).toHaveLength(Math.ceil(3 + 4 * 0.5));
        expect(smoke.every((p) => p.r === 50 && p.g === 40 && p.b === 42 && p.add === false && p.size === 16 && p.size2 === 46)).toBe(true);
        const ring = ofShape(ahead, 'ring');
        expect(ring).toHaveLength(1);
        expect([ring[0].r, ring[0].g, ring[0].b, ring[0].size, ring[0].size2, ring[0].life]).toEqual([255, 180, 110, 12, 60 + 50 * 0.5, 260]);
    });

    it('Water: drops thrown up and falling (ordinary blending), a soft mist, a pale blue ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const seeds = build('Water', { color: { r: 61, g: 155, b: 224 } });
        const drops = ofShape(seeds, 'drop');
        expect(drops).toHaveLength(count);
        expect(drops.every((d) => d.vy < 0 && d.gravity === 950 && d.add === false && d.size >= 2.5 && d.size <= 4.5)).toBe(true);
        const mist = ofShape(seeds, 'soft');
        expect(mist).toHaveLength(Math.ceil(5 + 5 * 0.5));
        expect(mist.every((m) => m.size === 14 && m.size2 === 40 && m.a === 0.35)).toBe(true);
        const ring = ofShape(seeds, 'ring');
        expect(ring).toHaveLength(1);
        expect([ring[0].r, ring[0].g, ring[0].b, ring[0].size, ring[0].size2, ring[0].life]).toEqual([170, 225, 255, 14, 70 + 50 * 0.5, 320]);
        expect(ring[0].y).toBe(AT.y + AT.h / 2 + 10);
    });

    it('Nature: 0.7 n turning leaves in four greens, 0.5 n pale glow sparks, a green ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const seeds = build('Nature', { color: { r: 67, g: 180, b: 95 } });
        const leaves = ofShape(seeds, 'leaf');
        expect(leaves).toHaveLength(Math.ceil(count * 0.7));
        expect(leaves.every((l) => l.add === false && l.vr !== undefined && l.size >= 5 && l.size <= 9)).toBe(true);
        expect(new Set(leaves.map((l) => `${l.r},${l.g},${l.b}`)).size).toBe(4);
        const sparks = ofShape(seeds, 'glow');
        expect(sparks).toHaveLength(Math.ceil(count * 0.5));
        expect(sparks.every((p) => p.r === 200 && p.g === 255 && p.b === 170 && p.size2 === 1)).toBe(true);
        const ring = ofShape(seeds, 'ring');
        expect(ring).toHaveLength(1);
        expect([ring[0].r, ring[0].g, ring[0].b, ring[0].size2]).toEqual([150, 230, 140, 60 + 40 * 0.5]);
    });

    it('None: white sparks and a white ring', () => {
        const count = impactCount(0.5, 'normal', 1);
        const seeds = build('None', { color: { r: 154, g: 163, b: 173 } });
        const sparks = ofShape(seeds, 'spark');
        expect(sparks).toHaveLength(count);
        expect(sparks.every(isWhite)).toBe(true);
        expect(sparks.every((p) => p.size >= 2 && p.size <= 3.5 && p.life >= 180 && p.life <= 340)).toBe(true);
        const ring = ofShape(seeds, 'ring');
        expect(ring).toHaveLength(1);
        expect(isWhite(ring[0])).toBe(true);
    });

    it('an element with no effect of its own throws sparks in its colour', () => {
        const seeds = build('Ice', { color: { r: 127, g: 214, b: 255 } });
        const sparks = ofShape(seeds, 'spark');
        expect(sparks).toHaveLength(impactCount(0.5, 'normal', 1));
        expect(sparks.every((s) => s.r === 127 && s.b === 255)).toBe(true);
    });

    it('the main burst scales with s', () => {
        const small = ofShape(build('Fire', { s: 0.1 }), 'glow').length;
        const big = ofShape(build('Fire', { s: 1 }), 'glow').length;
        expect(big).toBeGreaterThan(small);
        expect(small).toBe(impactCount(0.1, 'normal', 1));
        expect(big).toBe(impactCount(1, 'normal', 1));
    });

    it('is born at the middle of the body, as the lab\'s `center(u)` is', () => {
        const embers = ofShape(build('Fire'), 'glow');
        expect(embers.every((e) => e.x === AT.x + AT.w / 2 && e.y === AT.y + AT.h / 2)).toBe(true);
    });
});

describe('198b-4 - how a matchup and a kill read (the lab\'s superRing and fizzle)', () => {
    it('super effective: 1.5x the particles, the 20 -> 130 px white ring and eight spinning stars', () => {
        const normal = build('Fire');
        const sup = build('Fire', { matchup: 'super' });
        expect(ofShape(sup, 'glow')).toHaveLength(impactCount(0.5, 'super', 1));
        expect(ofShape(sup, 'glow').length).toBeGreaterThan(ofShape(normal, 'glow').length);
        const white = ofShape(sup, 'ring').filter(isWhite);
        expect(white).toHaveLength(1);
        expect([white[0].size, white[0].size2, white[0].life]).toEqual([20, 130, 380]);
        expect(ofShape(normal, 'ring').some(isWhite)).toBe(false);
        const stars = ofShape(sup, 'star');
        expect(stars).toHaveLength(8);
        expect(stars.every((s) => s.size === 7 && s.vr === 6 && Math.hypot(s.vx, s.vy) - 360 < 1e-9)).toBe(true);
        expect(ofShape(normal, 'star')).toHaveLength(0);
    });

    it('resisted: half the particles and six grey soft puffs, no white ring', () => {
        const resisted = build('Fire', { matchup: 'resisted' });
        expect(ofShape(resisted, 'glow')).toHaveLength(impactCount(0.5, 'resisted', 1));
        const grey = ofShape(resisted, 'soft').filter((p) => p.r === 120 && p.g === 125 && p.b === 135);
        expect(grey).toHaveLength(6);
        expect(grey.every((p) => p.size === 10 && p.size2 === 30 && p.add === false)).toBe(true);
        expect(ofShape(resisted, 'ring').some(isWhite)).toBe(false);
        expect(ofShape(resisted, 'star')).toHaveLength(0);
    });

    it('a kill gets the super ring and the stars too', () => {
        expect(ofShape(build('Water'), 'ring').some(isWhite)).toBe(false);
        const kill = build('Water', { isKill: true });
        expect(ofShape(kill, 'ring').some(isWhite)).toBe(true);
        expect(ofShape(kill, 'star')).toHaveLength(8);
    });

    it('stays inside the particle pool even at the biggest case', () => {
        const worst = build('Fire', { s: 1, matchup: 'super', isKill: true, particleScale: TIER_PROFILES.slow.particleScale });
        expect(worst.length).toBeLessThan(250);
    });

    it('is deterministic for a given rng', () => {
        expect(build('Nature')).toEqual(build('Nature'));
    });
});
