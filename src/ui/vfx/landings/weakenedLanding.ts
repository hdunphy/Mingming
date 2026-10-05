/**
 * TICKET 190f — WEAKENED LANDS: the lab's `statusLand('Weakened')` line for line (TICKET 198b-4).
 * 6 grey chevrons sinking from over the head, one after another; the sprite slumps and greys
 * (`reaction: 'slump'`).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import { boxOf, centreOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const CHEVRONS = 6;
const WEAKENED = [150, 160, 182] as const;

export const weakenedLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const c = centreOf(box);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(CHEVRONS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-40, 40), y: box.y - rand(0, 30), vy: rand(50, 80),
            life: rand(650, 900), size: rand(7, 10), rgb: WEAKENED, kind: 'chev', add: false, fadeIn: i * 60,
        }));
    }
    return { seeds, reaction: 'slump' };
};
