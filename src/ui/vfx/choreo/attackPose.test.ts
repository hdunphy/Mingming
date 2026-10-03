/**
 * TICKET 190c — the attacker's pose over time. Crouch back 8 px with a squash (1.06 x 0.92), lunge,
 * HOLD the pose until the hit lands, hold through the knock-back, walk back. A status-only card
 * wiggles in place and never lunges.
 */
import { describe, expect, it } from 'vitest';

import { planAttack, planStatusOnly } from '../tiers/attackPlan';
import { TIER_PROFILES } from '../tiers/tierProfiles';
import { attackPose, poseToFramer, statusPose } from './attackPose';

const SHOWY = TIER_PROFILES.showy;
const hit = { damage: 45, maxHp: 100, isKill: false } as const;
const ranged = planAttack(SHOWY, { ...hit, contact: false });
const at = (pose: ReturnType<typeof attackPose>, ms: number) => pose.keys.find((key) => Math.abs(key.atMs - ms) < 0.5);

describe('190c — a ranged attack pose', () => {
    const pose = attackPose(ranged, SHOWY, { direction: 1 });

    it('crouches back 8 px with a squash at the end of the wind-up', () => {
        const key = at(pose, ranged.game.windupEndMs)!;
        expect(key.x).toBe(-8);
        expect(key.scaleX).toBeCloseTo(1.06);
        expect(key.scaleY).toBeCloseTo(0.92);
    });

    it('lunges 54 px toward the enemy side at Showy', () => {
        expect(at(pose, ranged.game.lungeEndMs)!.x).toBe(54);
    });

    it('holds that x from the end of the lunge until the knock-back is over', () => {
        const held = pose.keys.filter((key) => key.atMs >= ranged.game.lungeEndMs && key.atMs <= ranged.game.knockbackEndMs);
        expect(held.length).toBeGreaterThanOrEqual(2);
        for (const key of held) expect(key.x).toBe(54);
        expect(at(pose, ranged.game.impactMs)!.x).toBe(54);
    });

    it('is home, unsquashed, when the return ends', () => {
        const last = pose.keys[pose.keys.length - 1];
        expect(last.atMs).toBeCloseTo(ranged.game.endMs);
        expect([last.x, last.y, last.rotate, last.scaleX, last.scaleY]).toEqual([0, 0, 0, 1, 1]);
        expect(pose.durationMs).toBeCloseTo(ranged.game.endMs);
    });

    it('goes the other way for an enemy (direction -1)', () => {
        const enemy = attackPose(ranged, SHOWY, { direction: -1 });
        expect(at(enemy, ranged.game.windupEndMs)!.x).toBe(8);
        expect(at(enemy, ranged.game.lungeEndMs)!.x).toBe(-54);
    });

    it('lunges 34 on Snappy and 62 on Slow', () => {
        const snappy = planAttack(TIER_PROFILES.snappy, { ...hit, contact: false });
        const slow = planAttack(TIER_PROFILES.slow, { ...hit, contact: false });
        expect(at(attackPose(snappy, TIER_PROFILES.snappy, { direction: 1 }), snappy.game.lungeEndMs)!.x).toBe(34);
        expect(at(attackPose(slow, TIER_PROFILES.slow, { direction: 1 }), slow.game.lungeEndMs)!.x).toBe(62);
    });

    it('keys are in time order', () => {
        for (let i = 1; i < pose.keys.length; i += 1) expect(pose.keys[i].atMs).toBeGreaterThanOrEqual(pose.keys[i - 1].atMs);
    });
});

describe('190c — a contact card dashes in', () => {
    const plan = planAttack(SHOWY, { ...hit, contact: true });
    const pose = attackPose(plan, SHOWY, { direction: 1, dashPx: 400 });

    it('travels the whole dash (not the lunge) and the hit lands when it arrives', () => {
        const arrival = at(pose, plan.game.lungeEndMs)!;
        expect(arrival.x).toBe(400);
        expect(plan.game.impactMs).toBeCloseTo(plan.game.lungeEndMs);
    });

    it('never dashes backwards when the target is close', () => {
        expect(at(attackPose(plan, SHOWY, { direction: 1, dashPx: -30 }), plan.game.lungeEndMs)!.x).toBe(0);
    });

    it('holds the dash through the knock-back and then returns', () => {
        expect(at(pose, plan.game.knockbackEndMs)!.x).toBe(400);
        expect(pose.keys[pose.keys.length - 1].x).toBe(0);
    });
});

describe('190c — a status-only pose', () => {
    const plan = planStatusOnly(SHOWY);
    const pose = statusPose(plan, { direction: 1 });

    it('never moves sideways: no lunge', () => {
        for (const key of pose.keys) expect(key.x).toBe(0);
    });

    it('hops (up and back down) and rocks for the wiggle', () => {
        expect(Math.min(...pose.keys.map((key) => key.y))).toBeLessThan(-10);
        expect(pose.keys.some((key) => key.rotate !== 0)).toBe(true);
        expect(pose.keys[pose.keys.length - 1].y).toBe(0);
        expect(pose.durationMs).toBe(300);
    });
});

describe('190c — the pose as framer-motion keyframes', () => {
    it('gives each value one entry per key, times from 0 to 1, and a duration in seconds', () => {
        const pose = attackPose(ranged, SHOWY, { direction: 1 });
        const framer = poseToFramer(pose);
        for (const name of ['x', 'y', 'rotate', 'scaleX', 'scaleY'] as const) expect(framer.values[name]).toHaveLength(pose.keys.length);
        expect(framer.times).toHaveLength(pose.keys.length);
        expect(framer.times[0]).toBe(0);
        expect(framer.times[framer.times.length - 1]).toBe(1);
        expect(framer.durationS).toBeCloseTo(pose.durationMs / 1000);
        expect(framer.ease).toHaveLength(pose.keys.length - 1);
    });
});
