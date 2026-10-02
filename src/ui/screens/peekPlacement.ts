/**
 * TICKET 167f — where a card-peek tooltip goes, as arithmetic.
 *
 * Henry, 2026-09-27: *"The card should be static so it hovers next to the mouse and it should be
 * outside of any containers. Like a tooltip."* This file is the "next to the mouse" half: the
 * pointer position and the window go in, a fixed-position `left`/`top` comes out, so the rules
 * (flip at the right edge, clamp top and bottom) are testable without a browser.
 *
 * It does no drawing and holds no state. `CardPeek` draws, `useCardPeek` tracks the pointer.
 */

/** The tile's unscaled size. `CardPeek` writes these as `--cw`/`--ch`, so the maths and the paint agree. */
export const PEEK_TILE_W = 152;
export const PEEK_TILE_H = 200;

/** The upgrade preview draws two tiles with an arrow between them. */
export const PEEK_PAIR_GAP = 28;

/** Gap between the pointer and the tile's near edge, and how far up the tile starts. */
export const PEEK_GAP_X = 18;
export const PEEK_LIFT_Y = 40;
/** Never closer than this to any window edge. */
export const PEEK_EDGE_MARGIN = 8;

export interface PeekPoint {
    readonly x: number;
    readonly y: number;
}

export interface PeekPlacement {
    /** Fixed-position left/top of the tile's top-left corner, in real pixels. */
    readonly left: number;
    readonly top: number;
    /** True when the tile went to the left of the pointer because the right side would overflow. */
    readonly flipped: boolean;
}

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/**
 * Right of the pointer by default; left of it when the right edge would be crossed; then clamped
 * inside the window. `scale` is the game's stage scale, applied to the tile's drawn size — the
 * flip and the clamps are done on the SCALED size, which is what actually lands on screen.
 */
export function placePeek(
    at: PeekPoint,
    viewportWidth: number,
    viewportHeight: number,
    scale: number,
    /** 2 for the upgrade preview (now → upgraded); 1 for every other peek. */
    tiles: 1 | 2 = 1,
): PeekPlacement {
    const width = (tiles === 2 ? PEEK_TILE_W * 2 + PEEK_PAIR_GAP : PEEK_TILE_W) * scale;
    const height = PEEK_TILE_H * scale;

    const rightSide = at.x + PEEK_GAP_X;
    const overflows = rightSide + width > viewportWidth - PEEK_EDGE_MARGIN;
    const rawLeft = overflows ? at.x - PEEK_GAP_X - width : rightSide;

    const left = clamp(rawLeft, PEEK_EDGE_MARGIN, Math.max(PEEK_EDGE_MARGIN, viewportWidth - width - PEEK_EDGE_MARGIN));
    const top = clamp(at.y - PEEK_LIFT_Y, PEEK_EDGE_MARGIN, Math.max(PEEK_EDGE_MARGIN, viewportHeight - height - PEEK_EDGE_MARGIN));
    return { left, top, flipped: overflows };
}
