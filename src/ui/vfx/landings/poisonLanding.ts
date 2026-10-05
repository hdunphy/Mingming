/**
 * TICKET 190f — POISON LANDS: the lab's `statusLand('Poison')` line for line (TICKET 198b-4). 14
 * purple outlined bubbles rising off the body and 6 green drips falling, each fading in over its
 * first few hundred ms; the sprite dulls (`reaction: 'dull'`).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import { boxOf, centreOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const BUBBLES = 14;
export const DRIPS = 6;
const POISON = [176, 96, 232] as const;

export const poisonLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const c = centreOf(boxOf(at));
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(BUBBLES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-40, 40), y: c.y + rand(-5, 40), vy: -rand(40, 90), vx: rand(-10, 10),
            life: rand(700, 1050), size: rand(3, 8), rgb: POISON, kind: 'bubble', add: false, fadeIn: rand(0, 300),
        }));
    }
    for (let i = 0; i < countFor(DRIPS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-35, 35), y: c.y + rand(-10, 20), vy: 20, ay: 420,
            life: rand(500, 800), size: 3, rgb: [150, 230, 110], kind: 'drop', add: false, fadeIn: rand(0, 300),
        }));
    }
    return { seeds, reaction: 'dull' };
};
