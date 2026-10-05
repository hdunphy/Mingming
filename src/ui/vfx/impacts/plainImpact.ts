/**
 * TICKET 190e - A PLAIN HIT: streaks thrown away from the attacker, white for a neutral hit and in
 * the element's colour for an element that has no impact of its own yet (Earth, Ice, Air, Light, Dark).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { hitPoint, tuple } from './hitPoint';

export function plainImpact(input: ImpactInput, count: number, tint: { r: number; g: number; b: number }): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction } = input;
    const at = hitPoint(input.at, direction);
    const heading = direction > 0 ? 0 : Math.PI;
    const rgb = tuple(tint);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count; i += 1) {
        const angle = heading + rand(-1.2, 1.2);
        const speed = rand(260, 560) * (0.7 + 0.5 * s);
        seeds.push(particle({
            x: at.x + rand(-6, 6), y: at.y + rand(-10, 10),
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 0.05,
            life: rand(160, 300), size: rand(2.2, 3.6) + 1.2 * s,
            rgb, a: 1, kind: 'streak',
        }));
    }
    return seeds;
}
