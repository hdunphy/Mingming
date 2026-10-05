/**
 * TICKET 190f — BARK SHIELD LANDS: the lab's `statusLand('Bark')` (TICKET 198b-4). Nine planks in
 * two browns start on a wide ring round the body and spiral in to a tight one over 320 ms (the
 * lab's `r` 150 → 60, turning 1.4 rad as they close), hold, then — the game's own last beat, kept
 * from 190f — settle toward the plaque where the shield bar is.
 */

import type { ParticleSeed } from '../particles';
import { outCubic, inQuad, lerp } from '../attacks/curves';
import { boxOf, centreOf } from './bodyBox';
import type { LandingMaker } from './LandingInput';

export const PLANKS = 9;
/** Half the lab's 26 px plank. */
export const PLANK_PX = 13;
export const BARK_LIFE_MS = 820;
export const BARK_SETTLE_MS = 640;
/** The spiral in takes the lab's 320 ms of the 820. */
const CLOSE_UNTIL = 320 / BARK_LIFE_MS;
/** The lab holds the ring until 560 ms, then it goes. */
const SETTLE_FROM = 560 / BARK_LIFE_MS;
const WIDE_PX = 150;
const TIGHT_PX = 60;
const TWIST = 1.4;
const LIGHT = { r: 168, g: 116, b: 64 };
const DARK = { r: 138, g: 90, b: 44 };

export const barkLanding: LandingMaker = ({ at, plaque }) => {
    const box = boxOf(at);
    const c = centreOf(box);
    const settleAt = plaque ? centreOf(boxOf(plaque)) : c;
    const seeds: ParticleSeed[] = [];

    for (let i = 0; i < PLANKS; i += 1) {
        const base = (i / PLANKS) * Math.PI * 2;
        const ringAt = (k: number): { x: number; y: number } => {
            const th = base + (1 - k) * TWIST;
            const r = lerp(WIDE_PX, TIGHT_PX, k);
            return { x: c.x + Math.cos(th) * r, y: c.y + 6 + Math.sin(th) * r * 0.55 };
        };
        const lock = ringAt(1);
        const colour = i % 2 ? DARK : LIGHT;
        seeds.push({
            x: ringAt(0).x, y: ringAt(0).y, vx: 0, vy: 0,
            life: BARK_LIFE_MS, size: PLANK_PX,
            r: colour.r, g: colour.g, b: colour.b, a: 1, shape: 'plank', add: false,
            rot: base + Math.PI / 2,
            path: (t) => {
                if (t <= CLOSE_UNTIL) return ringAt(outCubic(t / CLOSE_UNTIL));
                if (t <= SETTLE_FROM) return lock;
                const u = inQuad((t - SETTLE_FROM) / (1 - SETTLE_FROM));
                return { x: lerp(lock.x, settleAt.x, u), y: lerp(lock.y, settleAt.y, u) };
            },
        });
    }
    return { seeds };
};
