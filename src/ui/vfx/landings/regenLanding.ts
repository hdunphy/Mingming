/**
 * TICKET 190f — REGEN LANDS: the lab's `statusLand('Regen')` line for line (TICKET 198b-4). 9 green
 * plus signs and 14 pale-green glow motes drifting up off the feet, each fading in.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import { boxOf, centreOf, feetOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const PLUSES = 9;
export const MOTES = 14;
const REGEN = [95, 224, 122] as const;

export const regenLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const c = centreOf(box);
    const f = feetOf(box);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(PLUSES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-45, 45), y: f.y - rand(0, 40), vy: -rand(50, 90),
            life: rand(800, 1100), size: rand(4, 6), rgb: REGEN, kind: 'plus', fadeIn: rand(0, 300),
        }));
    }
    for (let i = 0; i < countFor(MOTES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: c.x + rand(-50, 50), y: f.y - rand(0, 60), vy: -rand(30, 70), vx: rand(-10, 10),
            life: rand(800, 1200), size: 5, size2: 2, rgb: [190, 255, 200], rgb2: REGEN, fadeIn: rand(0, 300),
        }));
    }
    return { seeds };
};
