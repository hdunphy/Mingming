/**
 * TICKET 190e — THE WATER IMPACT, the lab's `burst('Water')` line for line (TICKET 198b-4): `n` drops
 * thrown up and a little away, falling under gravity; a few soft mist puffs; a pale blue ring.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { centreOf } from './hitPoint';

export function waterImpact(input: ImpactInput, count: number): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction: d } = input;
    const c = centreOf(input.at);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count; i += 1) {
        const a = -Math.PI / 2 + rand(-1.2, 1.2) + d * 0.35;
        const sp = rand(150, 430) * (0.7 + 0.5 * s);
        seeds.push(particle({
            x: c.x - d * 10, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 950,
            life: rand(450, 750), size: rand(2.5, 4.5), rgb: [190, 230, 255], kind: 'drop', add: false, a: 0.95,
        }));
    }
    for (let i = 0; i < 5 + 5 * s; i += 1) {
        seeds.push(particle({
            x: c.x + rand(-25, 25), y: c.y + rand(-15, 15), vx: rand(-40, 40), vy: rand(-40, 10),
            life: rand(500, 800), size: 14, size2: 40, rgb: [160, 210, 255], kind: 'soft', a: 0.35,
        }));
    }
    seeds.push(particle({ x: c.x, y: c.y + 10, kind: 'ring', size: 14, size2: 70 + 50 * s, life: 320, rgb: [170, 225, 255] }));
    return seeds;
}
