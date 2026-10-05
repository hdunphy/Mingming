/**
 * TICKET 190f - DAZED LANDS: three stars circle the head, and the sprite wobbles. Always three: the
 * stars are the status, and a fourth would be a different drawing.
 */

import type { ParticleSeed } from '../particles';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';

const STARS = 3;
const TURNS = 1.5;
const LIFE_MS = 1000;

export const dazedLanding: LandingMaker = ({ at }) => {
    const box = boxOf(at);
    const cx = box.x + box.w / 2;
    const headY = box.y + box.h * 0.18;
    const rx = box.w * 0.28;
    const ry = box.h * 0.07;
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < STARS; i += 1) {
        const phase = (i / STARS) * Math.PI * 2;
        seeds.push({
            x: cx + rx * Math.cos(phase), y: headY + ry * Math.sin(phase), vx: 0, vy: 0,
            life: LIFE_MS, size: 5.5,
            r: 255, g: 232, b: 110, r2: 255, g2: 200, b2: 60, a: 1, shape: 'star',
            path: (t) => ({
                x: cx + rx * Math.cos(phase + t * Math.PI * 2 * TURNS),
                y: headY + ry * Math.sin(phase + t * Math.PI * 2 * TURNS),
            }),
        });
    }
    return { seeds, reaction: 'wobble' };
};
