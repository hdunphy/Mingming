/**
 * TICKET 190e — THE PLAIN IMPACT, the lab's `burst` for an element with no shape of its own (TICKET
 * 198b-4): `n` fast sparks thrown away from the attacker, and a ring. White for None; the five
 * elements that have no lab effect (Earth, Ice, Air, Light, Dark) get it in their own colour.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { ParticleSeed } from '../particles';
import type { ImpactInput } from './ImpactInput';
import { centreOf, awayFrom, tuple } from './hitPoint';

export function plainImpact(input: ImpactInput, count: number, tint: { r: number; g: number; b: number }): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, direction: d } = input;
    const c = centreOf(input.at);
    const away = awayFrom(d);
    const rgb = tuple(tint);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < count; i += 1) {
        const a = away + rand(-1.5, 1.5);
        const sp = rand(250, 620);
        seeds.push(particle({
            x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.08,
            life: rand(180, 340), size: rand(2, 3.5), kind: 'spark', rgb,
        }));
    }
    seeds.push(particle({ x: c.x, y: c.y, kind: 'ring', size: 10, size2: 60 + 40 * s, life: 240, rgb }));
    return seeds;
}
