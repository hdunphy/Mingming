/**
 * TICKET 190f - POISON LANDS: purple bubbles rise off the body and green drips fall from it, and the
 * sprite dulls for a moment. TICKET 194k-5: the lab's 14 bubbles of 3-8 px and 6 drips (the game had 6 and 4).
 */

import { randomIn } from '../attacks/curves';
import type { ParticleSeed } from '../particles';
import { particle } from '../attacks/seeds';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const BUBBLES = 14;
export const DRIPS = 6;

export const poisonLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(BUBBLES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.22, 0.78), y: box.y + box.h * rand(0.55, 0.92),
            vx: rand(-14, 14), vy: -rand(40, 90), ay: -rand(0, 14), drag: 0.01,
            life: rand(700, 1050), size: rand(3, 8), size2: rand(5, 9),
            rgb: [176, 96, 214], rgb2: [120, 52, 170], a: 0.75, kind: 'puff',
        }));
    }
    for (let i = 0; i < countFor(DRIPS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.25, 0.75), y: box.y + box.h * rand(0.3, 0.6),
            vx: rand(-8, 8), vy: rand(0, 40), ay: rand(420, 560), drag: 0.01,
            life: rand(500, 800), size: rand(3, 4), size2: 2,
            rgb: [140, 220, 90], rgb2: [70, 150, 50], a: 0.9, kind: 'drop',
        }));
    }
    return { seeds, reaction: 'dull' };
};
