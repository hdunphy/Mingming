/**
 * TICKET 190c — THE ORB. A status-only card lobs a ball of light in the status colour from the caster
 * to the target (`planStatusOnly`'s `orb` beat); a buff on yourself rises off the sprite and drops back.
 *
 * TICKET 198b-3: the lab's `orbFx`, line for line. It leaves from just over the top of the caster's
 * sprite (the lab's `cs.by + 10`), arcs over a control point 110 px above the higher of the two
 * bodies on an in-out ease, and lands on the target's centre. The head is a 16 px additive glow; it
 * sheds 200 glow motes a second (6 px thinning to 1, 300 ms) that drift a little, which is the trail
 * Henry could not see in 194k: the old orb was one 9 px puff shedding a 2 px spark every 30 ms.
 *
 * It is an effect (a shape over time) rather than one particle on a path, because the head is drawn
 * with `drawGlowAt` and spawns as it goes, exactly as the lab's `addFx` object does.
 */

import type { AttackEffect } from '../attacks/AttackEffect';
import { bez2, inOut } from '../attacks/curves';
import { drawGlowAt } from '../attacks/glow';
import type { EmitAt } from '../emit';
import type { ParticleSeed } from '../particles';

interface Rgb { r: number; g: number; b: number }
interface Point { x: number; y: number }

/** The head's glow radius. */
export const ORB_GLOW_PX = 16;
/** Motes shed per game millisecond (the lab's `acc += g * 0.2`). */
export const ORB_MOTES_PER_MS = 0.2;
/** How far above the higher body the lob's control point sits. */
const LOB_CONTROL_PX = 110;
/** How high a self-cast rises. */
const SELF_RISE_PX = 90;
/** The arc's crest stays at least this far below the top of the stage. */
export const APEX_MARGIN_PX = 20;

const centre = (at: EmitAt): Point => ({ x: at.w ? at.x + at.w / 2 : at.x, y: at.h ? at.y + at.h / 2 : at.y });
/** Where the lab's orb leaves: over the top of the caster. */
const crown = (at: EmitAt): Point => ({ x: at.w ? at.x + at.w / 2 : at.x, y: at.y + 10 });

export interface OrbPath {
    readonly from: Point;
    readonly to: Point;
    readonly at: (progress: number) => Point;
}

export function orbPath(from: EmitAt, to: EmitAt, self: boolean): OrbPath {
    const a = crown(from);
    const b = centre(to);
    if (self) {
        return { from: a, to: a, at: (t) => ({ x: a.x, y: a.y - SELF_RISE_PX * Math.sin(Math.PI * t) }) };
    }
    // The lab's stage has 50 px of sky over its top row; the game's top row sits under the turn
    // bar, so an arc that would crest above the stage is lowered until its apex (at t = 0.5,
    // (a + 2c + b) / 4) stays `APEX_MARGIN_PX` inside the canvas. Rows with room get the lab's arc.
    const control = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - LOB_CONTROL_PX };
    control.y = Math.max(control.y, (4 * APEX_MARGIN_PX - a.y - b.y) / 2);
    return { from: a, to: b, at: (t) => bez2(a, control, b, inOut(Math.max(0, Math.min(1, t)))) };
}

/** One mote shed at the head. */
export function orbMote(p: Point, color: Rgb, rng: () => number): ParticleSeed {
    const rand = (lo: number, hi: number): number => lo + rng() * (hi - lo);
    return {
        x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20),
        life: 300, size: 6, size2: 1,
        r: color.r, g: color.g, b: color.b, a: 1, shape: 'glow',
    };
}

export function orbEffect(from: EmitAt, to: EmitAt, color: Rgb, lifeMs: number, self: boolean, rng: () => number = Math.random): AttackEffect {
    const path = orbPath(from, to, self);
    const ms = Math.max(1, lifeMs);
    let acc = 0;
    return {
        durationMs: ms,
        step(age, dt, spawn) {
            acc += dt * ORB_MOTES_PER_MS;
            const p = path.at(age / ms);
            const seeds: ParticleSeed[] = [];
            while (acc >= 1) {
                acc -= 1;
                seeds.push(orbMote(p, color, rng));
            }
            if (seeds.length) spawn(seeds);
        },
        draw(ctx, age) {
            const p = path.at(age / ms);
            drawGlowAt(ctx, p.x, p.y, ORB_GLOW_PX, [color.r, color.g, color.b], 1);
        },
    };
}
