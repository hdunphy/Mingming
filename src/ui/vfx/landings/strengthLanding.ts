/**
 * TICKET 190f — STRENGTH LANDS: the lab's `statusLand('Strength')` line for line (TICKET 198b-4).
 * 7 red chevrons rising off the feet one after another, and 12 glow embers rising with them; the
 * sprite pumps up (`reaction: 'pump'`).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import { boxOf, centreOf, feetOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const CHEVRONS = 7;
export const EMBERS = 12;
const STRENGTH = [255, 84, 84] as const;

export const strengthLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const c = centreOf(box);
    const f = feetOf(box);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(CHEVRONS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-45, 45), y: f.y - rand(0, 30), vy: -rand(110, 160),
            life: rand(600, 850), size: rand(7, 10), rgb: STRENGTH, kind: 'chev', add: false, fadeIn: i * 50,
        }));
    }
    for (let i = 0; i < countFor(EMBERS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-40, 40), y: f.y - rand(0, 20), vy: -rand(80, 200),
            life: rand(400, 700), size: 4, size2: 1, rgb: [255, 200, 150], rgb2: STRENGTH,
        }));
    }
    return { seeds, reaction: 'pump' };
};
