/**
 * TICKET 190f - BURN LANDS: flames lick up the body, with an orange glow behind them. One tongue per
 * stack, four at the most (the same cap the standing tongues have, 146a).
 *
 * TICKET 194k-5: and the lab's burst on top of them. The lab throws 24 flames of 7-11 px thinning to
 * 2, rising 140-320 px/s off the feet (`statusLand`, 'Burn'); the game threw 1-4 tongues. The
 * tongues stay (they are the standing flame's shape), the 24 are the burst, grown by the stacks.
 */

import { randomIn } from '../attacks/curves';
import { particle } from '../attacks/seeds';
import { burnEmitter } from '../emitters';
import { boxOf, centreOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';
import { countFor } from './stackFactor';

export const FLAMES = 24;

export const burnLanding: LandingMaker = ({ at, stacks, stacksAdded, rng = Math.random }) => {
    const rand = randomIn(rng);
    const box = boxOf(at);
    const centre = centreOf(box);
    const tongues = Math.max(1, Math.min(4, Math.round(stacks)));

    const seeds = burnEmitter({ x: box.x, y: box.y, w: box.w, h: box.h }, tongues, rng);
    for (let i = 0; i < countFor(FLAMES, stacks, stacksAdded); i += 1) {
        seeds.push(particle({
            x: box.x + box.w * rand(0.26, 0.74), y: box.y + box.h * (1 - rand(0, 0.21)),
            vx: rand(-15, 15), vy: -rand(140, 320), drag: 0.03,
            life: rand(380, 680), size: rand(7, 11), size2: 2,
            rgb: [255, 230, 150], rgb2: [255, 122, 47], a: 0.95, kind: 'puff',
        }));
    }
    seeds.push(particle({
        x: centre.x + rand(-8, 8), y: centre.y + box.h * 0.12,
        life: 520, size: box.h * 0.26, size2: box.h * 0.4,
        rgb: [255, 170, 70], rgb2: [224, 93, 40], a: 0.3, kind: 'puff',
    }));
    return { seeds };
};
