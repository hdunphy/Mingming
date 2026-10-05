/** Where a burst is born: the lab's `center(u)`, the middle of the body. */

import type { EmitAt } from '../emit';

export function centreOf(at: EmitAt): { x: number; y: number } {
    return { x: at.x + (at.w ?? 0) / 2, y: at.y + (at.h ?? 0) / 2 };
}

/** The heading a burst flies off in: on from the attacker (the lab's `away`). */
export const awayFrom = (direction: 1 | -1): number => (direction > 0 ? 0 : Math.PI);

export const tuple = (c: { r: number; g: number; b: number }): readonly [number, number, number] => [c.r, c.g, c.b];
