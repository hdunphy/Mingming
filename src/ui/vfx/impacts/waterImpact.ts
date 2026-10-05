/**
 * TICKET 190e - WATER LANDS: drops thrown up that arc over and fall, a light mist, and a blue ring
 * (the ring is the caller's).
 *
 * TICKET 194k-6: the lab's sizes: drops 2.5-4.5 px and a mist of 14 px growing to 40.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { hitPoint } from './hitPoint';

const MIST_SHARE = 0.35;

export function waterImpact(input: ImpactInput, count: number): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction } = input;
    const at = hitPoint(input.at, direction);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count; i += 1) {
        seeds.push(particle({
            x: at.x + rand(-10, 10), y: at.y + rand(-14, 14),
            vx: direction * rand(-30, 120), vy: -rand(160, 360) * (0.7 + 0.5 * s), ay: rand(620, 820), drag: 0.01,
            life: rand(560, 900), size: rand(2.5, 4.5), size2: 1.5,
            rgb: [170, 220, 252], rgb2: [61, 155, 224], a: 0.92, kind: 'drop',
        }));
    }
    const mist = Math.round(count * MIST_SHARE);
    for (let i = 0; i < mist; i += 1) {
        seeds.push(particle({
            x: at.x + rand(-16, 16), y: at.y + rand(-12, 16),
            vx: direction * rand(10, 60), vy: -rand(10, 50), ay: -rand(0, 20), drag: 0.02,
            life: rand(500, 800), size: 14, size2: 40,
            rgb: [210, 235, 252], rgb2: [150, 200, 240], a: 0.35, kind: 'puff',
        }));
    }
    return seeds;
}
