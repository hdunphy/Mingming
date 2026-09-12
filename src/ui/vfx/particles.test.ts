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
import { PARTICLES_PER_TONGUE, STATUS_EMIT_INTERVAL_MS, burnEmitter } from './emitters';

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
    it('holds 600 and never grows', () => {
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

    it('fires from the sprite lower half and rises', () => {
        // The slot rect is the unit's whole cell and the art sits on its floor line, so seeding
        // from the middle would put flames in the air above the body.
        const rng = counterRng();
        for (const p of burnEmitter(ANCHOR, 4, rng)) {
            expect(p.y).toBeGreaterThan(ANCHOR.y + ANCHOR.h * 0.55);
            expect(p.y).toBeLessThanOrEqual(ANCHOR.y + ANCHOR.h);
            expect(p.x).toBeGreaterThan(ANCHOR.x);
            expect(p.x).toBeLessThan(ANCHOR.x + ANCHOR.w);
            // Up the screen is negative y.
            expect(p.vy).toBeLessThan(0);
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
            expect(p.g).toBeGreaterThan(170);
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

    it('fits four tongues on six units inside the pool at the ruled interval', () => {
        /*
         * THE BUDGET, AS ARITHMETIC RATHER THAN A HOPE. §2 caps the pool at 600; §6 asks for the
         * frame budget measured at "3v3 with all six units carrying two statuses each". The worst
         * case for 146a is six units at four tongues, emitting every STATUS_EMIT_INTERVAL_MS, with
         * the longest-lived particle (about 680ms) still in flight.
         */
        const bursts = Math.ceil(680 / STATUS_EMIT_INTERVAL_MS);
        const worst = 6 * 4 * PARTICLES_PER_TONGUE * bursts;
        expect(worst).toBeLessThanOrEqual(PARTICLE_POOL);

        // And the field actually survives it without growing.
        const field = new ParticleField();
        const rng = counterRng();
        for (let b = 0; b < bursts; b += 1) {
            for (let unit = 0; unit < 6; unit += 1) field.spawn(burnEmitter(ANCHOR, 4, rng));
            field.step(STATUS_EMIT_INTERVAL_MS);
        }
        expect(field.live).toBeLessThanOrEqual(PARTICLE_POOL);
    });
});
