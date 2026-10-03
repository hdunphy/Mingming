/**
 * TICKET 190e - FIRE LANDS: embers spray away from the attacker, a little dark smoke climbs off the
 * body, and an orange ring (the ring is the caller's).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { hitPoint } from './hitPoint';

/** Smoke is this share of the ember count. */
const SMOKE_SHARE = 0.3;

export function fireImpact(input: ImpactInput, count: number): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction } = input;
    const at = hitPoint(input.at, direction);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count; i += 1) {
        seeds.push(particle({
            x: at.x + rand(-8, 8), y: at.y + rand(-16, 16),
            vx: direction * rand(70, 300) * (0.6 + 0.6 * s), vy: -rand(20, 200), ay: rand(120, 360), drag: 0.03,
            life: rand(420, 780), size: rand(3.5, 6) + 2 * s, size2: 1.5,
            rgb: [255, 214, 120], rgb2: [224, 60, 24], a: 0.95, kind: 'flame',
        }));
    }
    const smoke = Math.round(count * SMOKE_SHARE);
    for (let i = 0; i < smoke; i += 1) {
        seeds.push(particle({
            x: at.x + rand(-14, 14), y: at.y + rand(-10, 18),
            vx: direction * rand(10, 70), vy: -rand(30, 90), ay: -rand(20, 60), drag: 0.02,
            life: rand(600, 1000), size: rand(7, 10), size2: rand(18, 26),
            rgb: [70, 62, 60], rgb2: [38, 34, 34], a: 0.4, kind: 'puff',
        }));
    }
    return seeds;
}
