/**
 * TICKET 190f - SHARP LANDS: white glints flash across the body, and one slash glint cuts through it.
 * TICKET 194k-5: the lab's glints are 9-15 px (the game's were 3.5-6).
 */

import { randomIn } from '../attacks/curves';
import type { ParticleSeed } from '../particles';
import { particle } from '../attacks/seeds';
import { boxOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const GLINTS = 5;

export const sharpLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < countFor(GLINTS, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.15, 0.85), y: box.y + box.h * rand(0.2, 0.85),
            life: rand(380, 520), size: rand(9, 15), size2: 1,
            rgb: [255, 255, 255], rgb2: [225, 238, 255], a: 1, kind: 'star',
        }));
    }
    // The slash: one fast line from the upper left to the lower right.
    seeds.push(particle({
        x: box.x + box.w * 0.12, y: box.y + box.h * 0.18, vx: 560, vy: 420, drag: 0,
        life: 260, size: 3, rgb: [255, 255, 255], a: 1, kind: 'streak',
    }));
    return { seeds };
};
