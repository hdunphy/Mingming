/**
 * TICKET 190f - the few places on a body the landings aim at.
 */

import type { EmitAt } from '../emit';

export interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export const boxOf = (at: EmitAt): Box => ({ x: at.x, y: at.y, w: at.w ?? 0, h: at.h ?? 0 });
export const centreOf = (box: Box): { x: number; y: number } => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/** The lab's `feet(u)`: where the body stands (92% down the box). */
export const feetOf = (box: Box): { x: number; y: number } => ({ x: box.x + box.w / 2, y: box.y + box.h * 0.92 });
