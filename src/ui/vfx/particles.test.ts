/**
 * TICKET 146a — the particle field's three load-bearing properties.
 *
 * All three are things §2 states as requirements and none of them are visible in a screenshot: a
 * layer that leaks frames, overruns its pool, or keeps dead particles alive looks exactly like one
 * that does not until a fight has been running for five minutes.
 *
 * The emitter is tested with an injected RNG for the reason it takes one — `Math.random` here would
 * make every assertion below a flake.
 */
import { describe, expect, it } from 'vitest';

import { PARTICLE_POOL, ParticleField } from './particles';
import { PARTICLES_PER_TONGUE, burnEmitter, burstFor } from './emitters';
import { emit, hasParticleSink, setParticleSink, type ParticleKind } from './emit';

/** A deterministic stand-in for `Math.random`: even spread, no repeats within a burst. */
const counterRng = (): (() => number) => {
    let i = 0;
    return () => ((i = (i + 37) % 100) / 100);
};

const ANCHOR = { x: 100, y: 200, w: 190, h: 190 };

const seed = (over: Partial<Parameters<ParticleField['spawn']>[0][number]> = {}) => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 100, size: 2, r: 255, g: 255, b: 255, ...over,
});

describe('146a — the pool', () => {
    it('holds PARTICLE_POOL (1,600 since 194k-6) and never grows', () => {
        // §2's number. The cap is the budget: a pool that grows under load is how a juice layer
        // becomes the reason a fight stutters, and a dropped particle is invisible.
        const field = new ParticleField();
        expect(field.capacity).toBe(PARTICLE_POOL);

        field.spawn(Array.from({ length: PARTICLE_POOL * 3 }, () => seed()));
        expect(field.live).toBe(PARTICLE_POOL);
        expect(field.capacity).toBe(PARTICLE_POOL);
    });

    it('reuses the OLDEST when full, rather than dropping the newest', () => {
        // §2: "reuse the oldest when full". The ring cursor is what makes that O(1); this pins the
        // behaviour rather than the mechanism, so a future free-list may replace it freely.
        const field = new ParticleField(3);
        field.spawn([seed({ x: 1 }), seed({ x: 2 }), seed({ x: 3 })]);
        field.spawn([seed({ x: 4 })]);

        expect(field.live).toBe(3);
        // The 4th overwrote the 1st, so the field holds 2, 3, 4 — asserted through a step that
        // kills nothing, since the pool itself is private.
        expect(field.step(1)).toBe(3);
    });

    it('counts down and frees, so live returns to zero', () => {
        const field = new ParticleField();
        field.spawn(Array.from({ length: 10 }, () => seed({ life: 50 })));
        expect(field.live).toBe(10);

        expect(field.step(30)).toBe(10);
        expect(field.step(30)).toBe(0);
        expect(field.live).toBe(0);
    });
});

describe('146a — the idle rule', () => {
    it('reports zero from step when nothing is alive, which is what parks the loop', () => {
        // §2: "runs only while there are live particles (idle = no frames)". `step`'s return value
        // IS that signal — if it ever reported a non-zero count for an empty field, the layer would
        // schedule a frame every 16ms for the rest of the battle.
        const field = new ParticleField();
        expect(field.step(16)).toBe(0);
        expect(field.step(16)).toBe(0);
    });

    it('clamps a huge delta rather than teleporting everything off-screen', () => {
        // A backgrounded tab hands back a multi-second delta on its first frame. Unclamped, every
        // particle jumps a thousand pixels and a returning player's first turn looks broken.
        const near = new ParticleField();
        const far = new ParticleField();
        near.spawn([seed({ vy: -100, life: 10_000 })]);
        far.spawn([seed({ vy: -100, life: 10_000 })]);

        near.step(64);
        far.step(5_000);
        // Both advanced by the same clamped step, so both are still alive and in the same place.
        expect(near.live).toBe(1);
        expect(far.live).toBe(1);
    });
});

describe('146a — the Burn emitter', () => {
    it('caps at four tongues, because a fifth is not a fifth of anything visible', () => {
        // §3: "1 -> 4 tongues (the cap makes this legible)". Burn's DAMAGE stays uncapped — this is
        // a cap on the drawing, and the number at 7 stacks is on the plaque where it is a number.
        const rng = counterRng();
        const per = PARTICLES_PER_TONGUE;
        expect(burnEmitter(ANCHOR, 1, rng)).toHaveLength(1 * per);
        expect(burnEmitter(ANCHOR, 2, rng)).toHaveLength(2 * per);
        expect(burnEmitter(ANCHOR, 4, rng)).toHaveLength(4 * per);
        expect(burnEmitter(ANCHOR, 7, rng)).toHaveLength(4 * per);
        expect(burnEmitter(ANCHOR, 99, rng)).toHaveLength(4 * per);
    });

    it('never emits nothing, even at a fractional or zero stack count', () => {
        // A status that is present but drawing no particles is worse than one that draws none at
        // all: it reads as a rendering fault rather than as an absence.
        const rng = counterRng();
        expect(burnEmitter(ANCHOR, 0, rng).length).toBeGreaterThan(0);
        expect(burnEmitter(ANCHOR, 0.4, rng).length).toBeGreaterThan(0);
    });

    it('fires across the body, not the floor line, and rises', () => {
        // The band is the lower ~60% of the slot: flames at the feet read as a unit standing in a
        // fire, and flames above the shoulders read as a halo. On the body, it reads as burning,
        // which is the status being drawn.
        const rng = counterRng();
        for (const p of burnEmitter(ANCHOR, 4, rng)) {
            expect(p.y).toBeGreaterThanOrEqual(ANCHOR.y + ANCHOR.h * 0.4);
            expect(p.y).toBeLessThanOrEqual(ANCHOR.y + ANCHOR.h);
            expect(p.x).toBeGreaterThan(ANCHOR.x);
            expect(p.x).toBeLessThan(ANCHOR.x + ANCHOR.w);
            // Up the screen is negative y.
            expect(p.vy).toBeLessThan(0);
        }
    });

    it('gives every tongue its own lean, so four are not one flame drawn four times', () => {
        const leans = burnEmitter(ANCHOR, 4, counterRng()).map((p) => p.lean);
        expect(new Set(leans).size).toBeGreaterThan(1);
        for (const lean of leans) expect(Math.abs(lean!)).toBeLessThan(0.2);
    });

    it('burns QUICK — every tongue is gone inside half a second', () => {
        // Henry's ruling: "a quick burn that fades away going up". The fire persists because the
        // emitter keeps firing; no individual flame does. A long life is what turns this back into
        // the steady jet the first tuning drew.
        for (const p of burnEmitter(ANCHOR, 4, counterRng())) {
            expect(p.life).toBeLessThanOrEqual(500);
        }
    });

    it('is born near-white and cools to deep orange, never any other hue', () => {
        // The gradient is the fire. Both ends are asserted because either one alone is a colour a
        // future tweak can drift without anything noticing: a flame all at the birth colour is a
        // bloom, and one all at the death colour is rust.
        const rng = counterRng();
        for (const p of burnEmitter(ANCHOR, 4, rng)) {
            // Birth: hot amber — red at full, green high enough that the colour is not yet red.
            // The bound is loose on purpose: it is guarding the HUE, not a tuning pass. Tightening
            // it to the current literal would mean every future nudge to the flame's colour breaks
            // a test that had no opinion about the nudge.
            expect(p.r).toBe(255);
            expect(p.g).toBeGreaterThan(150);
            expect(p.b).toBeLessThan(p.g);
            // Death: cooler and deeper, so every channel has dropped and the spread has widened.
            expect(p.r2!).toBeLessThanOrEqual(p.r);
            expect(p.g2!).toBeLessThan(p.g);
            expect(p.b2!).toBeLessThan(p.b);
            expect(p.r2! - p.b2!).toBeGreaterThan(p.r - p.b);
        }
    });

    it('is deterministic in its rng — the same draws give the same burst', () => {
        // Why the rng is an argument at all: without this, the proof screenshot is a lucky frame.
        expect(burnEmitter(ANCHOR, 3, counterRng())).toEqual(burnEmitter(ANCHOR, 3, counterRng()));
    });

    it('fits the worst simultaneous moment the ticket describes, inside the pool', () => {
        /*
         * THE BUDGET, AS ARITHMETIC RATHER THAN A HOPE.
         *
         * §2a caps the pool at 600. With persistent emitters ruled out, the worst case is no longer
         * a rate — it is the single busiest MOMENT, and §2h names it: a Side card hitting three
         * targets, on a 3v3 board. Take the ugliest reading of that: all six units resolve a status
         * tell at once (a ring, a puff and four Burn tongues each), while the cast's own trails are
         * still in flight.
         */
        const rng = counterRng();
        const moment = [
            ...Array.from({ length: 6 }, () => burstFor('ring', ANCHOR, { rng })),
            ...Array.from({ length: 6 }, () => burstFor('puff', ANCHOR, { rng })),
            ...Array.from({ length: 6 }, () => burnEmitter(ANCHOR, 4, rng)),
            ...Array.from({ length: 3 }, () => burstFor('streak', ANCHOR, { toward: { x: 9, y: 9 }, rng })),
        ].flat();

        expect(moment.length).toBeLessThanOrEqual(PARTICLE_POOL);
        expect(6 * 4 * PARTICLES_PER_TONGUE).toBeLessThanOrEqual(PARTICLE_POOL);

        // And the field actually survives it without growing.
        const field = new ParticleField();
        field.spawn(moment);
        expect(field.live).toBe(moment.length);
        expect(field.capacity).toBe(PARTICLE_POOL);
    });
});


describe('146a — the emit vocabulary', () => {
    const KINDS: ParticleKind[] = ['flame', 'drop', 'leaf', 'spark', 'puff', 'ring', 'streak'];
    const AT = { x: 100, y: 100, w: 190, h: 190 };

    it('has a recipe for all seven kinds and no eighth', () => {
        // §2a names exactly these. A kind with no recipe is a silent no-op at the call site — the
        // worst failure mode a visual effect has, because nothing errors and nothing draws.
        for (const kind of KINDS) {
            expect(burstFor(kind, AT, { rng: counterRng() }).length).toBeGreaterThan(0);
        }
    });

    it('gives every seed a shape from the closed vocabulary', () => {
        for (const kind of KINDS) {
            for (const seed of burstFor(kind, AT, { rng: counterRng() })) {
                expect(KINDS).toContain(seed.shape);
            }
        }
    });

    it('honours an explicit colour, because 146f passes the status colour in', () => {
        const color = { r: 12, g: 200, b: 90 };
        for (const kind of KINDS) {
            if (kind === 'flame') continue;   // Burn owns its own gradient; see `burnEmitter`.
            for (const seed of burstFor(kind, AT, { color, rng: counterRng() })) {
                expect({ r: seed.r, g: seed.g, b: seed.b }).toEqual(color);
            }
        }
    });

    it('draws ONE ring, however much intensity it is handed', () => {
        // A ring is an expanding outline, so N of them is a thicker ring rather than more rings.
        expect(burstFor('ring', AT, { intensity: 20, rng: counterRng() })).toHaveLength(1);
    });

    it('degrades a streak with nowhere to go into a spark rather than guessing a heading', () => {
        const [seed] = burstFor('streak', AT, { rng: counterRng() });
        expect(seed.shape).toBe('spark');
    });

    it('aims a streak at its target', () => {
        const [seed] = burstFor('streak', { x: 0, y: 0 }, { toward: { x: 100, y: 0 }, rng: counterRng() });
        expect(seed.vx).toBeGreaterThan(0);
        expect(Math.abs(seed.vy)).toBeLessThan(1);
    });
});

describe('146a — emit is a no-op without a mounted layer', () => {
    it('does not throw, because a missing effect must never break a fight', () => {
        setParticleSink(null);
        expect(hasParticleSink()).toBe(false);
        expect(() => emit('puff', { x: 0, y: 0 })).not.toThrow();
    });

    it('spawns and wakes the sink when one is mounted', () => {
        const spawned: number[] = [];
        let woken = 0;
        setParticleSink({ spawn: (seeds) => spawned.push(seeds.length), wake: () => { woken += 1; } });

        emit('puff', { x: 0, y: 0 }, { intensity: 4 });
        expect(spawned).toEqual([4]);
        expect(woken).toBe(1);

        setParticleSink(null);
    });
});

describe('190d — a particle that grows to size2', () => {
    /** The x-radius of every ellipse a leaf particle draws. */
    function radiusesDrawn(field: ParticleField): number[] {
        const radii: number[] = [];
        const ctx = new Proxy({} as Record<string, unknown>, {
            get: (target, name: string) => (name in target ? target[name] : () => undefined),
            set: (target, name: string, value) => { target[name] = value; return true; },
        });
        (ctx as Record<string, unknown>).ellipse = (_x: number, _y: number, rx: number) => { radii.push(rx); };
        field.draw(ctx as unknown as CanvasRenderingContext2D);
        return radii;
    }

    it('heads for size2 as it ages, instead of thinning', () => {
        const field = new ParticleField();
        field.spawn([seed({ size: 4, size2: 20, life: 1000, shape: 'leaf' })]);
        const young = radiusesDrawn(field)[0];
        field.step(500);
        const middle = radiusesDrawn(field)[0];
        field.step(450);
        const old = radiusesDrawn(field)[0];
        expect(young).toBeCloseTo(4, 0);
        expect(middle).toBeGreaterThan(young);
        expect(old).toBeGreaterThan(middle);
        expect(old).toBeLessThanOrEqual(20);
    });

    it('still thins with age when there is no size2', () => {
        const field = new ParticleField();
        field.spawn([seed({ size: 10, life: 1000, shape: 'leaf' })]);
        const young = radiusesDrawn(field)[0];
        field.step(800);
        expect(radiusesDrawn(field)[0]).toBeLessThan(young);
    });
});

describe('190f - the shapes the status landings are drawn with', () => {
    /** Which drawing calls a shape makes. */
    function callsFor(shape: 'chevron' | 'plus' | 'star' | 'plank', vy = 10): string[] {
        const calls: string[] = [];
        const ctx = new Proxy({} as Record<string, unknown>, {
            get: (target, name: string) => (name in target ? target[name] : (...args: unknown[]) => { calls.push(`${name}:${args.length}`); }),
            set: (target, name: string, value) => { target[name] = value; return true; },
        });
        const field = new ParticleField();
        field.spawn([seed({ size: 5, life: 1000, vy, shape })]);
        field.draw(ctx as unknown as CanvasRenderingContext2D);
        return calls;
    }

    it('a chevron is two strokes meeting at a point', () => {
        const calls = callsFor('chevron');
        expect(calls.filter((c) => c.startsWith('lineTo'))).toHaveLength(2);
        expect(calls).toContain('stroke:0');
    });

    it('a chevron points down when it sinks and up when it rises', () => {
        const tips = (vy: number): number[] => {
            const ys: number[] = [];
            const ctx = new Proxy({} as Record<string, unknown>, {
                get: (target, name: string) => (name in target ? target[name] : () => undefined),
                set: (target, name: string, value) => { target[name] = value; return true; },
            });
            (ctx as Record<string, unknown>).lineTo = (_x: number, y: number) => { ys.push(y); };
            (ctx as Record<string, unknown>).moveTo = (_x: number, y: number) => { ys.push(y); };
            const field = new ParticleField();
            field.spawn([seed({ y: 100, size: 5, life: 1000, vy, shape: 'chevron' })]);
            field.draw(ctx as unknown as CanvasRenderingContext2D);
            return ys;
        };
        const sinking = tips(50);
        const rising = tips(-50);
        // [left arm, tip, right arm]: the tip is below the arms when sinking, above them when rising.
        expect(sinking[1]).toBeGreaterThan(sinking[0]);
        expect(rising[1]).toBeLessThan(rising[0]);
    });

    it('a plus is two bars, a star a closed eight-point path, a plank a turned board', () => {
        expect(callsFor('plus').filter((c) => c.startsWith('fillRect'))).toHaveLength(2);
        expect(callsFor('star')).toContain('closePath:0');
        expect(callsFor('plank')).toEqual(expect.arrayContaining(['rotate:1', 'translate:2', 'fillRect:4']));
    });
});
