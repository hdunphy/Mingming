/**
 * TICKET 190d — the maths under the attacks.
 */
import { describe, expect, it } from 'vitest';

import { bez2, bez3, clamp, inOut, invInOut, lerp, outCubic, randomIn } from './curves';

describe('190d — curves', () => {
    it('invInOut undoes inOut', () => {
        for (const t of [0, 0.1, 0.3, 0.5, 0.8, 1]) expect(invInOut(inOut(t))).toBeCloseTo(t, 3);
    });

    it('invInOut clamps its input', () => {
        expect(invInOut(-3)).toBeCloseTo(0, 3);
        expect(invInOut(7)).toBeCloseTo(1, 3);
    });

    it('beziers start at the first point and end at the last', () => {
        const a = { x: 0, y: 0 }; const b = { x: 50, y: 100 }; const c = { x: 80, y: 90 }; const d = { x: 100, y: 0 };
        expect(bez2(a, b, d, 0)).toEqual(a);
        expect(bez2(a, b, d, 1)).toEqual(d);
        expect(bez3(a, b, c, d, 0)).toEqual(a);
        expect(bez3(a, b, c, d, 1)).toEqual(d);
    });

    it('easings run 0 to 1', () => {
        expect(outCubic(0)).toBe(0);
        expect(outCubic(1)).toBe(1);
        expect(inOut(0.5)).toBe(0.5);
    });

    it('lerp and clamp do what they say', () => {
        expect(lerp(10, 20, 0.25)).toBe(12.5);
        expect(clamp(5, 0, 3)).toBe(3);
        expect(clamp(-1, 0, 3)).toBe(0);
    });

    it('randomIn maps the generator onto a range', () => {
        expect(randomIn(() => 0)(4, 8)).toBe(4);
        expect(randomIn(() => 1)(4, 8)).toBe(8);
        expect(randomIn(() => 0.5)(4, 8)).toBe(6);
    });
});
