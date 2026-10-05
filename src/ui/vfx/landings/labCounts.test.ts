/**
 * TICKET 194k-5 - the status landings at the lab's counts and sizes (`statusLand` in the Battle Juice
 * Lab), and a top-up that lands as visibly as a fresh status.
 *
 * Henry, 2026-10-04: *"The status effects were small and almost impossible to notice."* Ratatoskr's
 * "+1 Strengthened" drew two chevrons and three embers.
 */
import { describe, expect, it } from 'vitest';

import type { StatusType } from '../../../engine/types';
import { ADDED_SHARE, stackFactor } from './stackFactor';
import { landingFor } from './landingFor';
import type { LandingInput } from './LandingInput';
import type { ParticleSeed } from '../particles';
import { glowKeys, GLOW_MS } from './spriteReaction';

const counter = (): (() => number) => {
    let i = 0;
    return () => { i += 1; return ((i * 7919) % 1000) / 1000; };
};
const BODY = { x: 900, y: 100, w: 190, h: 190 };
const input = (over: Partial<LandingInput> = {}): LandingInput => ({
    at: BODY, plaque: { x: 1100, y: 40, w: 120, h: 50 }, stacks: 1, stacksAdded: true, rng: counter(), ...over,
});
const seedsOf = (status: StatusType, over: Partial<LandingInput> = {}): ParticleSeed[] => landingFor(status)!(input(over)).seeds;
const shape = (seeds: ParticleSeed[], name: string): ParticleSeed[] => seeds.filter((s) => s.shape === name);
const within = (seeds: ParticleSeed[], lo: number, hi: number): boolean => seeds.every((s) => s.size >= lo && s.size <= hi);

describe('194k-5 - a top-up lands as visibly as a fresh status', () => {
    it('ADDED_SHARE is 1, so a stack added counts the same as a first one', () => {
        expect(ADDED_SHARE).toBe(1);
        expect(stackFactor(1, true)).toBe(stackFactor(1, false));
        expect(stackFactor(3, true)).toBe(stackFactor(3, false));
    });

    it('the x N growth above one stack stays: 1x at one stack, 2x at five', () => {
        expect(stackFactor(1, true)).toBe(1);
        expect(stackFactor(5, true)).toBe(2);
        expect(stackFactor(9, true)).toBe(2);
    });
});

describe('194k-5 - the lab\'s counts and sizes, at one stack added', () => {
    it('Strength: 7 chevrons of 7-10 px and 12 embers of 4 px thinning to 1', () => {
        const seeds = seedsOf('Strengthened');
        const chevrons = shape(seeds, 'chev');
        expect(chevrons).toHaveLength(7);
        expect(within(chevrons, 7, 10)).toBe(true);
        const embers = shape(seeds, 'glow');
        expect(embers).toHaveLength(12);
        expect(embers.every((e) => e.size === 4 && e.size2 === 1)).toBe(true);
    });

    it('Burn: 24 glow flames of 7-11 px thinning to 2, and nothing else', () => {
        const flames = shape(seedsOf('Burn'), 'glow');
        expect(seedsOf('Burn')).toHaveLength(24);
        expect(flames).toHaveLength(24);
        expect(within(flames, 7, 11)).toBe(true);
        expect(flames.every((f) => f.vy <= -140 && f.vy >= -320)).toBe(true);
    });

    it('Poison: 14 bubbles of 3-8 px and 6 drips', () => {
        const seeds = seedsOf('Poison');
        const bubbles = shape(seeds, 'bubble');
        expect(bubbles).toHaveLength(14);
        expect(within(bubbles, 3, 8)).toBe(true);
        expect(shape(seeds, 'drop')).toHaveLength(6);
    });

    it('Dazed: three 8 px stars circling for 1.2 s', () => {
        const stars = shape(seedsOf('Dazed'), 'star');
        expect(stars).toHaveLength(3);
        expect(stars.every((s) => s.size === 8 && s.life === 1200)).toBe(true);
    });

    it('Weakened: 6 chevrons of 7-10 px', () => {
        const chevrons = shape(seedsOf('Weakened'), 'chev');
        expect(chevrons).toHaveLength(6);
        expect(within(chevrons, 7, 10)).toBe(true);
    });

    it('Sharp: 5 glints of 9-15 px and the slash', () => {
        const seeds = seedsOf('Sharp');
        const glints = shape(seeds, 'glint');
        expect(glints).toHaveLength(5);
        expect(within(glints, 9, 15)).toBe(true);
        expect(shape(seeds, 'spark')).toHaveLength(1);
    });

    it('Regen: 9 plus signs of 4-6 px and 14 motes thinning from 5 to 2', () => {
        const seeds = seedsOf('Regen');
        const pluses = shape(seeds, 'plus');
        expect(pluses).toHaveLength(9);
        expect(within(pluses, 4, 6)).toBe(true);
        const motes = shape(seeds, 'glow');
        expect(motes).toHaveLength(14);
        expect(motes.every((m) => m.size === 5 && m.size2 === 2)).toBe(true);
    });

    it('Bark Shield: 9 planks of the lab\'s 26 px', () => {
        const planks = shape(seedsOf('BarkShield'), 'plank');
        expect(planks).toHaveLength(9);
        // The field draws a plank 2 x 0.6 of its size (the lab's `plank` kind).
        for (const plank of planks) expect(plank.size * 2).toBe(26);
    });
});

describe('194k-5 - the 450 ms body glow', () => {
    const rgb = { r: 255, g: 84, b: 84 };

    it('is 450 ms, glows in the status colour and starts and ends at nothing', () => {
        const keys = glowKeys(rgb);
        expect(GLOW_MS).toBe(450);
        expect(keys.durationMs).toBe(450);
        expect(keys.filter).toHaveLength(keys.times.length);
        expect(keys.filter[0]).toBe(keys.filter[keys.filter.length - 1]);
        expect(keys.filter[1]).toContain('drop-shadow');
        expect(keys.filter[1]).toContain('rgba(255,84,84,');
        expect(keys.filter[0]).toContain(',0)');
    });
});
