/**
 * TICKET 190b — the hit-stop, the camera and the target shake follow the tier that is ON. Showy is
 * pinned by impactMath.test.ts; this file is the other two tiers and the switch itself.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { applySettings, DEFAULT_SETTINGS } from '../../settings/settings';
import { resetActiveTier, setActiveTier } from '../tiers/activeTier';
import { addsCameraTrauma, cameraTraumaFor, hitStopLengthMs, targetShakePx } from './impactMath';

afterEach(() => resetActiveTier());

const hit = { severity: 1, isKill: false, superEffective: false, resisted: false, targets: 1 } as const;

describe('190b — impact numbers follow the active tier', () => {
    it('Showy is the default: 140 ms for a full hit, 170 for a kill', () => {
        expect(hitStopLengthMs(hit)).toBe(140);
        expect(hitStopLengthMs({ ...hit, isKill: true })).toBe(170);
    });

    it('Snappy freezes 110 / 140 and shakes the target 8 px', () => {
        setActiveTier('snappy');
        expect(hitStopLengthMs(hit)).toBe(110);
        expect(hitStopLengthMs({ ...hit, isKill: true })).toBe(140);
        expect(targetShakePx(1)).toBe(8);
    });

    it('Slow freezes 175 / 210 and shakes the target 13 px', () => {
        setActiveTier('slow');
        expect(hitStopLengthMs(hit)).toBe(175);
        expect(hitStopLengthMs({ ...hit, isKill: true })).toBe(210);
        expect(targetShakePx(1)).toBe(13);
    });

    it('Fast and Instant read the Snappy column', () => {
        setActiveTier('fast');
        expect(hitStopLengthMs(hit)).toBe(110);
        setActiveTier('instant');
        expect(hitStopLengthMs(hit)).toBe(110);
    });

    it('the camera starts shaking at s 0.42 on Slow, 0.52 on Showy and 0.67 on Snappy (194k-2)', () => {
        // On a 100-HP body: 3% is s 0.45, 5% is s 0.58, 8% is s 0.73.
        const three = { applied: 3, maxHp: 100, isKill: false, resisted: false };
        const five = { ...three, applied: 5 };
        setActiveTier('slow');
        expect(addsCameraTrauma(three)).toBe(true);
        setActiveTier('showy');
        expect(addsCameraTrauma(three)).toBe(false);
        expect(addsCameraTrauma(five)).toBe(true);
        setActiveTier('snappy');
        expect(addsCameraTrauma(five)).toBe(false);
        expect(addsCameraTrauma({ ...three, applied: 8 })).toBe(true);
    });

    it('trauma is Snappy 0.25..0.7, Slow Showy + 0.1, and a kill adds 0.25 (capped at 1)', () => {
        setActiveTier('snappy');
        expect(cameraTraumaFor(0, false)).toBeCloseTo(0.25);
        expect(cameraTraumaFor(1, false)).toBeCloseTo(0.7);
        setActiveTier('slow');
        expect(cameraTraumaFor(0.5, false)).toBeCloseTo(0.3 + 0.55 * 0.5 + 0.1);
        expect(cameraTraumaFor(1, true)).toBe(1);
    });

    it('applySettings switches the tier that the numbers read', () => {
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'snappy' });
        expect(hitStopLengthMs(hit)).toBe(110);
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'slow' });
        expect(hitStopLengthMs(hit)).toBe(175);
    });
});
