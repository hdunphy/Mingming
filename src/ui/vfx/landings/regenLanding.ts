/**
 * TICKET 190f - REGEN LANDS: green plus signs and soft motes rise gently off the body.
 */

import { randomIn } from '../attacks/curves';
import type { ParticleSeed } from '../particles';
import { particle } from '../attacks/seeds';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

const PLUSES = 5;
const MOTES = 5;

export const regenLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(PLUSES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.2, 0.8), y: box.y + box.h * rand(0.55, 0.95),
            vx: rand(-8, 8), vy: -rand(30, 70), ay: -rand(0, 10), drag: 0.01,
            life: rand(800, 1100), size: rand(4, 6),
            rgb: [110, 230, 140], rgb2: [60, 170, 90], a: 0.95, kind: 'plus',
        }));
    }
    for (let i = 0; i < countFor(MOTES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.2, 0.8), y: box.y + box.h * rand(0.5, 0.95),
            vx: rand(-6, 6), vy: -rand(20, 50), ay: -4, drag: 0.01,
            life: rand(700, 1000), size: rand(3, 4.5), size2: 2,
            rgb: [190, 255, 200], rgb2: [110, 220, 140], a: 0.5, kind: 'puff',
        }));
    }
    return { seeds };
};
