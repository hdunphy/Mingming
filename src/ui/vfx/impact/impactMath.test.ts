/**
 * TICKET 189d — how hard a hit lands. The default (Showy) tier's numbers, ruled 2026-10-02.
 */
import { describe, expect, it } from 'vitest';

import { damageScale } from '../tiers/tierProfiles';

import {
    addsCameraTrauma, cameraTraumaFor, damageSeverity, hitStopLengthMs, targetShakePx, vibratePx,
} from './impactMath';

const plain = { superEffective: false, resisted: false, targets: 1 };

describe('189d — severity', () => {
    it('is clamp(sqrt((damage / maxHp) / 0.15), 0, 1), the same curve as the damage scale (194k-1)', () => {
        expect(damageSeverity(0, 100)).toBe(0);
        expect(damageSeverity(15, 100)).toBe(1);
        expect(damageSeverity(90, 100)).toBe(1);
        expect(damageSeverity(3.75, 100)).toBeCloseTo(0.5, 6);    // sqrt(0.25)
        expect(damageSeverity(50, 1150)).toBeCloseTo(damageScale(50, 1150), 12);
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
        ({ applied, maxHp: 1150, isKill: false, resisted: false, ...over });

    it('a 2%-of-max-HP hit adds no camera trauma; a 20% hit does', () => {
        expect(addsCameraTrauma(hit(23))).toBe(false);
        expect(addsCameraTrauma(hit(230))).toBe(true);
    });

    it('194k-2: the line is damage scale s 0.52 on Showy, about 4% of max HP, not the lab\'s 12% of a 100-HP body', () => {
        expect(damageSeverity(46, 1150)).toBeLessThan(0.52);        // 4.0%
        expect(addsCameraTrauma(hit(46))).toBe(false);
        expect(damageSeverity(47, 1150)).toBeGreaterThanOrEqual(0.52); // 4.1%
        expect(addsCameraTrauma(hit(47))).toBe(true);
        // The 10-04 median (50) now shakes the camera; before it took 138.
        expect(addsCameraTrauma(hit(50))).toBe(true);
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
