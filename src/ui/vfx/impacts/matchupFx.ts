/**
 * TICKET 190e — WHAT A MATCHUP OR A KILL ADDS, the lab's `superRing` and `fizzle` line for line
 * (TICKET 198b-4). A super-effective hit, or a kill, gets the big white ring and eight pale stars
 * spinning outward; a resisted hit gets six grey soft puffs drifting up.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { EmitAt } from '../emit';
import type { ParticleSeed } from '../particles';
import { centreOf } from './hitPoint';

export const FIZZLE_GREY = { r: 120, g: 125, b: 135 };
export const SUPER_STARS = 8;
export const FIZZLE_PUFFS = 6;

export function superRing(at: EmitAt): ParticleSeed[] {
    const c = centreOf(at);
    const seeds: ParticleSeed[] = [particle({ x: c.x, y: c.y, kind: 'ring', size: 20, size2: 130, life: 380, rgb: [255, 255, 255] })];
    for (let i = 0; i < SUPER_STARS; i += 1) {
        const a = (i / SUPER_STARS) * Math.PI * 2;
        seeds.push(particle({
            x: c.x, y: c.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, drag: 0.1,
            life: 380, size: 7, kind: 'star', rgb: [255, 240, 170], vr: 6,
        }));
    }
    return seeds;
}

export function fizzle(at: EmitAt, rng: () => number): ParticleSeed[] {
    const rand = randomIn(rng);
    const c = centreOf(at);
    const seeds: ParticleSeed[] = [];
    for (let i = 0; i < FIZZLE_PUFFS; i += 1) {
        seeds.push(particle({
            x: c.x + rand(-15, 15), y: c.y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-50, -20),
            life: rand(500, 800), size: 10, size2: 30, rgb: [FIZZLE_GREY.r, FIZZLE_GREY.g, FIZZLE_GREY.b],
            kind: 'soft', add: false, a: 0.55,
        }));
    }
    return seeds;
}
