/**
 * TICKET 190c — SPEED LINES. A contact card dashes all the way in; a handful of pale streaks trail
 * off the attacker, flying back the way it came (the lab's `spark` lines, in the closed §2a shape
 * `streak`).
 */

import type { EmitAt } from '../emit';
import type { ParticleSeed } from '../particles';

const LIFE_MS = 160;

export function speedLineSeeds(at: EmitAt, direction: 1 | -1, count: number, rng: () => number): ParticleSeed[] {
    const cx = at.w ? at.x + at.w / 2 : at.x;
    const top = at.y;
    const height = at.h ?? 0;
    const seeds: ParticleSeed[] = [];
    for (let i = 0; i < count; i += 1) {
        seeds.push({
            // Behind the attacker (opposite its heading), spread over its height.
            x: cx - direction * (30 + 40 * rng()),
            y: top + height * (0.15 + 0.7 * rng()),
            vx: -direction * (300 + 300 * rng()),
            vy: 0,
            life: LIFE_MS,
            size: 2,
            r: 235, g: 240, b: 255,
            a: 0.9,
            shape: 'streak',
        });
    }
    return seeds;
}
