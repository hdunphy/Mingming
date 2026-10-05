/**
 * TICKET 190f - STRENGTHENED LANDS: red chevrons rise with a few embers, and the sprite pumps up.
 *
 * TICKET 194k-5: the lab's counts and sizes (`statusLand`, 'Strength'): 7 chevrons of 7-10 px and 12
 * embers of 4 px thinning to 1. The game had 4 chevrons of 5-7 px and 5 embers, and halved both on a top-up.
 */

import { randomIn } from '../attacks/curves';
import type { ParticleSeed } from '../particles';
import { particle } from '../attacks/seeds';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const CHEVRONS = 7;
export const EMBERS = 12;

export const strengthLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(CHEVRONS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.25, 0.75), y: box.y + box.h * rand(0.55, 0.9),
            vx: 0, vy: -rand(110, 160), ay: -30, drag: 0.01,
            life: rand(600, 850), size: rand(7, 10),
            rgb: [232, 70, 60], rgb2: [170, 30, 30], a: 0.95, kind: 'chevron',
        }));
    }
    for (let i = 0; i < countFor(EMBERS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.2, 0.8), y: box.y + box.h * rand(0.6, 0.95),
            vx: rand(-20, 20), vy: -rand(80, 200), ay: -rand(40, 100), drag: 0.02,
            life: rand(400, 700), size: 4, size2: 1,
            rgb: [255, 200, 150], rgb2: [255, 84, 84], a: 0.95, kind: 'puff',
        }));
    }
    return { seeds, reaction: 'pump' };
};
