import { describe, it, expect } from 'vitest';
import {
    DARK_TEXT,
    LIGHT_TEXT,
    ELEMENT_HEX,
    relativeLuminance,
    contrastRatio,
    readableTextOn,
    getElementTextColor,
    getElementBadgeBg,
    getElementAccent,
    badgeTextShadow,
} from './contrastText';

describe('contrastText', () => {
    it('returns dark text on bright backgrounds', () => {
        expect(readableTextOn('#00ffff')).toBe(DARK_TEXT); // Ice cyan
        expect(readableTextOn('#ffff80')).toBe(DARK_TEXT); // Light yellow
        expect(readableTextOn('#87ceeb')).toBe(DARK_TEXT); // Air sky blue
        expect(readableTextOn('#ffffff')).toBe(DARK_TEXT);
    });

    it('returns white text on dark backgrounds', () => {
        expect(readableTextOn('#8000ff')).toBe(LIGHT_TEXT); // Dark purple
        expect(readableTextOn('#ff3333')).toBe(LIGHT_TEXT); // Fire red
        expect(readableTextOn('#000000')).toBe(LIGHT_TEXT);
    });

    it('computes relative luminance at the extremes', () => {
        expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
        expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
        expect(relativeLuminance('#00ffff')).toBeGreaterThan(relativeLuminance('#ff3333'));
    });

    it('the reported bug: Ice cost badges no longer get white text', () => {
        expect(getElementTextColor('Ice')).toBe(DARK_TEXT);
        expect(badgeTextShadow(getElementTextColor('Ice'))).toBe('none');
    });

    it('every element badge fill meets WCAG AA (>= 4.5:1) with its text', () => {
        for (const el of Object.keys(ELEMENT_HEX)) {
            const ratio = contrastRatio(getElementTextColor(el), getElementBadgeBg(el));
            expect(ratio, `${el} badge contrast`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('element accent text is readable on the dark terminal backdrop', () => {
        for (const el of Object.keys(ELEMENT_HEX)) {
            const ratio = contrastRatio(getElementAccent(el), '#0d0d14');
            expect(ratio, `${el} accent contrast`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('falls back safely for unknown elements and malformed input', () => {
        expect(getElementTextColor('???')).toBe(getElementTextColor('None'));
        expect(readableTextOn('var(--ice)')).toBe(LIGHT_TEXT); // unparseable -> treated as dark bg
    });
});
