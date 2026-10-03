/**
 * TICKET 190f - a distinct landing for each status in the table, and today's tell for the rest.
 */
import { describe, expect, it } from 'vitest';

import { Statuses, type StatusType } from '../../../engine/types';
import type { ParticleSeed } from '../particles';
import { landingFor } from './landingFor';
import type { LandingInput } from './LandingInput';
import { reactionKeys } from './spriteReaction';

const counter = (): (() => number) => {
    let i = 0;
    return () => { i += 1; return ((i * 7919) % 1000) / 1000; };
};

const BODY = { x: 900, y: 100, w: 190, h: 190 };
const PLAQUE = { x: 1100, y: 40, w: 120, h: 50 };
const input = (over: Partial<LandingInput> = {}): LandingInput => ({
    at: BODY, plaque: PLAQUE, stacks: 1, stacksAdded: false, rng: counter(), ...over,
});
const TABLE: StatusType[] = ['Burn', 'Poison', 'Dazed', 'Weakened', 'Strengthened', 'Sharp', 'Regen', 'BarkShield'];
const KEEP_TODAYS: StatusType[] = ['Asleep', 'Stunned', 'Energized', 'StableOS', 'DarkStance', 'LightStance'];

const seedsOf = (status: StatusType, over: Partial<LandingInput> = {}): ParticleSeed[] => {
    const landing = landingFor(status);
    if (!landing) throw new Error(`no landing for ${status}`);
    return landing(input(over)).seeds;
};
const ofShape = (seeds: ParticleSeed[], shape: string): ParticleSeed[] => seeds.filter((seed) => seed.shape === shape);

describe('190f - which statuses have a landing', () => {
    it('every status in the table has one', () => {
        for (const status of TABLE) expect(landingFor(status), status).toBeTypeOf('function');
    });

    it('the others keep today\'s tell', () => {
        for (const status of KEEP_TODAYS) expect(landingFor(status), status).toBeUndefined();
    });

    it('the table and the keep-list are every status there is', () => {
        expect([...TABLE, ...KEEP_TODAYS].sort()).toEqual([...Statuses].sort());
    });

    it('each landing throws something, and no two throw the same thing', () => {
        const signatures = TABLE.map((status) => {
            const seeds = seedsOf(status);
            expect(seeds.length, status).toBeGreaterThan(0);
            const shapes = [...new Set(seeds.map((seed) => `${seed.shape}`))].sort().join('+');
            const hue = seeds[0] ? `${seeds[0].r >> 5},${seeds[0].g >> 5},${seeds[0].b >> 5}` : '';
            return `${shapes}|${hue}`;
        });
        expect(new Set(signatures).size).toBe(TABLE.length);
    });
});

describe('190f - what each landing is', () => {
    it('Burn: flames lick up the body, with an orange glow', () => {
        const seeds = seedsOf('Burn');
        expect(ofShape(seeds, 'flame').length).toBeGreaterThan(0);
        expect(ofShape(seeds, 'puff').some((p) => p.r > p.b + 100)).toBe(true);
    });

    it('Poison: purple bubbles rise and green drips fall', () => {
        const seeds = seedsOf('Poison');
        const bubbles = ofShape(seeds, 'puff');
        expect(bubbles.length).toBeGreaterThan(0);
        expect(bubbles.every((p) => p.vy < 0 && p.b > p.g)).toBe(true);
        const drips = ofShape(seeds, 'drop');
        expect(drips.length).toBeGreaterThan(0);
        expect(drips.every((p) => (p.gravity ?? 0) > 0 && p.g > p.r && p.g > p.b)).toBe(true);
    });

    it('Dazed: three stars circle the head', () => {
        const stars = ofShape(seedsOf('Dazed'), 'star');
        expect(stars).toHaveLength(3);
        for (const star of stars) {
            expect(star.path).toBeTypeOf('function');
            const a = star.path!(0);
            const b = star.path!(0.25);
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5);
            // The head: the top of the body, round its middle.
            expect(a.y).toBeLessThan(BODY.y + BODY.h * 0.4);
            expect(Math.abs(a.x - (BODY.x + BODY.w / 2))).toBeLessThan(BODY.w * 0.6);
        }
        // Three different places on the circle.
        expect(new Set(stars.map((star) => `${Math.round(star.path!(0).x)},${Math.round(star.path!(0).y)}`)).size).toBe(3);
    });

    it('Weakened: grey chevrons sink', () => {
        const chevrons = ofShape(seedsOf('Weakened'), 'chevron');
        expect(chevrons.length).toBeGreaterThan(0);
        expect(chevrons.every((c) => c.vy > 0 && Math.abs(c.r - c.g) < 15 && Math.abs(c.g - c.b) < 15)).toBe(true);
    });

    it('Strengthened: red chevrons rise, with embers', () => {
        const seeds = seedsOf('Strengthened');
        const chevrons = ofShape(seeds, 'chevron');
        expect(chevrons.length).toBeGreaterThan(0);
        expect(chevrons.every((c) => c.vy < 0 && c.r > c.g + 80)).toBe(true);
        expect(ofShape(seeds, 'flame').length).toBeGreaterThan(0);
    });

    it('Sharp: white glints flash across the body, plus one slash glint', () => {
        const seeds = seedsOf('Sharp');
        const glints = ofShape(seeds, 'star');
        expect(glints.length).toBeGreaterThan(1);
        expect(glints.every((g) => g.r >= 240 && g.g >= 240 && g.b >= 240)).toBe(true);
        expect(ofShape(seeds, 'streak')).toHaveLength(1);
    });

    it('Regen: green plus signs and motes rise gently', () => {
        const seeds = seedsOf('Regen');
        const pluses = ofShape(seeds, 'plus');
        expect(pluses.length).toBeGreaterThan(0);
        expect(pluses.every((p) => p.vy < 0 && p.g > p.r && p.g > p.b)).toBe(true);
        expect(ofShape(seeds, 'puff').every((p) => p.vy < 0)).toBe(true);
    });

    it('Bark Shield: planks fly in and lock into a ring round the body, then settle toward the plaque', () => {
        const planks = ofShape(seedsOf('BarkShield'), 'plank');
        expect(planks.length).toBeGreaterThanOrEqual(6);
        const centre = { x: BODY.x + BODY.w / 2, y: BODY.y + BODY.h / 2 };
        for (const plank of planks) {
            const start = plank.path!(0);
            const locked = plank.path!(0.6);
            const end = plank.path!(1);
            const reach = (p: { x: number; y: number }) => Math.hypot(p.x - centre.x, p.y - centre.y);
            expect(reach(start)).toBeGreaterThan(reach(locked));            // flew in
            expect(reach(locked)).toBeLessThan(BODY.w);                      // locked round the body
            const plaque = { x: PLAQUE.x + PLAQUE.w / 2, y: PLAQUE.y + PLAQUE.h / 2 };
            expect(Math.hypot(end.x - plaque.x, end.y - plaque.y)).toBeLessThan(Math.hypot(locked.x - plaque.x, locked.y - plaque.y));
        }
    });
});

describe('190f - the x N count', () => {
    it('Burn throws one tongue per stack, up to four', () => {
        const flames = (stacks: number) => ofShape(seedsOf('Burn', { stacks }), 'flame').length;
        expect(flames(2)).toBeGreaterThan(flames(1));
        expect(flames(4)).toBeGreaterThan(flames(3));
        expect(flames(9)).toBe(flames(4));
    });

    it('every other landing grows with the stacks, and stops growing at a cap', () => {
        for (const status of TABLE.filter((s) => s !== 'Burn' && s !== 'Dazed' && s !== 'BarkShield')) {
            const count = (stacks: number) => seedsOf(status, { stacks }).length;
            expect(count(5), status).toBeGreaterThan(count(1));
            expect(count(50), status).toBe(count(5));
        }
    });

    it('a stack added to a status already there lands smaller', () => {
        for (const status of TABLE.filter((s) => s !== 'Dazed' && s !== 'BarkShield')) {
            expect(seedsOf(status, { stacksAdded: true, stacks: 3 }).length, status)
                .toBeLessThan(seedsOf(status, { stacksAdded: false, stacks: 3 }).length);
        }
    });

    it('is deterministic for a given rng', () => {
        expect(seedsOf('Poison').map((s) => [s.x, s.y, s.vx, s.vy])).toEqual(seedsOf('Poison').map((s) => [s.x, s.y, s.vx, s.vy]));
    });
});

describe('190f - what the sprite does', () => {
    const reaction = (status: StatusType) => landingFor(status)?.(input()).reaction;

    it('Poison dulls, Dazed wobbles, Weakened slumps and greys, Strengthened pumps up', () => {
        expect(reaction('Poison')).toBe('dull');
        expect(reaction('Dazed')).toBe('wobble');
        expect(reaction('Weakened')).toBe('slump');
        expect(reaction('Strengthened')).toBe('pump');
    });

    it('the others leave the sprite alone', () => {
        for (const status of ['Burn', 'Sharp', 'Regen', 'BarkShield'] as const) expect(reaction(status), status).toBeUndefined();
    });

    it('every reaction ends where it started', () => {
        for (const kind of ['dull', 'wobble', 'slump', 'pump'] as const) {
            const keys = reactionKeys(kind);
            expect(keys.durationMs).toBeGreaterThan(200);
            expect(keys.durationMs).toBeLessThan(900);
            for (const [name, values] of Object.entries(keys.values)) {
                if (name === 'filter') {
                    expect(values[0]).toBe(values[values.length - 1]);
                } else {
                    const rest = name === 'scaleX' || name === 'scaleY' ? 1 : 0;
                    expect(values[0], `${kind} ${name} start`).toBe(rest);
                    expect(values[values.length - 1], `${kind} ${name} end`).toBe(rest);
                }
                expect(values.length).toBe(keys.times.length);
            }
        }
    });
});
