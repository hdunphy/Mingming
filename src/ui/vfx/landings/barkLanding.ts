/**
 * TICKET 190f - BARK SHIELD LANDS: planks fly in from round the body and lock into a ring, then settle
 * toward the plaque, where the brown band over the HP bar grows (the cast moves the band as they
 * settle, `BARK_SETTLE_MS` after the landing starts). Always nine planks of the lab's 26 x 10 px
 * (194k-5; there were six of about 11 x 4).
 */

import type { ParticleSeed } from '../particles';
import { outCubic, inQuad, lerp } from '../attacks/curves';
import { boxOf, centreOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';

export const PLANKS = 9;
/** The lab's plank is 26 x 10 px; the particle field draws a plank 2.2 x 0.8 of its size. */
export const PLANK_PX = 12;
export const BARK_LIFE_MS = 760;
/** When the planks have settled and the band takes over, from the start of the landing. */
export const BARK_SETTLE_MS = 640;
const FLY_IN_UNTIL = 0.5;
const SETTLE_FROM = 0.72;
/** How far out the planks start, and how far from the middle they lock, as a share of the body's width. */
const START_RADIUS = 0.95;
const RING_RADIUS = 0.42;

export const barkLanding: LandingMaker = ({ at, plaque }) => {
    const box = boxOf(at);
    const centre = centreOf(box);
    const settleAt = plaque ? centreOf(boxOf(plaque)) : centre;
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < PLANKS; i += 1) {
        const angle = (i / PLANKS) * Math.PI * 2 + 0.3;
        const start = { x: centre.x + Math.cos(angle + 0.7) * box.w * START_RADIUS, y: centre.y + Math.sin(angle + 0.7) * box.w * START_RADIUS * 0.8 };
        const lock = { x: centre.x + Math.cos(angle) * box.w * RING_RADIUS, y: centre.y + Math.sin(angle) * box.w * RING_RADIUS * 0.8 };
        seeds.push({
            x: start.x, y: start.y, vx: 0, vy: 0,
            life: BARK_LIFE_MS, size: PLANK_PX,
            r: 168, g: 112, b: 60, r2: 110, g2: 70, b2: 36, a: 1, shape: 'plank',
            path: (t) => {
                if (t <= FLY_IN_UNTIL) {
                    const u = outCubic(t / FLY_IN_UNTIL);
                    return { x: lerp(start.x, lock.x, u), y: lerp(start.y, lock.y, u) };
                }
                if (t <= SETTLE_FROM) return lock;
                const u = inQuad((t - SETTLE_FROM) / (1 - SETTLE_FROM));
                return { x: lerp(lock.x, settleAt.x, u), y: lerp(lock.y, settleAt.y, u) };
            },
        });
    }
    return { seeds };
};
