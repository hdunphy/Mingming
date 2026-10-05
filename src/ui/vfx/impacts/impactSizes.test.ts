/**
 * TICKET 194k-6 - impact particles at the Battle Juice Lab's sizes, and a pool big enough that a
 * multi-hit card's bursts do not cut each other short.
 */
import { describe, expect, it } from 'vitest';

import { buildImpact } from './buildImpact';
import type { ImpactInput } from './ImpactInput';
import { impactCount } from './impactCount';
import { landingFor } from '../landings/landingFor';
import { PARTICLE_POOL, ParticleField, type ParticleSeed } from '../particles';

const counter = (): (() => number) => {
    let i = 0;
    return () => { i += 1; return ((i * 7919) % 1000) / 1000; };
};
const AT = { x: 900, y: 100, w: 190, h: 190 };
const input = (over: Partial<ImpactInput> = {}): ImpactInput => ({
    at: AT, s: 0.54, matchup: 'normal', isKill: false, direction: 1, particleScale: 1, rng: counter(),
    color: { r: 224, g: 93, b: 67 }, ...over,
});
const ofShape = (seeds: ParticleSeed[], shape: string): ParticleSeed[] => seeds.filter((s) => s.shape === shape);
const range = (seeds: ParticleSeed[]): [number, number] => [Math.min(...seeds.map((s) => s.size)), Math.max(...seeds.map((s) => s.size))];

describe('194k-6 - the lab\'s impact sizes', () => {
    it('Fire: embers 6-11 px thinning to 2, smoke 16 px growing to 46', () => {
        const seeds = buildImpact('Fire', input());
        const embers = ofShape(seeds, 'glow');
        const [lo, hi] = range(embers);
        expect(lo).toBeGreaterThanOrEqual(6);
        expect(hi).toBeLessThanOrEqual(11);
        expect(embers.every((e) => e.size2 === 2)).toBe(true);
        const smoke = ofShape(seeds, 'soft');
        expect(smoke.every((p) => p.size === 16 && p.size2 === 46)).toBe(true);
    });

    it('Fire embers no longer grow with s: they start at the lab\'s size at any hit strength', () => {
        const small = range(ofShape(buildImpact('Fire', input({ s: 0.1 })), 'glow'));
        const big = range(ofShape(buildImpact('Fire', input({ s: 1 })), 'glow'));
        expect(small[0]).toBeGreaterThanOrEqual(6);
        expect(big[1]).toBeLessThanOrEqual(11);
    });

    it('Water: drops 2.5-4.5 px, mist 14 px growing to 40', () => {
        const seeds = buildImpact('Water', input({ color: { r: 61, g: 155, b: 224 } }));
        const [lo, hi] = range(ofShape(seeds, 'drop'));
        expect(lo).toBeGreaterThanOrEqual(2.5);
        expect(hi).toBeLessThanOrEqual(4.5);
        expect(ofShape(seeds, 'soft').every((p) => p.size === 14 && p.size2 === 40)).toBe(true);
    });

    it('Nature: leaves 5-9 px, sparks 4-7 px thinning to 1', () => {
        const seeds = buildImpact('Nature', input({ color: { r: 67, g: 180, b: 95 } }));
        const leaves = range(ofShape(seeds, 'leaf'));
        expect(leaves[0]).toBeGreaterThanOrEqual(5);
        expect(leaves[1]).toBeLessThanOrEqual(9);
        const sparks = ofShape(seeds, 'glow');
        const [lo, hi] = range(sparks);
        expect(lo).toBeGreaterThanOrEqual(4);
        expect(hi).toBeLessThanOrEqual(7);
        expect(sparks.every((p) => p.size2 === 1)).toBe(true);
    });
});

describe('194k-6 - the pool', () => {
    it('is the lab\'s 1,600', () => {
        expect(PARTICLE_POOL).toBe(1600);
    });

    it('holds a three-hit kill\'s bursts at the same time: nothing is overwritten', () => {
        const field = new ParticleField();
        let thrown = 0;
        for (let hit = 0; hit < 3; hit += 1) {
            const burst = buildImpact('Fire', input({ s: 1, matchup: 'super', rng: counter() }));
            thrown += burst.length;
            field.spawn(burst);
        }
        // Plus the Burn landing the rider adds on each of three bodies, and a ring or two.
        for (let body = 0; body < 3; body += 1) {
            const landing = landingFor('Burn')!({ at: AT, plaque: null, stacks: 5, stacksAdded: false, rng: counter() }).seeds;
            thrown += landing.length;
            field.spawn(landing);
        }
        expect(thrown).toBeGreaterThan(200);
        expect(thrown).toBeLessThan(PARTICLE_POOL);
        expect(field.live).toBe(thrown);
    });

    it('a super-effective full hit throws well under a third of the pool', () => {
        const count = impactCount(1, 'super', 1.3);
        expect(count * 1.4 * 3).toBeLessThan(PARTICLE_POOL);
    });
});
