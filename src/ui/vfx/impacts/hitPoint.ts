/**
 * TICKET 190e - where on the body a hit lands: its middle, a little toward the attacker, so the spray
 * starts on the face that took the blow and goes away from whoever threw it.
 */

import type { EmitAt } from '../emit';

export function hitPoint(at: EmitAt, direction: 1 | -1): { x: number; y: number } {
    const w = at.w ?? 0;
    const h = at.h ?? 0;
    return { x: at.x + w / 2 - direction * w * 0.18, y: at.y + h * 0.5 };
}

export const tuple = (c: { r: number; g: number; b: number }): readonly [number, number, number] => [c.r, c.g, c.b];
