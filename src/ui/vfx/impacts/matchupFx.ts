/**
 * TICKET 190e - WHAT A MATCHUP AND A KILL ADD on top of the element's own burst.
 *
 * Super effective: a white ring and a fan of star sparks. Resisted: a grey fizzle (a few slow grey puffs
 * that go nowhere). A kill: a white ring, bigger than the rest.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import type { EmitAt } from '../emit';
import type { ParticleSeed } from '../particles';
import { hitPoint } from './hitPoint';
import { ringSeed } from './ringSeed';

const WHITE = { r: 255, g: 255, b: 255 };
export const FIZZLE_GREY = { r: 150, g: 155, b: 162 };
const STAR_SPARKS = 10;
const FIZZLE_PUFFS = 4;

export function superEffectiveFx(at: EmitAt, s: number, direction: 1 | -1, rng: () => number): ParticleSeed[] {
    const rand = randomIn(rng);
    const point = hitPoint(at, direction);
    const seeds: ParticleSeed[] = [ringSeed(at, WHITE, 8 + 3 * s, 420)];
    for (let i = 0; i < STAR_SPARKS; i += 1) {
        const angle = (i / STAR_SPARKS) * Math.PI * 2 + rand(-0.2, 0.2);
        const speed = rand(180, 420);
        seeds.push(particle({
            x: point.x, y: point.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ay: 80, drag: 0.05,
            life: rand(380, 620), size: rand(2.2, 3.4), size2: 0.8,
            rgb: [255, 252, 215], rgb2: [255, 214, 90], a: 1, kind: 'spark',
        }));
    }
    return seeds;
}

export function resistedFx(at: EmitAt, direction: 1 | -1, rng: () => number): ParticleSeed[] {
    const rand = randomIn(rng);
    const point = hitPoint(at, direction);
    const seeds: ParticleSeed[] = [];
    for (let i = 0; i < FIZZLE_PUFFS; i += 1) {
        seeds.push(particle({
            x: point.x + rand(-10, 10), y: point.y + rand(-8, 12),
            vx: direction * rand(-10, 40), vy: -rand(10, 40), ay: -10, drag: 0.03,
            life: rand(500, 700), size: rand(6, 9), size2: rand(14, 18),
            rgb: [FIZZLE_GREY.r, FIZZLE_GREY.g, FIZZLE_GREY.b], rgb2: [110, 114, 120], a: 0.55, kind: 'puff',
        }));
    }
    return seeds;
}

export function killRing(at: EmitAt, s: number): ParticleSeed {
    return ringSeed(at, WHITE, 10 + 3 * s, 480);
}
