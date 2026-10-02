/**
 * THE EMITTERS — ticket 146 §2a's particle vocabulary, one pure recipe per kind.
 *
 * `(at, opts) => ParticleSeed[]`, and the purity is what
 * makes them testable without a canvas: an emitter is a description of a burst, and the field owns
 * what happens to it afterwards.
 *
 * # WHY THE RNG IS AN ARGUMENT
 *
 * `Math.random` in here would make every assertion below a flake and every screenshot a different
 * picture. Passing it in means a test can hand over a counter and get the same burst twice, and the
 * proof capture in the write-back is reproducible rather than a lucky frame.
 *
 * # 146a SHIPS THE VOCABULARY, NOT THE TRIGGERS
 *
 * §2a: *"`kind` draws one of: `flame`, `drop`, `leaf`, `spark`, `puff`, `ring`, `streak` — the
 * whole vocabulary of this ticket."* All seven have a recipe here so that the later rows are
 * spelling rather than inventing; none of them is wired to a game event yet, which is 146c/f/g.
 *
 * `flame` is the one that has been through a real tuning pass, because Henry judged it on a
 * capture. The other six are first drafts and say so.
 */

import type { ParticleSeed } from './particles';
// Types only — see the cycle note in `emit.ts`.
import type { EmitAt, EmitOpts, ParticleKind } from './emit';

/** The rectangle an emitter fires into — a `useStageAnchors` slot, in canvas pixels. */
export interface EmitterAnchor {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

/** `() => number` in [0, 1). Injected so a test and a screenshot can both be deterministic. */
export type Rng = () => number;

/**
 * BURN — §3: *"flame tongues rising off the sprite's lower half, orange to yellow, flicker."*
 *
 * **Intensity is stacks, and 4 is where it stops mattering.** §3's own note: *"1 -> 4 tongues (the
 * cap makes this legible)"*. Burn's damage is uncapped, but a fifth tongue on a 190px sprite is not
 * a fifth of anything a player can see — past four the tongues overlap and the reading is the same
 * "a lot". The number that matters at 7 stacks is on the plaque, where it is a number.
 *
 * Fires from the sprite's LOWER HALF, which is the part of the anchor a sprite actually occupies:
 * the slot rect is the unit's whole cell and the art sits on its floor line, so seeding from the
 * middle would put flames in the air above the body.
 */
export function burnEmitter(anchor: EmitterAnchor, intensity: number, rng: Rng): ParticleSeed[] {
    const tongues = Math.max(1, Math.min(4, Math.round(intensity)));
    const seeds: ParticleSeed[] = [];

    for (let t = 0; t < tongues; t += 1) {
        for (let n = 0; n < PARTICLES_PER_TONGUE; n += 1) {
            /*
             * DISPERSED, not a column. Each tongue gets its own place on the body every burst
             * rather than a fixed lane — Henry's note is *"dispersed, a quick burn that fades away
             * going up"*, and a lane that refills in the same spot builds a steady jet, which is
             * what a torch does and not what a burning creature does.
             *
             * The band is the BODY (40%-92% of the slot), not the floor line. Flames at the feet
             * read as standing in a fire; flames over the body read as being on fire, which is the
             * status being drawn.
             */
            const x = anchor.x + anchor.w * (0.16 + rng() * 0.68);
            const y = anchor.y + anchor.h * (0.40 + rng() * 0.52);

            seeds.push({
                x,
                y,
                vx: (rng() - 0.5) * 26,
                // Quick. A tongue covers 25-45px in its short life and is gone; the NEXT burst
                // lights somewhere else. That flicker — appear, climb, vanish — is the read, and it
                // is why the life below is roughly a third of what the first tuning used.
                vy: -96 - rng() * 58,
                life: 300 + rng() * 190,
                // Wide. A flame is barely taller than it is broad (see `drawFlame`); at 3-7px these
                // were embers, and at 3:1 they were drips.
                size: 5.2 + rng() * 4.6,
                // Hot amber cooling to a deep red, and saturated, because every Mingming's art sits
                // on a near-white card and a pale translucent orange over white is a smudge.
                r: 255, g: 186, b: 58,
                r2: 214, g2: 40, b2: 8,
                a: 0.95,
                // Each tongue leans its own way. Four tongues all standing straight up is one
                // flame drawn four times.
                lean: (rng() - 0.5) * 0.30,
                drag: 0.55,
                gravity: -34,
                shape: 'flame',
            });
        }
    }
    return seeds;
}

/**
 * Particles emitted per tongue per burst.
 *
 * One was the first guess and it was wrong in a way only a screenshot shows: a single small
 * particle every burst is a tick of orange, not a fire. Two gives each tongue a companion close
 * enough to overlap, which is what makes a stack of them read as a body of flame.
 *
 * It is also the number the budget is most sensitive to — see the arithmetic in
 * `particles.test.ts` — so it is a named constant rather than a loop bound someone can quietly
 * raise to three.
 */
export const PARTICLES_PER_TONGUE = 2;

/*
 * `STATUS_EMIT_INTERVAL_MS` used to live here — how often a LOOPING status emitter should fire.
 *
 * It is gone with the loop. Ruling 3 rules out persistent status emitters, so nothing in this file
 * repeats: a burst is fired once, by something that saw an event. Keeping a tuned interval around
 * for a design that was ruled out is how the design creeps back in — the next person to want a
 * continuous effect would have found the constant sitting here looking like permission.
 *
 * 146f's Burn tick is *"three `flame`s rising"*, once, per tick.
 */


/* ── THE VOCABULARY ───────────────────────────────────────────────────────────────────────────
 *
 * One recipe per kind in §2a's list. `emit()` routes here; nothing else does.
 *
 * `flame` is the only one below that has been judged on a capture and tuned — see `burnEmitter`.
 * The other six are honest first drafts: the numbers are reasoned, not photographed, and the row
 * that first USES each one (146d for the trails, 146f for the tells) is where it earns its
 * tuning pass. Saying so here is cheaper than discovering it from a bad GIF in three rows' time.
 */

/** A point burst's default spread, in pixels, when the caller gives a point rather than a box. */
const POINT_SPREAD = 10;

const pick = (at: EmitAt, rng: Rng): { x: number; y: number } => ({
    x: at.w ? at.x + at.w * (0.2 + rng() * 0.6) : at.x + (rng() - 0.5) * POINT_SPREAD,
    y: at.h ? at.y + at.h * (0.2 + rng() * 0.6) : at.y + (rng() - 0.5) * POINT_SPREAD,
});

const RGB = { r: 255, g: 255, b: 255 };

export function burstFor(kind: ParticleKind, at: EmitAt, opts: EmitOpts = {}): ParticleSeed[] {
    const rng = opts.rng ?? Math.random;
    const n = Math.max(1, Math.round(opts.intensity ?? DEFAULT_INTENSITY[kind]));
    const c = opts.color ?? RGB;
    const seeds: ParticleSeed[] = [];

    if (kind === 'flame') {
        // Burn's tongues, already tuned. `intensity` is stacks, as it is everywhere else.
        return burnEmitter(
            { x: at.x, y: at.y, w: at.w ?? POINT_SPREAD * 2, h: at.h ?? POINT_SPREAD * 2 },
            opts.intensity ?? 3,
            rng,
        );
    }

    for (let i = 0; i < n; i += 1) {
        const { x, y } = pick(at, rng);
        switch (kind) {
            case 'drop':
                // Falls and keeps falling: the one kind with positive gravity, because a drop that
                // floats is not a drop.
                seeds.push({
                    x, y, vx: (rng() - 0.5) * 40, vy: -30 - rng() * 40,
                    life: 520 + rng() * 260, size: 2.4 + rng() * 1.8,
                    r: c.r, g: c.g, b: c.b, a: 0.9, gravity: 340, drag: 0.9, shape: 'drop',
                });
                break;
            case 'leaf':
                // Slow, wide, barely falling — a leaf's read is the DRIFT, so the horizontal
                // speed is large and the vertical one almost nothing.
                seeds.push({
                    x, y, vx: (rng() - 0.5) * 70, vy: -14 - rng() * 26,
                    life: 900 + rng() * 500, size: 3 + rng() * 2,
                    r: c.r, g: c.g, b: c.b, a: 0.92, gravity: 26, drag: 0.55, shape: 'leaf',
                });
                break;
            case 'spark':
                // Fast, short-lived, no gravity worth the name. Sparks are punctuation.
                seeds.push({
                    x, y, vx: (rng() - 0.5) * 320, vy: (rng() - 0.5) * 320,
                    life: 180 + rng() * 160, size: 1.6 + rng() * 1.4,
                    r: c.r, g: c.g, b: c.b, r2: c.r, g2: Math.round(c.g * 0.4), b2: Math.round(c.b * 0.3),
                    a: 1, gravity: 60, drag: 0.25, shape: 'spark',
                });
                break;
            case 'puff':
                // Soft, slow, expanding outward — the neutral "something happened here". Drawn
                // through the ramp atlas, so it is the cheapest kind per particle.
                seeds.push({
                    x, y, vx: (rng() - 0.5) * 90, vy: -20 - rng() * 60,
                    life: 420 + rng() * 240, size: 4 + rng() * 4,
                    r: c.r, g: c.g, b: c.b,
                    r2: Math.round(c.r * 0.6), g2: Math.round(c.g * 0.6), b2: Math.round(c.b * 0.6),
                    a: 0.6, gravity: -20, drag: 0.35, shape: 'puff',
                });
                break;
            case 'ring':
                /*
                 * ONE particle, not a circle of them. A ring is a single expanding outline — the
                 * `ring` shape grows with age and strokes itself — so `intensity` is ignored here
                 * and the loop runs once. Emitting N overlapping rings just draws a thicker ring.
                 */
                seeds.push({
                    x: at.w ? at.x + at.w / 2 : at.x,
                    y: at.h ? at.y + at.h / 2 : at.y,
                    vx: 0, vy: 0, life: 340, size: 6,
                    r: c.r, g: c.g, b: c.b, a: 0.95, shape: 'ring',
                });
                return seeds;
            case 'streak': {
                // Directional: `toward` is the whole point, and without it a streak has nothing to
                // be a streak ALONG, so it degenerates to a spark rather than guessing a heading.
                const to = opts.toward;
                if (!to) {
                    seeds.push({
                        x, y, vx: 0, vy: -40, life: 200, size: 2,
                        r: c.r, g: c.g, b: c.b, a: 0.9, shape: 'spark',
                    });
                    break;
                }
                const dx = to.x - at.x;
                const dy = to.y - at.y;
                const len = Math.hypot(dx, dy) || 1;
                const speed = 620;
                seeds.push({
                    x, y, vx: (dx / len) * speed, vy: (dy / len) * speed,
                    life: (len / speed) * 1000, size: 2.6 + rng() * 1.4,
                    r: c.r, g: c.g, b: c.b, a: 1, drag: 1, shape: 'streak',
                });
                break;
            }
        }
    }
    return seeds;
}

/** How many particles a kind emits when the caller does not say. */
const DEFAULT_INTENSITY: Record<ParticleKind, number> = {
    flame: 3, drop: 6, leaf: 5, spark: 10, puff: 6, ring: 1, streak: 1,
};
