/**
 * TICKET 190f — DAZED LANDS: the lab's `statusLand('Dazed')` (TICKET 198b-4). Three yellow
 * five-pointed stars circle over the head for 1.2 s, 40 px wide and 11 px tall, a turn and a half;
 * the sprite wobbles (`reaction: 'wobble'`).
 */

import type { ParticleSeed } from '../particles';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';

export const STAR_PX = 8;
const STARS = 3;
const LIFE_MS = 1200;
/** Radians per ms (the lab's `age * 0.008`). */
const SPIN = 0.008;
const RX = 40;
const RY = 11;

export const dazedLanding: LandingMaker = ({ at }) => {
    const box = boxOf(at);
    const top = { x: box.x + box.w / 2, y: box.y - 4 };
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < STARS; i += 1) {
        const phase = (i * Math.PI * 2) / STARS;
        seeds.push({
            x: top.x + RX * Math.cos(phase), y: top.y + RY * Math.sin(phase), vx: 0, vy: 0,
            life: LIFE_MS, size: STAR_PX,
            r: 255, g: 220, b: 90, a: 1, shape: 'star',
            path: (t) => ({
                x: top.x + RX * Math.cos(phase + t * LIFE_MS * SPIN),
                y: top.y + RY * Math.sin(phase + t * LIFE_MS * SPIN),
            }),
        });
    }
    return { seeds, reaction: 'wobble' };
};
