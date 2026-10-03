/**
 * TICKET 189d — how hard a hit lands. The default (Showy) tier's numbers, ruled 2026-10-02.
 */
import { describe, expect, it } from 'vitest';

import {
    addsCameraTrauma, cameraTraumaFor, damageSeverity, hitStopLengthMs, SMALL_HIT_FRACTION, targetShakePx, vibratePx,
} from './impactMath';

const plain = { superEffective: false, resisted: false, targets: 1 };

describe('189d — severity', () => {
    it('is clamp(sqrt((damage / maxHp) / 0.45), 0, 1)', () => {
        expect(damageSeverity(0, 100)).toBe(0);
        expect(damageSeverity(45, 100)).toBe(1);
        expect(damageSeverity(90, 100)).toBe(1);
        expect(damageSeverity(11.25, 100)).toBeCloseTo(0.5, 6);   // sqrt(0.25)
    });

    it('survives a zero max and a negative hit', () => {
        expect(damageSeverity(10, 0)).toBe(0);
        expect(damageSeverity(-5, 100)).toBe(0);
    });
});

describe('189d — hit-stop length', () => {
    it('is 60 + 80 s', () => {
        expect(hitStopLengthMs({ ...plain, severity: 0, isKill: false })).toBe(60);
        expect(hitStopLengthMs({ ...plain, severity: 1, isKill: false })).toBe(140);
        expect(hitStopLengthMs({ ...plain, severity: 0.5, isKill: false })).toBe(100);
    });

    it('is 170 on a kill, however small the hit', () => {
        expect(hitStopLengthMs({ ...plain, severity: 0, isKill: true })).toBe(170);
        expect(hitStopLengthMs({ ...plain, severity: 1, isKill: true })).toBe(170);
    });

    it('a kill\'s freeze is longer than a chip\'s', () => {
        const chip = hitStopLengthMs({ ...plain, severity: damageSeverity(5, 100), isKill: false });
        const kill = hitStopLengthMs({ ...plain, severity: damageSeverity(5, 100), isKill: true });
        expect(kill).toBeGreaterThan(chip);
    });

    it('adds 20 when super-effective, takes x0.6 when resisted and x0.6 on a multi-target card', () => {
        expect(hitStopLengthMs({ ...plain, severity: 0, isKill: false, superEffective: true })).toBe(80);
        expect(hitStopLengthMs({ ...plain, severity: 0, isKill: false, resisted: true })).toBe(36);
        expect(hitStopLengthMs({ ...plain, severity: 0, isKill: false, targets: 3 })).toBe(36);
        expect(hitStopLengthMs({ ...plain, severity: 0, isKill: false, resisted: true, targets: 3 })).toBe(22);
        // The bonus comes before the scaling.
        expect(hitStopLengthMs({ ...plain, severity: 0, isKill: false, superEffective: true, targets: 2 })).toBe(48);
    });
});

describe('189d — the shudder and the shake', () => {
    it('vibrates 2-6 px and shakes the target 4-11 px', () => {
        expect(vibratePx(0)).toBe(2);
        expect(vibratePx(1)).toBe(6);
        expect(targetShakePx(0)).toBe(4);
        expect(targetShakePx(1)).toBe(11);
    });
});

describe('189d — camera trauma', () => {
    const hit = (applied: number, over: Partial<{ isKill: boolean; resisted: boolean }> = {}) =>
        ({ applied, maxHp: 100, isKill: false, resisted: false, ...over });

    it('a 6%-of-max-HP hit adds no camera trauma; a 20% hit does', () => {
        expect(addsCameraTrauma(hit(6))).toBe(false);
        expect(addsCameraTrauma(hit(20))).toBe(true);
    });

    it('the line is 12% of max HP', () => {
        expect(SMALL_HIT_FRACTION).toBe(0.12);
        expect(addsCameraTrauma(hit(11))).toBe(false);
        expect(addsCameraTrauma(hit(12))).toBe(true);
    });

    it('a kill always does, a resisted hit never does', () => {
        expect(addsCameraTrauma(hit(2, { isKill: true }))).toBe(true);
        expect(addsCameraTrauma(hit(60, { resisted: true }))).toBe(false);
        expect(addsCameraTrauma(hit(60, { resisted: true, isKill: true }))).toBe(false);
    });

    it('adds 0.3 + 0.55 s, and 0.25 more on a kill', () => {
        expect(cameraTraumaFor(0, false)).toBeCloseTo(0.3, 6);
        expect(cameraTraumaFor(1, false)).toBeCloseTo(0.85, 6);
        expect(cameraTraumaFor(1, true)).toBe(1);
        expect(cameraTraumaFor(0, true)).toBeCloseTo(0.55, 6);
    });
});
