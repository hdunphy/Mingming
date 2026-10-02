/**
 * TICKET 167f — the tooltip's placement rules, as numbers.
 *
 * Henry, 2026-09-27: *"The card should be static so it hovers next to the mouse."* The rules under
 * test: to the right of the pointer, flipped to the left when the right edge would be crossed, and
 * clamped inside the window with an 8 px margin. Flip and clamps are done on the SCALED tile.
 */
import { describe, expect, it } from 'vitest';

import {
    PEEK_EDGE_MARGIN, PEEK_GAP_X, PEEK_LIFT_Y, PEEK_PAIR_GAP, PEEK_TILE_H, PEEK_TILE_W, placePeek,
} from './peekPlacement';

const W = 1280;
const H = 800;

describe('placePeek', () => {
    it('sits to the right of the pointer, lifted, by default', () => {
        const p = placePeek({ x: 300, y: 400 }, W, H, 1);
        expect(p).toEqual({ left: 300 + PEEK_GAP_X, top: 400 - PEEK_LIFT_Y, flipped: false });
    });

    it('flips to the left of the pointer when the right side would overflow', () => {
        const x = W - 100; // 100 px from the edge, tile is 152 wide
        const p = placePeek({ x, y: 400 }, W, H, 1);
        expect(p.flipped).toBe(true);
        expect(p.left).toBe(x - PEEK_GAP_X - PEEK_TILE_W);
        expect(p.left + PEEK_TILE_W).toBeLessThanOrEqual(x - PEEK_GAP_X);
    });

    it('does not flip when it exactly fits inside the margin', () => {
        const x = W - PEEK_EDGE_MARGIN - PEEK_TILE_W - PEEK_GAP_X;
        expect(placePeek({ x, y: 400 }, W, H, 1).flipped).toBe(false);
        expect(placePeek({ x: x + 1, y: 400 }, W, H, 1).flipped).toBe(true);
    });

    it('clamps to the top and bottom of the window with an 8 px margin', () => {
        expect(placePeek({ x: 300, y: 5 }, W, H, 1).top).toBe(PEEK_EDGE_MARGIN);
        expect(placePeek({ x: 300, y: H - 5 }, W, H, 1).top).toBe(H - PEEK_TILE_H - PEEK_EDGE_MARGIN);
    });

    it('clamps to the left edge when a flipped tile would leave the window', () => {
        // A window barely wider than the tile: both sides overflow, the tile pins to the margin.
        const p = placePeek({ x: 100, y: 100 }, 200, H, 1);
        expect(p.left).toBe(PEEK_EDGE_MARGIN);
    });

    it('does the flip and the clamps on the SCALED size', () => {
        const scale = 1.5;
        const width = PEEK_TILE_W * scale;
        const height = PEEK_TILE_H * scale;
        const x = W - 250;
        const p = placePeek({ x, y: H - 10 }, W, H, scale);
        // 250 px of room at the right, the scaled tile is 228 wide + the 18 px gap: it overflows.
        expect(x + PEEK_GAP_X + width).toBeGreaterThan(W - PEEK_EDGE_MARGIN);
        expect(p.flipped).toBe(true);
        expect(p.left).toBe(x - PEEK_GAP_X - width);
        expect(p.top).toBe(H - height - PEEK_EDGE_MARGIN);
    });
});

describe('placePeek with two tiles (183c: the upgrade preview)', () => {
    it('flips on the PAIR\'s width, which is two tiles and the arrow', () => {
        const pair = PEEK_TILE_W * 2 + PEEK_PAIR_GAP;
        // Room for one tile to the right but not for two: the pair goes left of the pointer.
        const x = W - PEEK_EDGE_MARGIN - PEEK_GAP_X - PEEK_TILE_W - 4;
        expect(placePeek({ x, y: 400 }, W, H, 1).flipped).toBe(false);
        const p = placePeek({ x, y: 400 }, W, H, 1, 2);
        expect(p.flipped).toBe(true);
        expect(p.left).toBe(x - PEEK_GAP_X - pair);
    });

    it('defaults to one tile, exactly as before', () => {
        expect(placePeek({ x: 300, y: 400 }, W, H, 1)).toEqual(placePeek({ x: 300, y: 400 }, W, H, 1, 1));
    });
});
