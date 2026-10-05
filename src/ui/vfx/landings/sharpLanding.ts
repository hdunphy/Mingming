/**
 * TICKET 190f — SHARP LANDS: the lab's `statusLand('Sharp')` (TICKET 198b-4). 5 pale four-pointed
 * glints flashing across the body one after another, and one fast white slash from the upper left
 * to the lower right (the lab draws the slash as a growing line; here it is one long spark).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import { boxOf, centreOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const GLINTS = 5;
const SHARP = [225, 240, 255] as const;

export const sharpLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const c = centreOf(boxOf(at));
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(GLINTS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-45, 45), y: c.y + rand(-40, 30),
            life: rand(380, 520), size: rand(9, 15), rgb: SHARP, kind: 'glint', rot: rand(-0.3, 0.3), fadeIn: 60 + i * 70,
        }));
    }
    seeds.push(particle({
        x: c.x - 55, y: c.y - 45, vx: 1540, vy: 1260, life: 150, size: 3, rgb: [240, 248, 255], kind: 'spark',
    }));
    return { seeds };
};
