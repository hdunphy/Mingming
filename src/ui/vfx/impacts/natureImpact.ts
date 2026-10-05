/**
 * TICKET 190e — THE NATURE IMPACT, the lab's `burst('Nature')` line for line (TICKET 198b-4): leaves
 * in four greens tumbling away from the attacker and falling; a shower of small pale-green glow
 * sparks in every direction; a green ring.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { centreOf, awayFrom } from './hitPoint';

const GREENS = [[78, 190, 90], [120, 210, 90], [52, 150, 70], [170, 220, 100]] as const;

export function natureImpact(input: ImpactInput, count: number): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction: d } = input;
    const c = centreOf(input.at);
    const away = awayFrom(d);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count * 0.7; i += 1) {
        const a = away + rand(-1.6, 1.6);
        const sp = rand(100, 330) * (0.7 + 0.6 * s);
        seeds.push(particle({
            x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, drag: 0.05, ay: 160,
            vr: rand(-9, 9), rot: rand(0, 6), life: rand(650, 1050), size: rand(5, 9),
            rgb: GREENS[i % 4], kind: 'leaf', add: false,
        }));
    }
    for (let i = 0; i < count * 0.5; i += 1) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(80, 260);
        seeds.push(particle({
            x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.08,
            life: rand(250, 500), size: rand(4, 7), size2: 1, rgb: [200, 255, 170], rgb2: [67, 180, 95],
        }));
    }
    seeds.push(particle({ x: c.x, y: c.y, kind: 'ring', size: 12, size2: 60 + 40 * s, life: 260, rgb: [150, 230, 140] }));
    return seeds;
}
