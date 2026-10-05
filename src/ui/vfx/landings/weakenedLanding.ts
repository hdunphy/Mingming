/**
 * TICKET 190f - WEAKENED LANDS: grey chevrons sink through the body, and the sprite slumps and greys
 * for a moment. TICKET 194k-5: the lab's 6 chevrons of 7-10 px (the game had 4 of 5-7).
 */

import { randomIn } from '../attacks/curves';
import type { ParticleSeed } from '../particles';
import { particle } from '../attacks/seeds';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const CHEVRONS = 6;

export const weakenedLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(CHEVRONS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.25, 0.75), y: box.y + box.h * rand(0.1, 0.4),
            vx: 0, vy: rand(70, 120), ay: 60, drag: 0.01,
            life: rand(650, 900), size: rand(7, 10),
            rgb: [150, 155, 162], rgb2: [90, 95, 102], a: 0.9, kind: 'chevron',
        }));
    }
    return { seeds, reaction: 'slump' };
};
