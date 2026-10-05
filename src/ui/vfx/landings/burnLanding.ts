/**
 * TICKET 190f — BURN LANDS: the lab's `statusLand('Burn')` line for line (TICKET 198b-4). 24 glow
 * flames born pale yellow across the lower body, rising fast and thinning as they cool to the Burn
 * orange, each with a little fade-in so they do not all appear on one frame. (190f's standing
 * tongues and the big body glow are gone: the lab has neither.)
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import { boxOf, centreOf, feetOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const FLAMES = 24;
const BURN = [255, 122, 47] as const;

export const burnLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const c = centreOf(box);
    const f = feetOf(box);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(FLAMES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-45, 45), y: f.y - rand(0, 40), vx: rand(-15, 15), vy: -rand(140, 320), drag: 0.03,
            life: rand(380, 680), size: rand(7, 11), size2: 2, rgb: [255, 230, 150], rgb2: BURN, fadeIn: rand(0, 200),
        }));
    }
    return { seeds };
};
