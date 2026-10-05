/**
 * THE PARTICLE FIELD — ticket 146a's pool, stepped and drawn the way the Battle Juice Lab does it
 * (TICKET 198b-1: `P`, `stepParts` and `drawParts` in battle-juice-lab.js, line for line).
 *
 * # WHY IT IS THE LAB'S MODEL AND NOT A TUNING OF THE OLD ONE
 *
 * 190 and 194k ported the lab's EMITTERS onto a field that did not draw the way the lab draws, and
 * every difference was in the same direction (smaller, fainter, flatter):
 *
 *   - the old field held a particle at full opacity and faded the last 40%; the lab fades on
 *     `a * (1 - t^2)` from birth, with an optional `fadeIn`;
 *   - the old field cooled the colour on a `^0.45` curve; the lab's is linear;
 *   - a particle with no `size2` thinned to 40%; in the lab it keeps its size;
 *   - the old field drew everything in ordinary blending and stamped a sprite with a DARK RIM round
 *     it (194k-3), so a hundred overlapping flame particles made a brown-edged tube instead of a
 *     white-hot column. The lab draws light additively over a white-centred sprite; the layer's
 *     canvas is transparent and sits over the stage in ordinary blending, which is what makes
 *     that work over a light stage (`ParticleLayer`);
 *   - the lab's kinds (`glow`, `soft`, `bubble`, `glint`, a speed-stretched `drop`, a rotating
 *     `leaf`...) were approximated with others.
 *
 * So the step and the draw are the lab's. What is kept from the old field: the fixed ring-buffer
 * pool (oldest overwritten when full, O(1)), the idle rule (`step` returns the live count so the
 * driver can park), the clamped delta, and the `path` / `trail` heads the 146d element trails run
 * on (Earth, Ice, Air, Light and Dark have no lab effect and keep those).
 *
 * Nothing here touches React: the layer renders one canvas and this file writes pixels into it.
 */

import { glowTexture } from './glowTexture';
import { drawKind, labKindOf, type ParticleShape } from './particleShapes';

export type { ParticleShape } from './particleShapes';

/** What an emitter asks for. Everything omitted takes the lab's default. */
export interface ParticleSeed {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
    /** Milliseconds. */
    readonly life: number;
    /** The size at birth (a radius for the round kinds). */
    readonly size: number;
    /** The size at death. Without it the particle keeps `size` all its life, as the lab's do. */
    readonly size2?: number;
    readonly r: number;
    readonly g: number;
    readonly b: number;
    /** The colour at death, reached linearly. Defaults to the birth colour. */
    readonly r2?: number;
    readonly g2?: number;
    readonly b2?: number;
    /** Opacity at birth. The lab fades it on `1 - t^2`. */
    readonly a?: number;
    /** Milliseconds over which the particle fades IN from nothing (the lab's `fadeIn`). */
    readonly fadeIn?: number;
    /** Per-second velocity retention, 1 = none (`seeds.ts` converts the lab's per-frame drag). */
    readonly drag?: number;
    /** Pixels per second squared, positive is down (the lab's `ay`). */
    readonly gravity?: number;
    /** Rotation at birth, radians, and its speed, radians per second (leaves, stars, planks). */
    readonly rot?: number;
    readonly vr?: number;
    /** Additive blending. The lab's default is true; drops, leaves, smoke and bubbles turn it off. */
    readonly add?: boolean;
    readonly shape?: ParticleShape;
    /**
     * A TRAIL HEAD — ticket 146d. Position as a function of progress (0 at birth, 1 at death)
     * instead of velocity, so the particle follows an authored curve. A particle with a path
     * ignores velocity, drag and gravity entirely.
     */
    readonly path?: (t: number) => { x: number; y: number };
    /** What a head sheds as it travels: `every` ms, in `color`. */
    readonly trail?: {
        readonly kind: ParticleShape;
        readonly every: number;
        readonly color: { r: number; g: number; b: number };
        readonly gravity?: number;
        readonly size?: number;
    };
}

interface Particle {
    alive: boolean;
    path: ((t: number) => { x: number; y: number }) | null;
    trail: ParticleSeed['trail'] | null;
    trailClock: number;
    x: number; y: number;
    vx: number; vy: number;
    /** Milliseconds lived and the life in all. */
    age: number; maxLife: number;
    size: number;
    size2: number | null;
    r: number; g: number; b: number; a: number;
    r2: number; g2: number; b2: number;
    fadeIn: number;
    drag: number; gravity: number;
    rot: number; vr: number;
    add: boolean;
    shape: ParticleShape;
}

/** The lab's `MAX_PARTS`. */
export const PARTICLE_POOL = 1600;

/** A backgrounded tab hands back a multi-second delta on its first frame; clamp it. */
const MAX_DT_MS = 64;

const blank = (): Particle => ({
    alive: false,
    path: null,
    trail: null,
    trailClock: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    age: 0, maxLife: 1,
    size: 1,
    size2: null,
    r: 255, g: 255, b: 255, a: 1,
    r2: 255, g2: 255, b2: 255,
    fadeIn: 0,
    drag: 1, gravity: 0,
    rot: 0, vr: 0,
    add: true,
    shape: 'glow',
});

export class ParticleField {
    private readonly pool: Particle[];
    private cursor = 0;
    private liveCount = 0;

    constructor(capacity: number = PARTICLE_POOL) {
        this.pool = Array.from({ length: Math.max(1, capacity) }, blank);
    }

    get live(): number {
        return this.liveCount;
    }

    get capacity(): number {
        return this.pool.length;
    }

    /** Take the seeds an emitter produced. Silently overwrites the oldest when full. */
    spawn(seeds: ReadonlyArray<ParticleSeed>): void {
        for (const seed of seeds) {
            const p = this.pool[this.cursor];
            this.cursor = (this.cursor + 1) % this.pool.length;
            if (!p.alive) this.liveCount += 1;

            p.alive = true;
            p.x = seed.x; p.y = seed.y;
            p.vx = seed.vx; p.vy = seed.vy;
            p.age = 0; p.maxLife = Math.max(1, seed.life);
            p.size = seed.size;
            p.size2 = seed.size2 ?? null;
            p.r = seed.r; p.g = seed.g; p.b = seed.b;
            p.r2 = seed.r2 ?? seed.r; p.g2 = seed.g2 ?? seed.g; p.b2 = seed.b2 ?? seed.b;
            p.a = seed.a ?? 1;
            p.fadeIn = seed.fadeIn ?? 0;
            p.drag = seed.drag ?? 1;
            p.gravity = seed.gravity ?? 0;
            p.rot = seed.rot ?? 0;
            p.vr = seed.vr ?? 0;
            p.add = seed.add ?? true;
            p.shape = seed.shape ?? 'glow';
            p.path = seed.path ?? null;
            p.trail = seed.trail ?? null;
            p.trailClock = 0;
        }
    }

    /** Advance by `dtMs` of game time and return how many are still alive (0 parks the loop). */
    step(dtMs: number): number {
        const ms = Math.min(Math.max(dtMs, 0), MAX_DT_MS);
        const dt = ms / 1000;
        if (this.liveCount === 0) return 0;

        // Shed trail particles after the walk, so a drop is never stepped in the frame it is born.
        let shed: ParticleSeed[] | null = null;

        for (const p of this.pool) {
            if (!p.alive) continue;
            p.age += ms;
            if (p.age >= p.maxLife) {
                p.alive = false;
                this.liveCount -= 1;
                continue;
            }

            if (p.path) {
                const at = p.path(p.age / p.maxLife);
                p.x = at.x;
                p.y = at.y;
                if (p.trail) {
                    p.trailClock += ms;
                    while (p.trailClock >= p.trail.every) {
                        p.trailClock -= p.trail.every;
                        (shed ??= []).push(shedFrom(p, p.trail));
                    }
                }
                continue;
            }

            p.vy += p.gravity * dt;
            if (p.drag !== 1) {
                const k = Math.pow(p.drag, dt);
                p.vx *= k;
                p.vy *= k;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
        }

        if (shed) this.spawn(shed);
        return this.liveCount;
    }

    /**
     * Paint, the lab's `drawParts`: alpha `a * (1 - t^2)` (times the fade-in), the colour and the
     * size lerped linearly, the sprite kinds stamped from the glow texture, the rest drawn by
     * `drawKind`; additive for light, ordinary for the kinds that ask.
     */
    draw(ctx: CanvasRenderingContext2D): void {
        if (this.liveCount === 0) return;

        for (const p of this.pool) {
            if (!p.alive) continue;
            const t = p.age / p.maxLife;
            const sz = p.size2 === null ? p.size : p.size + (p.size2 - p.size) * t;
            const r = (p.r + (p.r2 - p.r) * t) | 0;
            const g = (p.g + (p.g2 - p.g) * t) | 0;
            const b = (p.b + (p.b2 - p.b) * t) | 0;
            let a = p.a * (1 - t * t);
            if (p.fadeIn && p.age < p.fadeIn) a *= p.age / p.fadeIn;
            if (a <= 0.01 || sz <= 0.2) continue;

            ctx.globalAlpha = a;
            ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
            const kind = labKindOf(p.shape);
            if (kind === 'glow' || kind === 'soft') {
                const sprite = glowTexture([r, g, b], kind === 'soft');
                if (sprite) ctx.drawImage(sprite, p.x - sz, p.y - sz, sz * 2, sz * 2);
                continue;
            }
            drawKind(ctx, kind, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, size: sz, t, rot: p.rot, colour: `rgb(${r},${g},${b})` });
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    /** Drop everything, without reallocating. */
    clear(): void {
        for (const p of this.pool) p.alive = false;
        this.liveCount = 0;
        this.cursor = 0;
    }
}

/** One particle dropped behind a 146d trail head: cooler and dimmer than the head, drifting a little. */
function shedFrom(head: Particle, trail: NonNullable<ParticleSeed['trail']>): ParticleSeed {
    const size = trail.size ?? 2.6;
    return {
        x: head.x,
        y: head.y,
        vx: (Math.random() - 0.5) * 26,
        vy: (Math.random() - 0.5) * 18,
        life: 340 + Math.random() * 220,
        size: size * (0.7 + Math.random() * 0.6),
        size2: size * 0.3,
        r: trail.color.r, g: trail.color.g, b: trail.color.b,
        r2: Math.round(trail.color.r * 0.55),
        g2: Math.round(trail.color.g * 0.55),
        b2: Math.round(trail.color.b * 0.55),
        a: 0.9,
        gravity: trail.gravity ?? 0,
        drag: 0.6,
        shape: trail.kind,
    };
}
