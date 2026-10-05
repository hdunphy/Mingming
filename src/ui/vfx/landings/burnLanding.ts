/**
 * TICKET 190f - BURN LANDS: flames lick up the body, with an orange glow behind them. One tongue per
 * stack, four at the most (the same cap the standing tongues have, 146a).
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import { burnEmitter } from '../emitters';
import { boxOf, centreOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';

export const burnLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const centre = centreOf(box);
    const counted = stacksAdded ? Math.ceil(stacks / 2) : stacks;
    const tongues = Math.max(1, Math.min(4, Math.round(counted)));

    const seeds = burnEmitter({ x: box.x, y: box.y, w: box.w, h: box.h }, tongues, rng);
    seeds.push(particle({
        x: centre.x + rand(-8, 8), y: centre.y + box.h * 0.12,
        life: 520, size: box.h * 0.26, size2: box.h * 0.4,
        rgb: [255, 170, 70], rgb2: [224, 93, 40], a: 0.3, kind: 'puff',
    }));
    return { seeds };
};
