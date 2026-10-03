/**
 * TICKET 190b — a plan for one attack, built from a tier profile. It is the order and the length of
 * the beats; 190c plays them and 190d draws the middle.
 *
 * The lab measured one Flame Column at 45 damage: Slow 2.24 s, Showy 1.74 s, Snappy 0.91 s, Fast 0.44 s
 * and Instant 0. This file holds the profiles to those.
 */
import { describe, expect, it } from 'vitest';

import { TIER_PROFILES } from './tierProfiles';
import { planAttack } from './attackPlan';

const hit = { damage: 45, maxHp: 100, isKill: false, contact: false } as const;

describe('190b — planAttack', () => {
    it('totals 1740 ms (plus or minus 10) for Showy at 45 damage', () => {
        const plan = planAttack(TIER_PROFILES.showy, hit);
        expect(Math.abs(plan.totalMs - 1740)).toBeLessThanOrEqual(10);
    });

    it('totals about 2.24 s on Slow and 0.91 s on Snappy', () => {
        expect(Math.abs(planAttack(TIER_PROFILES.slow, hit).totalMs - 2240)).toBeLessThanOrEqual(10);
        expect(Math.abs(planAttack(TIER_PROFILES.snappy, hit).totalMs - 910)).toBeLessThanOrEqual(50);
    });

    it('is the order wind-up, lunge, travel, hit-stop, knockback, return', () => {
        const plan = planAttack(TIER_PROFILES.showy, hit);
        expect(plan.segments.map((s) => s.kind)).toEqual(['windup', 'lunge', 'travel', 'hitstop', 'knockback', 'return']);
    });

    it('starts each beat where the last one ended, with no gaps', () => {
        const plan = planAttack(TIER_PROFILES.showy, hit);
        let at = 0;
        for (const segment of plan.segments) {
            expect(segment.startMs).toBeCloseTo(at);
            at += segment.durationMs;
        }
        expect(plan.totalMs).toBeCloseTo(at);
    });

    it('lands the hit when the travel ends, before the freeze', () => {
        const plan = planAttack(TIER_PROFILES.showy, hit);
        const travel = plan.segments.find((s) => s.kind === 'travel')!;
        expect(plan.impactAtMs).toBeCloseTo(travel.startMs + travel.durationMs);
        expect(plan.segments.find((s) => s.kind === 'hitstop')!.startMs).toBeCloseTo(plan.impactAtMs);
    });

    it('is longer for a bigger hit, but a 45 is not three times a 15', () => {
        const small = planAttack(TIER_PROFILES.showy, { ...hit, damage: 15 });
        const big = planAttack(TIER_PROFILES.showy, hit);
        expect(big.totalMs).toBeGreaterThan(small.totalMs);
        expect(big.totalMs / small.totalMs).toBeLessThan(1.8);
    });

    it('lengthens only the travel and the freeze as damage grows, never the lunge or the return', () => {
        const small = planAttack(TIER_PROFILES.showy, { ...hit, damage: 5 });
        const big = planAttack(TIER_PROFILES.showy, hit);
        const ms = (plan: typeof big, kind: string) => plan.segments.find((s) => s.kind === kind)!.durationMs;
        expect(ms(big, 'lunge')).toBe(ms(small, 'lunge'));
        expect(ms(big, 'return')).toBe(ms(small, 'return'));
        expect(ms(big, 'travel')).toBeGreaterThan(ms(small, 'travel'));
    });

    it('uses the kill freeze on a kill, however small the hit', () => {
        const plan = planAttack(TIER_PROFILES.showy, { ...hit, damage: 1, isKill: true });
        expect(plan.segments.find((s) => s.kind === 'hitstop')!.durationMs).toBe(170);
    });

    it('lets the caller override the freeze (super-effective, resisted, multi-target)', () => {
        const plan = planAttack(TIER_PROFILES.showy, { ...hit, hitStopMs: 22 });
        expect(plan.segments.find((s) => s.kind === 'hitstop')!.durationMs).toBe(22);
    });

    it('dashes a contact card all the way in: a longer lunge and no travel', () => {
        const plan = planAttack(TIER_PROFILES.showy, { ...hit, contact: true });
        expect(plan.segments.map((s) => s.kind)).toEqual(['windup', 'lunge', 'hitstop', 'knockback', 'return']);
        expect(plan.segments.find((s) => s.kind === 'lunge')!.durationMs).toBeCloseTo(1.6 * 150);
    });

    it('is the same plan for the same inputs', () => {
        expect(planAttack(TIER_PROFILES.slow, hit)).toEqual(planAttack(TIER_PROFILES.slow, hit));
    });
});
