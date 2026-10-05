/**
 * TICKET 194k-4 — the float's size and outline come from the tier profile, as the lab draws them.
 */
import { describe, expect, it } from 'vitest';

import { floatFontPx, floatSizing, LABEL_PX, OUTLINE_MIN_PX, outlinePx, slotStepPx } from './floatStyle';
import { TIER_PROFILES } from './tiers/tierProfiles';

const SHOWY = TIER_PROFILES.showy;

describe('194k-4 — the damage number', () => {
    it('is the profile\'s size: 30 px for a chip, 60 px for a full hit on Showy', () => {
        expect(floatFontPx('damage', SHOWY.damageNumberPx(0))).toBe(30);
        expect(floatFontPx('damage', SHOWY.damageNumberPx(1))).toBe(60);
        expect(floatFontPx('crit', SHOWY.damageNumberPx(0.5))).toBe(SHOWY.damageNumberPx(0.5));
    });

    it('writes that size and its outline into the inline style', () => {
        const style = floatSizing('damage', 45);
        expect(style.fontSize).toBe('45px');
        expect(style.WebkitTextStrokeWidth).toBe(`${outlinePx(45)}px`);
    });

    it('has an outline of 18% of its size and never under 4 px', () => {
        expect(outlinePx(60)).toBe(11);
        expect(outlinePx(30)).toBe(OUTLINE_MIN_PX + 1);
        expect(outlinePx(20)).toBe(OUTLINE_MIN_PX);
        expect(outlinePx(10)).toBe(OUTLINE_MIN_PX);
    });
});

describe('194k-4 — the labels', () => {
    it('a status, a matchup tag, an absorbed number and a Driver name are 20 px with the same outline', () => {
        for (const kind of ['status', 'tag', 'absorbed', 'proc'] as const) {
            expect(floatFontPx(kind)).toBe(LABEL_PX);
            expect(floatSizing(kind).fontSize).toBe('20px');
            expect(floatSizing(kind).WebkitTextStrokeWidth).toBe(`${OUTLINE_MIN_PX}px`);
        }
        expect(LABEL_PX).toBe(20);
    });

    it('a heal, and a damage number with no profile size, leave the size to the class', () => {
        expect(floatSizing('heal')).toEqual({});
        expect(floatSizing('damage')).toEqual({});
    });
});

describe('194k-4 — stacking', () => {
    it('keeps the 167h step of 22 px for small floats and grows it with a big number', () => {
        expect(slotStepPx(undefined)).toBe(22);
        expect(slotStepPx(20)).toBe(22);
        expect(slotStepPx(60)).toBe(42);
    });
});
