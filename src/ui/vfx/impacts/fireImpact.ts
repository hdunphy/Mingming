/**
 * TICKET 190e — THE FIRE IMPACT, the lab's `burst('Fire')` line for line (TICKET 198b-4): `n` glow
 * embers born pale and cooling to the Fire red, thrown away from the attacker and drifting up; a few
 * dark soft smoke puffs that swell as they rise; an orange ring.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { centreOf, awayFrom } from './hitPoint';

const HOT = [255, 238, 170] as const;
const FIRE = [224, 93, 67] as const;

export function fireImpact(input: ImpactInput, count: number): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction: d } = input;
    const c = centreOf(input.at);
    const away = awayFrom(d);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count; i += 1) {
        const a = away + rand(-1.4, 1.4);
        const sp = rand(120, 420) * (0.7 + 0.6 * s);
        seeds.push(particle({
            x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.07, ay: -140,
            life: rand(280, 620), size: rand(6, 11), size2: 2, rgb: HOT, rgb2: FIRE,
        }));
    }
    for (let i = 0; i < 3 + 4 * s; i += 1) {
        seeds.push(particle({
            x: c.x + rand(-20, 20), y: c.y + rand(-10, 10), vx: rand(-30, 30) + d * 30, vy: rand(-60, -20),
            life: rand(600, 900), size: 16, size2: 46, rgb: [50, 40, 42], kind: 'soft', add: false, a: 0.5,
        }));
    }
    seeds.push(particle({ x: c.x, y: c.y, kind: 'ring', size: 12, size2: 60 + 50 * s, life: 260, rgb: [255, 180, 110] }));
    return seeds;
}
