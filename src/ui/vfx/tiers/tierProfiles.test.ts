/**
 * TICKET 190b — the tier profiles: ONE data table of every timing, read by the clock and by the
 * choreography. The numbers are the ones in the ticket's table (Henry's rulings of 2026-10-02 on the
 * Battle Juice Lab), so this file is also the check that the table was typed in right.
 */
import { describe, expect, it } from 'vitest';

import { BATTLE_SPEEDS } from '../clock/battleSpeedTiers';
import { PROFILE_KEYS, TIER_PROFILES, damageScale, profileFor, profileKeyFor, type TierProfile } from './tierProfiles';

const SHOWY = TIER_PROFILES.showy;
const SNAPPY = TIER_PROFILES.snappy;
const SLOW = TIER_PROFILES.slow;

describe('190b — damageScale (s)', () => {
    it('is clamp(sqrt((damage / maxHp) / 0.45), 0, 1)', () => {
        expect(damageScale(0, 100)).toBe(0);
        expect(damageScale(45, 100)).toBe(1);
        expect(damageScale(200, 100)).toBe(1);
        expect(damageScale(11.25, 100)).toBeCloseTo(0.5, 6);
    });

    it('keeps a chip quick and a 45 from being three times a 15', () => {
        expect(damageScale(45, 100) / damageScale(15, 100)).toBeLessThan(1.8);
    });

    it('survives a zero max HP and a negative hit', () => {
        expect(damageScale(5, 0)).toBe(0);
        expect(damageScale(-5, 100)).toBe(0);
    });
});

describe('190b — which profile each of the five tiers reads', () => {
    it('Slow, Showy and Snappy read their own; Fast and Instant read Snappy', () => {
        expect(BATTLE_SPEEDS.map(profileKeyFor)).toEqual(['slow', 'showy', 'snappy', 'snappy', 'snappy']);
        expect(profileFor('fast')).toBe(SNAPPY);
        expect(profileFor('showy')).toBe(SHOWY);
    });
});

describe('190b — every field is present for every profile', () => {
    const fields: Array<keyof TierProfile> = [
        'windupMs', 'lunge', 'headMs', 'sustainMs', 'hitStopMs', 'hitStopKillMs', 'knockbackMs', 'returnMs',
        'statusOnly', 'cardInMs', 'cardOutMs', 'enemyHoverMs', 'cameraShakeFrom', 'trauma', 'targetShakePx',
        'particleScale', 'dimFrom', 'chargeFrom', 'cameraPunch', 'damageNumberPx',
    ];

    for (const key of PROFILE_KEYS) {
        it(`${key} has all ${fields.length} fields`, () => {
            for (const field of fields) expect(TIER_PROFILES[key][field], `${key}.${field}`).not.toBeUndefined();
        });

        it(`${key}'s curves are finite and never negative from s = 0 to 1`, () => {
            const p = TIER_PROFILES[key];
            for (const s of [0, 0.25, 0.5, 0.75, 1]) {
                for (const v of [p.windupMs(s), p.headMs(s), p.sustainMs(s), p.hitStopMs(s), p.trauma(s), p.targetShakePx(s), p.damageNumberPx(s)]) {
                    expect(Number.isFinite(v) && v >= 0).toBe(true);
                }
            }
        });
    }
});

describe('190b — the Snappy column', () => {
    it('matches the ticket table', () => {
        expect(SNAPPY.windupMs(0)).toBe(50);
        expect(SNAPPY.windupMs(1)).toBe(50);
        expect(SNAPPY.lunge).toEqual({ ms: 100, px: 34 });
        expect(SNAPPY.headMs(0)).toBe(120);
        expect(SNAPPY.headMs(1)).toBe(180);
        expect(SNAPPY.sustainMs(0)).toBe(20);
        expect(SNAPPY.sustainMs(1)).toBe(200);
        expect(SNAPPY.hitStopMs(0)).toBe(40);
        expect(SNAPPY.hitStopMs(1)).toBe(110);
        expect(SNAPPY.hitStopKillMs).toBe(140);
        expect([SNAPPY.knockbackMs, SNAPPY.returnMs]).toEqual([110, 130]);
        expect(SNAPPY.statusOnly).toEqual({ wiggleMs: 200, orbMs: 220, landingMs: 340 });
        expect([SNAPPY.cardInMs, SNAPPY.cardOutMs]).toEqual([150, 140]);
        expect(SNAPPY.enemyHoverMs).toBe(1000);
        expect(SNAPPY.cameraShakeFrom).toBe(0.2);
        expect(SNAPPY.trauma(0)).toBeCloseTo(0.25);
        expect(SNAPPY.trauma(1)).toBeCloseTo(0.7);
        expect(SNAPPY.targetShakePx(0)).toBe(3);
        expect(SNAPPY.targetShakePx(1)).toBe(8);
        expect(SNAPPY.particleScale).toBeCloseTo(0.85);
        expect(SNAPPY.dimFrom).toBeNull();
        expect(SNAPPY.chargeFrom).toBeNull();
        expect(SNAPPY.cameraPunch).toBe(0);
        expect(SNAPPY.damageNumberPx(0)).toBe(26);
        expect(SNAPPY.damageNumberPx(1)).toBe(48);
    });
});

describe('190b — the Showy column', () => {
    it('matches the ticket table', () => {
        expect(SHOWY.windupMs(0)).toBe(120);
        expect(SHOWY.windupMs(1)).toBe(220);
        expect(SHOWY.lunge).toEqual({ ms: 150, px: 54 });
        expect(SHOWY.headMs(0)).toBe(180);
        expect(SHOWY.headMs(1)).toBe(260);
        expect(SHOWY.sustainMs(0)).toBe(120);
        expect(SHOWY.sustainMs(1)).toBe(600);
        expect(SHOWY.hitStopMs(0)).toBe(60);
        expect(SHOWY.hitStopMs(1)).toBe(140);
        expect(SHOWY.hitStopKillMs).toBe(170);
        expect([SHOWY.knockbackMs, SHOWY.returnMs]).toEqual([170, 200]);
        expect(SHOWY.statusOnly).toEqual({ wiggleMs: 300, orbMs: 320, landingMs: 520 });
        expect([SHOWY.cardInMs, SHOWY.cardOutMs]).toEqual([180, 160]);
        expect(SHOWY.enemyHoverMs).toBe(1000);
        expect(SHOWY.cameraShakeFrom).toBe(0.12);
        expect(SHOWY.trauma(0)).toBeCloseTo(0.3);
        expect(SHOWY.trauma(1)).toBeCloseTo(0.85);
        expect(SHOWY.targetShakePx(0)).toBe(4);
        expect(SHOWY.targetShakePx(1)).toBe(11);
        expect(SHOWY.particleScale).toBeCloseTo(1.3);
        expect(SHOWY.dimFrom).toBe(0.6);
        expect(SHOWY.chargeFrom).toBe(0.5);
        expect(SHOWY.cameraPunch).toBeCloseTo(0.03);
        expect(SHOWY.damageNumberPx(0)).toBe(30);
        expect(SHOWY.damageNumberPx(1)).toBe(60);
    });
});

describe('190b — the Slow column is a heavier Showy', () => {
    it('is 1.3 x Showy for the wind-up, the projectile head and the pour', () => {
        for (const s of [0, 0.5, 1]) {
            expect(SLOW.windupMs(s)).toBeCloseTo(1.3 * SHOWY.windupMs(s));
            expect(SLOW.headMs(s)).toBeCloseTo(1.3 * SHOWY.headMs(s));
            expect(SLOW.sustainMs(s)).toBeCloseTo(1.3 * SHOWY.sustainMs(s));
        }
    });

    it('is 1.25 x Showy for the hit-stop, with a kill of 210', () => {
        expect(SLOW.hitStopMs(0.5)).toBeCloseTo(1.25 * SHOWY.hitStopMs(0.5));
        expect(SLOW.hitStopKillMs).toBe(210);
    });

    it('matches the rest of the ticket table', () => {
        expect(SLOW.lunge).toEqual({ ms: 190, px: 62 });
        expect([SLOW.knockbackMs, SLOW.returnMs]).toEqual([220, 250]);
        expect(SLOW.statusOnly).toEqual({ wiggleMs: 380, orbMs: 400, landingMs: 650 });
        expect([SLOW.cardInMs, SLOW.cardOutMs]).toEqual([220, 200]);
        expect(SLOW.cameraShakeFrom).toBe(0.08);
        expect(SLOW.trauma(0.5)).toBeCloseTo(SHOWY.trauma(0.5) + 0.1);
        expect(SLOW.targetShakePx(0)).toBe(5);
        expect(SLOW.targetShakePx(1)).toBe(13);
        expect(SLOW.particleScale).toBeCloseTo(1.5);
        expect(SLOW.dimFrom).toBe(0.35);
        expect(SLOW.chargeFrom).toBe(0.3);
        expect(SLOW.cameraPunch).toBeCloseTo(0.045);
        expect(SLOW.damageNumberPx(0)).toBe(34);
        expect(SLOW.damageNumberPx(1)).toBe(66);
    });

    it('caps trauma at 1', () => {
        expect(SLOW.trauma(1)).toBeLessThanOrEqual(1);
    });
});

describe('190b — the enemy card hovers a second at every tier', () => {
    it('is 1000 everywhere', () => {
        for (const key of PROFILE_KEYS) expect(TIER_PROFILES[key].enemyHoverMs).toBe(1000);
    });
});

describe('190b — Slow is slower than Showy is slower than Snappy', () => {
    it('in the wind-up, the pour and the hit-stop at a full-strength hit', () => {
        for (const pick of [
            (p: TierProfile) => p.windupMs(1),
            (p: TierProfile) => p.sustainMs(1),
            (p: TierProfile) => p.hitStopMs(1),
            (p: TierProfile) => p.lunge.ms,
        ]) {
            expect(pick(SLOW)).toBeGreaterThan(pick(SHOWY));
            expect(pick(SHOWY)).toBeGreaterThan(pick(SNAPPY));
        }
    });
});
