/**
 * THE EMITTERS — ticket 146, §3's table, one pure function per row.
 *
 * `(anchor, intensity, rng) => ParticleSeed[]`, exactly as §2 specifies, and the purity is what
 * makes them testable without a canvas: an emitter is a description of a burst, and the field owns
 * what happens to it afterwards.
 *
 * # WHY THE RNG IS AN ARGUMENT
 *
 * `Math.random` in here would make every assertion below a flake and every screenshot a different
 * picture. Passing it in means a test can hand over a counter and get the same burst twice, and the
 * proof screenshot in the write-back is reproducible rather than a lucky frame.
 *
 * # 146a SHIPS ONE ROW OF THE TABLE
 *
 * Burn, because §6 names it as the proof: *"146a with Burn flames as the proof"*. It is also the
 * row that decides the shape of the rest — a looping status emitter attached to a unit, intensity
 * from stacks — so the other eight in §3 are new tables rather than new mechanisms.
 */

import type { ParticleSeed } from './particles';

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
        // Spread the tongues across the sprite's width, then jitter, so four do not read as a row.
        const lane = (t + 0.5) / tongues;
        const baseX = anchor.x + anchor.w * (0.22 + lane * 0.56);

        for (let n = 0; n < PARTICLES_PER_TONGUE; n += 1) {
            const x = baseX + (rng() - 0.5) * anchor.w * 0.09;
            const y = anchor.y + anchor.h * (0.60 + rng() * 0.32);

            // Orange at the base, yellow at the tip — a birth colour rather than a gradient,
            // because a particle that is simply born hotter than its neighbour IS the flicker §3
            // asks for, and it costs nothing.
            seeds.push({
                x,
                y,
                // A wide horizontal spread with LITTLE drag, so the tongues splay apart as they
                // rise instead of running up four parallel lanes. Four straight columns is what
                // the first tuning drew, and it read as a bar chart rather than as a fire.
                vx: (rng() - 0.5) * 46,
                // Reach, not a shower of sparks. The first tuning rose about 30px off a 190px
                // sprite and photographed as orange lint; flame has to lick up the BODY to read as
                // burning, so the rise is roughly a third of the sprite over the particle's life.
                vy: -56 - rng() * 48,
                life: 400 + rng() * 280,
                // BIG ENOUGH TO MERGE. This is the number every earlier tuning got wrong: at
                // radius 3-7 the blobs never touch, and sixty of them read as orange polka dots
                // however good the colour is. A flame is a CONNECTED mass, so the particles have
                // to overlap — radius 5.5-12 against a ~10px spawn jitter means each one is
                // touching its neighbours from birth, and the cluster has an outline instead of
                // sixty outlines.
                size: 5.5 + rng() * 6.5,
                // HOT AT THE BASE, COOL AT THE TIP — from age, not from a random roll. A newborn
                // particle is near-white; by the time it has risen it is deep orange. That is what
                // fire does, and because these particles rise as they age, the gradient comes free.
                // Randomising the hue per particle instead (the first version) gives a fire with no
                // structure, and it photographed as confetti.
                // SATURATED, and high alpha, because of what is behind it. Every Mingming's art
                // sits on a near-white card, and a pale translucent orange over white is a smudge —
                // the tuning before this one photographed as dust. Colour has to carry the read
                // here, so the flame is a strong amber cooling to a deep red that white cannot
                // wash out.
                r: 255, g: 198, b: 76,
                r2: 198, g2: 32, b2: 4,
                a: 0.94,
                // Rising flame slows as it cools; a touch of negative gravity keeps the tip
                // drifting up after drag has taken the speed out, which is what stops the whole
                // thing looking like an upside-down fountain.
                drag: 0.72,
                gravity: -26,
                /*
                 * ROUND, not a streak. Two tunings of this emitter drew tapered tongues — long,
                 * narrow, pointed at the top — and both photographed as DRIPS running down the
                 * sprite rather than flame coming off it. A tall thin shape with a rounded bottom
                 * and a point on top is a teardrop, and the eye calls that falling however fast it
                 * is actually rising.
                 *
                 * Fire at this scale is not made of flame-shaped pieces. It is a cluster of round
                 * warm blobs whose outline narrows as the blobs shrink, and 'dot' plus the taper in
                 * `drawShape` gives exactly that. `spark` stays in the vocabulary for 146c, where a
                 * streak is the right read because the thing really is travelling.
                 */
                shape: 'dot',
            });
        }
    }
    return seeds;
}

/**
 * Particles emitted per tongue per burst.
 *
 * One was the first guess and it was wrong in a way only a screenshot shows: a single 2px spark
 * every 90ms is four ticks of orange, not a fire. Two overlap under additive blending, and the
 * overlap is what makes a tongue read as a continuous body of flame rather than as its particles.
 *
 * It is also the number the budget is most sensitive to — see the arithmetic in `particles.test.ts`
 * — so it is a named constant rather than a loop bound someone can quietly raise to three.
 */
export const PARTICLES_PER_TONGUE = 3;

/**
 * How often a looping status emitter should fire, in milliseconds.
 *
 * Not per frame: at 60fps a four-tongue Burn would spawn 720 particles a second and blow the
 * 600-pool cap inside one, which is the whole budget spent on one status. 100ms is 10 bursts a
 * second — dense enough to read as continuous at these lifetimes (400-680ms, so 4-7 bursts are
 * always in flight) and cheap enough that six burning units still fit inside the pool with room to
 * spare. The arithmetic is pinned in `particles.test.ts` rather than left as a claim here.
 */
export const STATUS_EMIT_INTERVAL_MS = 100;
