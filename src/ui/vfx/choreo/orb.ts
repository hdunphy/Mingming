/**
 * TICKET 190c — THE ORB. A status-only card lobs a soft ball in the status colour from the caster to
 * the target (`planStatusOnly`'s `orb` beat); a buff on yourself rises off the sprite and drops back.
 * One `puff` on a path, the way a trail head is, shedding a few sparks — nothing outside §2a's seven
 * particle shapes.
 */

import type { EmitAt } from '../emit';
import type { ParticleSeed } from '../particles';

interface Rgb { r: number; g: number; b: number }

const ORB_SIZE = 9;
/** How high a lob rises at most, px. */
const LOB_MAX_PX = 110;
/** How high a self-buff rises, px. */
const SELF_RISE_PX = 70;

const centre = (at: EmitAt): { x: number; y: number } => ({
    x: at.w ? at.x + at.w / 2 : at.x,
    y: at.h ? at.y + at.h / 2 : at.y,
});

export function orbSeed(from: EmitAt, to: EmitAt, color: Rgb, lifeMs: number, self: boolean): ParticleSeed {
    const a = centre(from);
    const b = centre(to);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const lob = Math.min(len * 0.3, LOB_MAX_PX);

    const path = self
        ? (t: number) => ({ x: a.x, y: a.y - Math.sin(Math.PI * t) * SELF_RISE_PX })
        : (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * lob });

    return {
        x: a.x, y: a.y,
        vx: 0, vy: 0,
        life: lifeMs,
        size: ORB_SIZE,
        r: Math.min(255, color.r + 70), g: Math.min(255, color.g + 70), b: Math.min(255, color.b + 70),
        r2: color.r, g2: color.g, b2: color.b,
        a: 1,
        shape: 'puff',
        path,
        trail: { kind: 'spark', every: 30, color, gravity: 0, size: 2.2 },
    };
}
