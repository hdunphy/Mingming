/**
 * THE PARTICLE FIELD — ticket 146a, the only infrastructure the juice pass adds.
 *
 * A fixed pool, a step and a draw. No React, no DOM, no library: the ticket rules out a dependency
 * and the reason is the budget — every particle system worth having is a flat array and a loop, and
 * the ones in libraries are that plus a scene graph this board does not have.
 *
 * # WHY NOTHING HERE TOUCHES REACT
 *
 * §2: *"Nothing here touches React state per particle."* At 600 particles a state write per frame
 * is 600 reconciliations at 60fps, which is not a frame budget, it is a different program. The
 * layer renders ONE element (a canvas) and this file writes pixels into it. React learns about the
 * field exactly twice: when it mounts and when it unmounts.
 *
 * # WHY THE POOL IS A RING AND NOT A FREE LIST
 *
 * §2 asks for *"a pool of 600, reuse the oldest when full"*. A ring cursor IS oldest-first when
 * allocation is sequential, which it is here, and it is O(1) with no bookkeeping — a free list
 * would need a scan or a second structure to answer "which is oldest". The one thing a ring gives
 * up is reusing a slot that died early; that slot is simply idle until the cursor comes round,
 * which costs nothing because a dead particle is skipped by `step` and `draw` alike.
 *
 * # THE IDLE RULE
 *
 * §2: *"A single requestAnimationFrame loop that runs only while there are live particles (idle =
 * no frames)."* `step` returns the live count so the caller can stop scheduling, and `live` is
 * maintained incrementally rather than recounted — a battle spends most of its time at zero and the
 * cost of being idle has to be actually zero, not "one cheap pass per frame forever".
 */

/** What an emitter asks for. Everything omitted takes the default in `spawn`. */
export interface ParticleSeed {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
    /** Milliseconds. */
    readonly life: number;
    readonly size: number;
    readonly r: number;
    readonly g: number;
    readonly b: number;
    /**
     * The colour the particle COOLS TO, reached at the end of its life. Defaults to its birth
     * colour, which is a particle that does not change.
     *
     * This is the single most useful field on the seed and it was not in the first version. A fire
     * is not orange: it is near-white where it is hot and deep orange where it has cooled, and
     * since these particles get older as they rise, age is already the gradient. Randomising the
     * colour per particle instead — the first attempt — gives a fire with no structure at all, and
     * every capture of it looked like confetti.
     */
    readonly r2?: number;
    readonly g2?: number;
    readonly b2?: number;
    /** Opacity at birth. Particles hold it, then fade over the last of their life. */
    readonly a?: number;
    /** Per-second velocity retention, 1 = none. */
    readonly drag?: number;
    /** Pixels per second squared, positive is down. */
    readonly gravity?: number;
    readonly shape?: ParticleShape;
    /** Tip lean off vertical, as a fraction of height. Only `flame` reads it. */
    readonly lean?: number;
    /**
     * A TRAIL HEAD — ticket 146d. Position as a function of progress (0 at birth, 1 at death)
     * instead of velocity, so the particle follows an authored curve rather than a ballistic arc.
     *
     * Ticket 146d: *"One trail is one `streak` particle with a per-element path function and a
     * spawner."* A flame arc bends upward, a water lash ripples along its length and a vine curls
     * as it grows — none of which is reachable by setting `vx`/`vy`, because all three are shapes
     * in SPACE rather than the result of forces.
     *
     * A particle with a path ignores velocity, drag and gravity entirely; the path is the motion.
     */
    readonly path?: (t: number) => { x: number; y: number };
    /**
     * What this head sheds as it travels — the "spawner" half of a trail.
     *
     * `every` is milliseconds between drops. The field spawns them itself rather than making the
     * caller run a timer, because only the field knows where the head actually is on a given frame.
     */
    readonly trail?: {
        readonly kind: ParticleShape;
        readonly every: number;
        readonly color: { r: number; g: number; b: number };
        /** Downward pull on the shed particles. Water's drops fall; fire's embers rise. */
        readonly gravity?: number;
        readonly size?: number;
    };
}

/**
 * §2a's vocabulary, and nothing else: *"`kind` draws one of: `flame`, `drop`, `leaf`, `spark`,
 * `puff`, `ring`, `streak`."*
 *
 * Closed on purpose. An earlier draft of this file carried a `dot` and a `star` that the ticket
 * never named — `dot` because the first Burn was built out of soft blobs, `star` because it was
 * easy. Both are gone: `puff` IS the soft blob under the name the ticket gave it, and a shape with
 * no row asking for it is a shape nobody tunes.
 */
export type ParticleShape = 'flame' | 'drop' | 'leaf' | 'spark' | 'puff' | 'ring' | 'streak';

interface Particle {
    alive: boolean;
    path: ((t: number) => { x: number; y: number }) | null;
    trail: ParticleSeed['trail'] | null;
    /** Milliseconds since this head last shed a particle. */
    trailClock: number;
    /**
     * How far the tip leans off vertical, as a fraction of the flame's height. Rolled once at birth
     * and never changed, which is the cheapest way to stop four flames from being one flame drawn
     * four times — a real fire's tongues all lean differently and none of them lean straight up.
     */
    lean: number;
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
    r: number; g: number; b: number; a: number;
    r2: number; g2: number; b2: number;
    drag: number; gravity: number;
    shape: ParticleShape;
}

/** §2's number. Big enough for four simultaneous status loops, small enough to stay in cache. */
export const PARTICLE_POOL = 600;

/** The life fraction below which a particle starts fading. Above it, full opacity. */
const FADE_FROM = 0.4;

/*
 * ── THE RAMP ATLAS ────────────────────────────────────────────────────────────────────────────
 *
 * A soft particle needs a radial falloff, and there are exactly three ways to get one:
 *
 *   1. `createRadialGradient` per particle per frame. Correct, and it allocates a gradient object
 *      600 times a frame — 36,000 a second of garbage for a layer whose entire point is that it is
 *      cheap.
 *   2. Two concentric flat circles. No allocation, and it is what this file did for one tuning: it
 *      trades one hard edge for two, so every blob gets a visible ring and a cluster of them reads
 *      as soap bubbles. The capture is unambiguous about that.
 *   3. Pre-render the falloff ONCE, then stamp it. That is this.
 *
 * A particle's colour is a function of its age (see `ParticleSeed.r2`), so the whole colour space a
 * given emitter can produce is a one-dimensional ramp from birth to death. Quantize that ramp into
 * `RAMP_STEPS` and pre-render one soft sprite per step, and drawing a particle becomes a single
 * `drawImage` — cheaper than the two arcs it replaces, with a true gradient edge.
 *
 * The quantization is invisible: 14 steps across a ramp that already fades to transparent is finer
 * than the eye resolves on a 12px blob, and it is the same trick a sprite-sheet fire uses.
 *
 * The cache is keyed by the colour pair, so one emitter costs one atlas. Burn is one pair; the
 * eight statuses in §3 are eight. It is bounded by the number of emitters, not by particles.
 */
const RAMP_STEPS = 14;
const SPRITE_PX = 64;

const atlases = new Map<string, HTMLCanvasElement[]>();

function rampAtlas(r: number, g: number, b: number, r2: number, g2: number, b2: number): HTMLCanvasElement[] | null {
    const key = `${r},${g},${b}>${r2},${g2},${b2}`;
    const cached = atlases.get(key);
    if (cached) return cached;
    if (typeof document === 'undefined') return null;

    const steps: HTMLCanvasElement[] = [];
    for (let i = 0; i < RAMP_STEPS; i += 1) {
        const k = i / (RAMP_STEPS - 1);
        const canvas = document.createElement('canvas');
        canvas.width = SPRITE_PX;
        canvas.height = SPRITE_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const cr = Math.round(r + (r2 - r) * k);
        const cg = Math.round(g + (g2 - g) * k);
        const cb = Math.round(b + (b2 - b) * k);
        const mid = SPRITE_PX / 2;
        const grad = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
        // Solid to about a third of the radius, then out to nothing. A gradient that starts falling
        // at the centre has no core, and a flame with no core is smoke.
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
        grad.addColorStop(0.34, `rgba(${cr},${cg},${cb},0.92)`);
        grad.addColorStop(0.68, `rgba(${cr},${cg},${cb},0.34)`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
        steps.push(canvas);
    }
    atlases.set(key, steps);
    return steps;
}

const blank = (): Particle => ({
    alive: false,
    path: null,
    trail: null,
    trailClock: 0,
    lean: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 1,
    size: 1,
    r: 255, g: 255, b: 255, a: 1,
    r2: 255, g2: 255, b2: 255,
    drag: 1, gravity: 0,
    shape: 'puff',
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

    /**
     * Take the seeds an emitter produced. Silently overwrites the oldest when full — a dropped
     * particle is invisible, whereas growing the pool under load is how a juice layer becomes the
     * reason a fight stutters.
     */
    spawn(seeds: ReadonlyArray<ParticleSeed>): void {
        for (const seed of seeds) {
            const p = this.pool[this.cursor];
            this.cursor = (this.cursor + 1) % this.pool.length;
            if (!p.alive) this.liveCount += 1;

            p.alive = true;
            p.x = seed.x; p.y = seed.y;
            p.vx = seed.vx; p.vy = seed.vy;
            p.life = seed.life; p.maxLife = Math.max(1, seed.life);
            p.size = seed.size;
            p.r = seed.r; p.g = seed.g; p.b = seed.b;
            p.r2 = seed.r2 ?? seed.r; p.g2 = seed.g2 ?? seed.g; p.b2 = seed.b2 ?? seed.b;
            p.a = seed.a ?? 1;
            p.drag = seed.drag ?? 1;
            p.gravity = seed.gravity ?? 0;
            p.shape = seed.shape ?? 'puff';
            p.lean = seed.lean ?? 0;
            p.path = seed.path ?? null;
            p.trail = seed.trail ?? null;
            p.trailClock = 0;
        }
    }

    /**
     * Advance by `dtMs` and return how many are still alive.
     *
     * The return value is the idle rule: a caller that gets 0 stops scheduling frames, and nothing
     * restarts it until the next `spawn`. `dtMs` is clamped because a backgrounded tab hands back a
     * multi-second delta on its first frame, which would teleport every particle off-screen and
     * make a returning player's first turn look broken.
     */
    step(dtMs: number): number {
        const dt = Math.min(Math.max(dtMs, 0), 64) / 1000;
        if (this.liveCount === 0) return 0;

        /*
         * Trail heads shed particles as they travel, and spawning INTO the pool while walking it
         * would let a newly-shed particle be stepped in the same frame it was born — a subtle
         * double-advance that shows up as the first drop of every trail sitting slightly ahead of
         * the rest. Collected here and spawned after the walk instead.
         */
        let shed: ParticleSeed[] | null = null;

        for (const p of this.pool) {
            if (!p.alive) continue;
            p.life -= dt * 1000;
            if (p.life <= 0) {
                p.alive = false;
                this.liveCount -= 1;
                continue;
            }

            if (p.path) {
                // A path owns the motion completely: progress 0 at birth, 1 at death. Velocity,
                // drag and gravity are meaningless for a head that is following a curve.
                const t = 1 - p.life / p.maxLife;
                const at = p.path(t);
                p.x = at.x;
                p.y = at.y;

                if (p.trail) {
                    p.trailClock += dt * 1000;
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
        }

        if (shed) this.spawn(shed);
        return this.liveCount;
    }

    /**
     * Paint.
     *
     * # NOT ADDITIVE, AND THAT IS THE SECOND THING A CAPTURE CHANGED
     *
     * `'lighter'` is the obvious choice for fire and it is wrong HERE, because of what is behind
     * the fire: every Mingming's art sits on a near-white card. Additive blending adds to what is
     * already there, so over white — which is already at 255 on every channel — it adds nothing and
     * the flames simply disappear across the middle of the sprite. The first capture showed
     * disconnected yellow drips below each unit for exactly that reason, and the shape was blamed
     * before the compositing was.
     *
     * `'source-over'` draws the flame instead of adding to it, so a tongue reads the same over a
     * white card, a dark backdrop, and the reveal lane between them. Overlapping warm blobs still
     * build a solid body of flame; what is lost is the glow bloom where particles pile up, which is
     * a fair trade for being visible on the half of the board that matters.
     */
    draw(ctx: CanvasRenderingContext2D): void {
        if (this.liveCount === 0) return;

        for (const p of this.pool) {
            if (!p.alive) continue;
            const t = p.life / p.maxLife;

            /*
             * Hold, then fade. A linear fade across the whole life spends most of a particle's
             * existence half-transparent, which on a fire means the body of the flame never reaches
             * full colour; fading only over the last 40% keeps the flame solid and still avoids the
             * pop of a particle vanishing at full brightness.
             */
            const fade = t > FADE_FROM ? 1 : t / FADE_FROM;
            ctx.globalAlpha = Math.max(0, Math.min(1, p.a * fade));

            /*
             * Cool toward the death colour as it ages — see `ParticleSeed.r2` — on a CURVE, not a
             * straight line. A linear cool spends half the particle's life near its birth colour,
             * and since Burn is born near-white, that photographed as a cloud of pale bubbles. Fire
             * is white only at the instant of combustion; `^0.45` gets a particle most of the way
             * to its death colour in the first third of its life, which is what leaves a small hot
             * core at the base and a deep orange body above it.
             */
            const k = Math.pow(1 - t, 0.45);

            const cr = (p.r + (p.r2 - p.r) * k) | 0;
            const cg = (p.g + (p.g2 - p.g) * k) | 0;
            const cb = (p.b + (p.b2 - p.b) * k) | 0;

            if (p.shape === 'flame') {
                drawFlame(ctx, p, t, cr, cg, cb);
                continue;
            }

            const atlas = p.shape === 'puff' ? rampAtlas(p.r, p.g, p.b, p.r2, p.g2, p.b2) : null;
            if (atlas) {
                // One stamp. `s` is a radius, the sprite is a diameter square.
                const s = p.size * (0.4 + 0.6 * t);
                const step = atlas[Math.min(RAMP_STEPS - 1, Math.max(0, Math.round(k * (RAMP_STEPS - 1))))];
                ctx.drawImage(step, p.x - s, p.y - s, s * 2, s * 2);
            } else {
                ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
                drawShape(ctx, p, t);
            }
        }

        ctx.globalAlpha = 1;
    }

    /** Drop everything, without reallocating. Used when the layer unmounts or motion is reduced. */
    clear(): void {
        for (const p of this.pool) p.alive = false;
        this.liveCount = 0;
        this.cursor = 0;
    }
}

/**
 * `t` is the particle's remaining life, 1 at birth and 0 at death.
 *
 * Every shape THINS with it, which is one line here and the difference between fire and a bar
 * chart. A constant-width particle draws a tongue with parallel sides and a flat top; the first
 * capture of this layer photographed as six sets of yellow pillars for exactly that reason. Real
 * flame narrows as it rises because it is cooling, and since these particles rise as they age,
 * age is already the right variable — no extra state, no per-shape special case.
 */
/**
 * A FLAME TONGUE — a silhouette, not a blob.
 *
 * Henry's reference is a sheet of sprite-art flames: a rounded belly, a drawn-out pointed tip, a
 * hard outer edge and a brighter flame nested inside it. That is a SHAPE, and the soft round
 * particles this file drew first cannot make one however they are clustered — a fire built from
 * blobs reads as smoke or embers, because the thing the eye recognises as flame is the outline.
 *
 * So each particle is one whole tongue. Two bezier curves from tip to base and back, and a second
 * smaller copy of the same curve in a hotter colour for the inner flame. The nested core is what
 * the reference art is really doing: it gives depth without a gradient, and it is what makes a flat
 * fill read as burning rather than as a coloured leaf.
 *
 * # WHY THIS IS NOT THE "DRIP" THAT FAILED EARLIER
 *
 * An earlier tuning drew a tapered tongue and photographed as liquid running down the sprite, so
 * the shape got blamed and dropped. That was the wrong diagnosis twice over: those tongues were
 * thin (roughly 3:1), pale, and drawn with additive blending that erased them over the white cards.
 * A drip is narrow with its weight at the bottom; a flame is WIDE — barely taller than it is
 * broad — with its weight at the bottom and a tip that leans. The proportion and the lean are what
 * separate the two, and both are here on purpose.
 */
/**
 * One particle dropped behind a trail head.
 *
 * The head's own colour is NOT reused: a trail is a bright streak and the things it sheds are
 * cooler and dimmer, which is what makes the head read as the front of something rather than as the
 * brightest of a row of equals. The `trail.color` the emitter passes is already that cooler colour.
 */
function shedFrom(head: Particle, trail: NonNullable<ParticleSeed['trail']>): ParticleSeed {
    const size = trail.size ?? 2.6;
    return {
        x: head.x,
        y: head.y,
        // A little sideways drift so a trail is a ribbon rather than a line of dots on the path.
        vx: (Math.random() - 0.5) * 26,
        vy: (Math.random() - 0.5) * 18,
        life: 340 + Math.random() * 220,
        size: size * (0.7 + Math.random() * 0.6),
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

function drawFlame(
    ctx: CanvasRenderingContext2D, p: Particle, t: number, r: number, g: number, b: number,
): void {
    /*
     * Shrink hard as it ages. §: *"a quick burn that fades away going up"* — a tongue that keeps
     * its size and only loses alpha dissolves in place, which reads as a fade-out rather than as
     * fire being consumed. Dropping to a fifth means it climbs, narrows and is gone.
     */
    const scale = 0.2 + 0.8 * t;
    const halfW = p.size * scale;
    const h = halfW * 3.1;
    const tipX = p.x + p.lean * h;
    const tipY = p.y - h * 0.62;
    const baseY = p.y + h * 0.38;

    /*
     * WHERE THE WIDTH SITS IS THE WHOLE SHAPE. Both control points govern one side of the tongue:
     * the first keeps it NARROW near the tip, the second throws it wide near the base. Putting the
     * bulge high (the first attempt at this shape) gives a balloon with a nub on top — recognisably
     * not a flame, and the reference sheet is unambiguous about why: a flame is a wide belly with a
     * long drawn-out flick above it, and almost all of its area is in the bottom third.
     */
    const tongue = (hw: number, height: number, tx: number, ty: number, by: number): void => {
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.bezierCurveTo(p.x + hw * 0.26, p.y - height * 0.30, p.x + hw * 1.08, p.y + height * 0.08, p.x, by);
        ctx.bezierCurveTo(p.x - hw * 1.08, p.y + height * 0.08, p.x - hw * 0.26, p.y - height * 0.30, tx, ty);
        ctx.fill();
    };

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    tongue(halfW, h, tipX, tipY, baseY);

    /*
     * The inner flame. Mixed toward a pale yellow rather than given its own seed fields, because a
     * flame's core is always the same colour as its body only hotter — one ratio covers Burn now
     * and every coloured fire 146b/c will want, with nothing extra to tune per emitter.
     *
     * It sits LOWER and is shorter than the outer tongue, which is where the heat actually is.
     */
    const mix = 0.62;
    ctx.fillStyle = `rgb(${(r + (255 - r) * mix) | 0},${(g + (248 - g) * mix) | 0},${(b + (170 - b) * mix) | 0})`;
    tongue(halfW * 0.44, h * 0.55, p.x + p.lean * h * 0.44, p.y - h * 0.12, p.y + h * 0.30);
}

function drawShape(ctx: CanvasRenderingContext2D, p: Particle, t: number): void {
    const s = p.size * (0.4 + 0.6 * t);
    switch (p.shape) {
        case 'spark': {
            /*
             * A TONGUE: wide at the bottom, pointed at the top, with its length taken from the
             * particle's own speed. One shape then covers a flame's whole life — long and fast at
             * the base, collapsing toward a round ember at the tip — and the point is what keeps
             * four of them from stacking into a rectangle.
             *
             * The length is clamped at both ends. Unclamped it becomes a tracer the moment an
             * emitter hands out a large velocity, which is a bug 146c's projectiles would find.
             */
            const speed = Math.abs(p.vy);
            const len = Math.max(s * 1.8, Math.min(s * 6, s * (1.2 + speed / 30)));
            const half = s / 2;
            ctx.beginPath();
            ctx.moveTo(p.x - half, p.y + len * 0.35);
            ctx.quadraticCurveTo(p.x - half * 0.9, p.y - len * 0.2, p.x, p.y - len * 0.65);
            ctx.quadraticCurveTo(p.x + half * 0.9, p.y - len * 0.2, p.x + half, p.y + len * 0.35);
            ctx.quadraticCurveTo(p.x, p.y + len * 0.55, p.x - half, p.y + len * 0.35);
            ctx.fill();
            return;
        }
        case 'drop':
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, s * 0.6, s, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        case 'leaf':
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, s, s * 0.45, p.x * 0.05, 0, Math.PI * 2);
            ctx.fill();
            return;
        case 'ring': {
            /*
             * An expanding outline, not a disc. `t` runs 1 → 0 over the life, so the radius grows
             * as the particle ages and the stroke thins with it — which is the whole read of an
             * impact ring: something left this point, fast, and is still leaving.
             */
            const grow = 1 - t;
            const radius = p.size * (1 + grow * 5.5);
            ctx.lineWidth = Math.max(1, p.size * 0.55 * t);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            return;
        }
        case 'streak': {
            // A line along its own travel. Length from speed, so a fast streak is long and the
            // same code draws a slow one as a dash rather than as a tracer.
            const speed = Math.hypot(p.vx, p.vy);
            const len = Math.min(64, Math.max(p.size * 2, speed * 0.05));
            const nx = speed > 0 ? p.vx / speed : 0;
            const ny = speed > 0 ? p.vy / speed : -1;
            ctx.lineWidth = Math.max(1, p.size * t);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - nx * len, p.y - ny * len);
            ctx.stroke();
            return;
        }
        case 'puff':
        default:
            /*
             * TWO circles, not one: a wide soft body at reduced alpha and a small dense core.
             * A single flat disc is what makes a cluster read as bubbles — every particle has the
             * same hard edge and the same weight, so the eye counts them instead of seeing a mass.
             * The halo/core pair gives each blob a falloff, and where blobs overlap the cores
             * accumulate into the bright centre of the flame while the halos merge into its body.
             *
             * Two `arc` calls per particle, ~1200 a frame at the worst case in `particles.test.ts`.
             * That is well inside the measured budget, and it is the cheapest softness available
             * without a per-particle gradient (which would allocate one object per particle per
             * frame) or an offscreen sprite (which cannot be tinted per particle).
             */
            ctx.globalAlpha *= 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha /= 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, s * 0.52, 0, Math.PI * 2);
            ctx.fill();
    }
}
