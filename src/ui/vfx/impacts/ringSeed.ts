/**
 * TICKET 190e - one expanding ring on a body: the edge that tells the eye something arrived. The
 * particle layer draws and grows it; this only says where, how big, what colour and for how long.
 */

import type { EmitAt } from '../emit';
import type { ParticleSeed } from '../particles';

export function ringSeed(at: EmitAt, color: { r: number; g: number; b: number }, size: number, lifeMs: number): ParticleSeed {
    return {
        x: at.w ? at.x + at.w / 2 : at.x,
        y: at.h ? at.y + at.h / 2 : at.y,
        vx: 0, vy: 0, life: lifeMs, size,
        r: color.r, g: color.g, b: color.b, a: 0.95, shape: 'ring',
    };
}
