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

/**
 * How often a looping status emitter should fire, in milliseconds.
 *
 * Not per frame: at 60fps a four-tongue Burn would spawn 480 particles a second and eat the
 * 600-pool cap in little over one, which is the whole budget spent on one status.
 *
 * 70ms is ~14 bursts a second. At the short lifetimes this emitter now uses (300-490ms, so 4-7
 * bursts are in flight at any moment) that is what keeps the fire CONTINUOUS while each individual
 * tongue is brief — which is the whole trick behind *"a quick burn that fades away going up"*: the
 * fire persists, no single flame does. Slower than this and the gaps between bursts show as the
 * unit flickering out. The budget arithmetic is pinned in `particles.test.ts` rather than left as
 * a claim here.
 */
export const STATUS_EMIT_INTERVAL_MS = 70;
