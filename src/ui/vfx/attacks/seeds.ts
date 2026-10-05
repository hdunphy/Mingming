/**
 * TICKET 190d — a particle written the way the Battle Juice Lab writes them (`P({...})`), made into
 * a seed for the game's `ParticleField`. Every lab field is here under the lab's name, so an effect
 * ported from the lab reads the same as its source: `ay` is downward acceleration, `drag` is the
 * share of speed lost per 1/60 s (the field wants the share kept per second), `kind` defaults to
 * `glow` and `add` to true, as the lab's do.
 */

import type { ParticleSeed, ParticleShape } from '../particles';

type Rgb = readonly [number, number, number];

export interface LabParticle {
    readonly x: number;
    readonly y: number;
    readonly vx?: number;
    readonly vy?: number;
    /** Downward acceleration, px/s^2 (negative rises). */
    readonly ay?: number;
    /** Share of speed lost per 1/60 s. */
    readonly drag?: number;
    readonly life: number;
    readonly size: number;
    /** What the size grows (or shrinks) to over the life. */
    readonly size2?: number;
    readonly rgb: Rgb;
    readonly rgb2?: Rgb;
    readonly a?: number;
    /** Milliseconds of fade-in from nothing. */
    readonly fadeIn?: number;
    /** Rotation at birth (radians) and per second. */
    readonly rot?: number;
    readonly vr?: number;
    /** Additive blending; the lab's default is true. */
    readonly add?: boolean;
    readonly kind?: ParticleShape;
}

export function particle(p: LabParticle): ParticleSeed {
    return {
        x: p.x, y: p.y,
        vx: p.vx ?? 0, vy: p.vy ?? 0,
        gravity: p.ay ?? 0,
        drag: p.drag ? Math.pow(1 - p.drag, 60) : 1,
        life: p.life,
        size: p.size,
        size2: p.size2,
        r: p.rgb[0], g: p.rgb[1], b: p.rgb[2],
        r2: p.rgb2?.[0], g2: p.rgb2?.[1], b2: p.rgb2?.[2],
        a: p.a ?? 1,
        fadeIn: p.fadeIn,
        rot: p.rot,
        vr: p.vr,
        add: p.add ?? true,
        shape: p.kind ?? 'glow',
    };
}
