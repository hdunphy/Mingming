/**
 * TICKET 190f - STRENGTHENED LANDS: red chevrons rise with a few embers, and the sprite pumps up.
 */

import { randomIn } from '../attacks/curves';
import type { ParticleSeed } from '../particles';
import { particle } from '../attacks/seeds';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

const CHEVRONS = 4;
const EMBERS = 5;

export const strengthLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(CHEVRONS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.25, 0.75), y: box.y + box.h * rand(0.55, 0.9),
            vx: 0, vy: -rand(80, 140), ay: -30, drag: 0.01,
            life: rand(600, 800), size: rand(5, 7),
            rgb: [232, 70, 60], rgb2: [170, 30, 30], a: 0.95, kind: 'chevron',
        }));
    }
    for (let i = 0; i < countFor(EMBERS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.2, 0.8), y: box.y + box.h * rand(0.6, 0.95),
            vx: rand(-20, 20), vy: -rand(60, 130), ay: -rand(60, 140), drag: 0.02,
            life: rand(420, 700), size: rand(2.6, 4), size2: 1,
            rgb: [255, 190, 90], rgb2: [224, 60, 24], a: 0.95, kind: 'flame',
        }));
    }
    return { seeds, reaction: 'pump' };
};
