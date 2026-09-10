/**
 * TICKET 145d — THE FAN IS THE MOCK'S FAN.
 *
 * The five-card case is asserted against the literal `transform` strings in
 * `145-mock/145-mock.html`, because that is the artefact Henry approved and the ticket says it wins
 * over its own prose. Everything else asserts the SHAPE holds at hand sizes the mock does not draw.
 */
import { describe, expect, it } from 'vitest';

import {
    FAN_MAX_LIFT, FAN_OVERLAP, FAN_TIGHT_OVERLAP, FAN_WIDE_HAND,
    fanCard, fanMaxAngle, fanOverlap,
} from './fanGeometry';

describe('145d — five cards, exactly as the mock draws them', () => {
    const five = [0, 1, 2, 3, 4].map(i => fanCard(i, 5));

    it('rotates -12 / -6 / 0 / 6 / 12', () => {
        expect(five.map(c => c.rotation)).toEqual([-12, -6, 0, 6, 12]);
    });

    it('lifts 0 / 10 / 18 / 10 / 0 — an arch, centre highest', () => {
        expect(five.map(c => Math.round(c.lift))).toEqual([0, 10, 18, 10, 0]);
    });

    /*
     * -23, AND -18 IS STILL THE MOCK'S NUMBER. The mock states its overlap against a 140px card;
     * 2026-09-10 the fan stopped squeezing the face and draws it at `.program-card`'s own 180px,
     * so holding the mock's SHAPE means holding the ratio, not the pixel count: 18/140 x 180 = 23.
     * Keeping -18 at the wider card would have loosened the fan by a sixth and run the hand into
     * the draw and discard piles, which is the exact failure the overlap dial exists to prevent.
     */
    it('overlaps by -23 at the 180px card, holding the mock\'s -18/140 ratio', () => {
        expect(five.map(c => c.overlap)).toEqual([0, -23, -23, -23, -23]);
    });
});

describe('145d — the shape holds at sizes the mock does not draw', () => {
    it('flattens toward 8 degrees and tightens to -30px as the hand grows', () => {
        // §2c: both dials move for one reason — a wider hand at a fixed angle and overlap runs into
        // the draw and discard piles, and the cards must NOT shrink to buy that width back.
        expect(fanMaxAngle(5)).toBe(12);
        expect(fanMaxAngle(FAN_WIDE_HAND)).toBe(8);
        expect(fanOverlap(5)).toBe(FAN_OVERLAP);
        expect(fanOverlap(FAN_WIDE_HAND)).toBe(FAN_TIGHT_OVERLAP);
        // Monotonic in between, so there is no hand size where growing the hand widens the fan.
        for (let n = 5; n < FAN_WIDE_HAND; n += 1) {
            expect(fanMaxAngle(n + 1)).toBeLessThan(fanMaxAngle(n));
            expect(fanOverlap(n + 1)).toBeLessThan(fanOverlap(n));
        }
    });

    it('clamps rather than extrapolating past either end', () => {
        // A 12-card hand must not invert the fan, and a 2-card hand must not splay past 12 degrees.
        expect(fanMaxAngle(12)).toBe(8);
        expect(fanMaxAngle(2)).toBe(12);
        expect(fanOverlap(12)).toBe(FAN_TIGHT_OVERLAP);
    });

    it('is symmetric and centre-highest at every size', () => {
        for (const n of [2, 3, 4, 6, 7, 8]) {
            const cards = Array.from({ length: n }, (_, i) => fanCard(i, n));
            expect(cards[0].rotation).toBeCloseTo(-cards[n - 1].rotation, 6);
            expect(cards[0].lift).toBeCloseTo(cards[n - 1].lift, 6);
            const lifts = cards.map(c => c.lift);
            expect(Math.max(...lifts)).toBeLessThanOrEqual(FAN_MAX_LIFT);
            // The peak is in the middle, wherever "middle" falls for an even count.
            const peak = lifts.indexOf(Math.max(...lifts));
            expect(Math.abs(peak - (n - 1) / 2)).toBeLessThanOrEqual(0.5);
        }
    });

    it('leaves a one-card hand flat rather than tilting it for no reason', () => {
        // `half` is 0 at one card, so every ratio is 0/0 — and a lone card at 12 degrees reads as a
        // rendering fault rather than as a fan.
        expect(fanCard(0, 1)).toEqual({ rotation: 0, lift: 0, overlap: 0 });
    });
});
