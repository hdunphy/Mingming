/**
 * TICKET 190e - NATURE LANDS: leaves thrown out that tumble down, a scatter of green sparks, and a
 * ring (the ring is the caller's).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { hitPoint } from './hitPoint';

const SPARK_SHARE = 0.4;

export function natureImpact(input: ImpactInput, count: number): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction } = input;
    const at = hitPoint(input.at, direction);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count; i += 1) {
        seeds.push(particle({
            x: at.x + rand(-12, 12), y: at.y + rand(-16, 16),
            vx: direction * rand(-20, 140), vy: -rand(40, 200), ay: rand(60, 140), drag: 0.02,
            life: rand(800, 1300), size: rand(4, 6.5) + s, size2: 3,
            rgb: [120, 215, 120], rgb2: [60, 150, 70], a: 0.95, kind: 'leaf',
        }));
    }
    const sparks = Math.round(count * SPARK_SHARE);
    for (let i = 0; i < sparks; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(80, 260);
        seeds.push(particle({
            x: at.x, y: at.y + rand(-8, 8),
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ay: 80, drag: 0.06,
            life: rand(240, 420), size: rand(1.8, 3), size2: 0.6,
            rgb: [190, 255, 170], rgb2: [67, 180, 95], a: 1, kind: 'spark',
        }));
    }
    return seeds;
}
