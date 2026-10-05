/**
 * Where the map node tooltip goes (194m): a pure function of the node's rect, kept out of the component
 * file so that file exports only the component.
 */
import type { AnchoredRect } from '../hooks/useAnchoredRect';

/** The plate's width; the placement keeps it inside the window with this much either side. */
export const TIP_WIDTH_PX = 260;
const EDGE_PX = 8;
const GAP_PX = 10;
/** Under this much room above the node, the plate goes below it instead. */
const MIN_ROOM_ABOVE_PX = 90;

/** Where the plate goes: centred over the node, clamped to the window, flipped below near the top. */
export function placeTip(rect: AnchoredRect, viewportWidth: number): { left: number; top: number; below: boolean } {
    const centre = (rect.left + rect.right) / 2;
    const half = TIP_WIDTH_PX / 2;
    const left = Math.min(Math.max(centre, half + EDGE_PX), Math.max(half + EDGE_PX, viewportWidth - half - EDGE_PX));
    const below = rect.top < MIN_ROOM_ABOVE_PX;
    return { left, top: below ? rect.bottom + GAP_PX : rect.top - GAP_PX, below };
}
