/**
 * TICKET 190c — THE ATTACKER'S POSE OVER TIME, as keys in game milliseconds. Pure data: the sprite
 * turns it into one framer-motion animation held to the battle clock (so a freeze holds it).
 *
 * Ranged:  crouch back 8 px with a squash (1.06 x 0.92) -> lunge 34 / 54 / 62 px (a stretch, 0.96 x
 *          1.05, settling to 1 x 1 in 90 ms) -> HOLD until the hit lands and the knock-back plays
 *          out -> walk back.
 * Contact: the same crouch, then a dash all the way in (the target's distance less 115 px) with a
 *          stretch, held through the knock-back, then back.
 * Status:  a hop with a small rock and squash, in place.
 *
 * `direction` is +1 for an ally (toward the right) and -1 for an enemy.
 */

import type { AttackPlan, StatusPlan } from '../tiers/attackPlan';
import type { TierProfile } from '../tiers/tierProfiles';

export const CROUCH_PX = 8;
export const CROUCH_SQUASH = { scaleX: 1.06, scaleY: 0.92 } as const;
const LUNGE_STRETCH = { scaleX: 0.96, scaleY: 1.05 } as const;
const DASH_STRETCH = { scaleX: 1.08, scaleY: 0.94 } as const;
/** How long the stretch of a lunge takes to settle back to 1 x 1. */
const SETTLE_MS = 90;
/** The dash stops this far short of the target's centre (the lab's number). */
export const DASH_STOPS_SHORT_PX = 115;

const HOP_PX = 18;
const ROCK_DEGREES = 6;
const WIGGLE_STEPS = 10;

export type PoseEase = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface PoseKey {
    readonly atMs: number;
    readonly x: number;
    readonly y: number;
    readonly rotate: number;
    readonly scaleX: number;
    readonly scaleY: number;
    /** How the pose gets here from the key before. */
    readonly ease: PoseEase;
}

export interface Pose {
    readonly durationMs: number;
    readonly keys: readonly PoseKey[];
}

export interface AttackPoseOptions {
    readonly direction: 1 | -1;
    /** For a contact card: how far to run, in stage px. Ignored by a ranged card. */
    readonly dashPx?: number;
}

const HOME: Omit<PoseKey, 'atMs' | 'ease'> = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };

const key = (atMs: number, ease: PoseEase, pose: Partial<Omit<PoseKey, 'atMs' | 'ease'>>): PoseKey => ({
    ...HOME, ...pose, atMs, ease,
});

export function attackPose(plan: AttackPlan, profile: TierProfile, options: AttackPoseOptions): Pose {
    const d = options.direction;
    const g = plan.game;
    const contact = !plan.segments.some((segment) => segment.kind === 'travel');
    const reach = contact ? Math.max(0, options.dashPx ?? 0) : profile.lunge.px;
    const stretch = contact ? DASH_STRETCH : LUNGE_STRETCH;
    const forward = { x: reach * d, ...stretch };
    const held = { x: reach * d };

    const keys: PoseKey[] = [
        key(0, 'linear', {}),
        key(g.windupEndMs, 'easeOut', { x: -CROUCH_PX * d, ...CROUCH_SQUASH }),
        key(g.lungeEndMs, contact ? 'easeIn' : 'easeOut', forward),
    ];
    // The stretch settles while the pose is held (a dash arrives and the hit lands at once: no room).
    const settleAt = Math.min(g.lungeEndMs + SETTLE_MS, g.knockbackEndMs);
    if (settleAt > g.lungeEndMs) keys.push(key(settleAt, 'linear', held));
    if (g.impactMs > settleAt) keys.push(key(g.impactMs, 'linear', held));
    if (g.knockbackEndMs > keys[keys.length - 1].atMs) keys.push(key(g.knockbackEndMs, 'linear', held));
    keys.push(key(g.endMs, 'easeInOut', {}));
    return { durationMs: g.endMs, keys };
}

export function statusPose(plan: StatusPlan, options: Pick<AttackPoseOptions, 'direction'>): Pose {
    const wiggleMs = plan.segments[0].durationMs;
    const keys: PoseKey[] = [];
    for (let i = 0; i <= WIGGLE_STEPS; i += 1) {
        const p = i / WIGGLE_STEPS;
        const squash = Math.sin(Math.PI * 2 * p);
        const last = i === WIGGLE_STEPS;
        keys.push(key(wiggleMs * p, 'easeInOut', last ? {} : {
            y: -HOP_PX * Math.sin(Math.PI * p),
            rotate: ROCK_DEGREES * options.direction * Math.sin(p * Math.PI * 3) * (1 - p),
            scaleX: 1 + 0.05 * squash,
            scaleY: 1 - 0.05 * squash,
        }));
    }
    return { durationMs: wiggleMs, keys };
}

export interface FramerPose {
    readonly values: Readonly<Record<'x' | 'y' | 'rotate' | 'scaleX' | 'scaleY', number[]>>;
    readonly times: number[];
    readonly ease: PoseEase[];
    readonly durationS: number;
}

/** A pose as the arguments of `animate(element, values, { times, ease, duration })`. */
export function poseToFramer(pose: Pose): FramerPose {
    const total = pose.durationMs || 1;
    return {
        values: {
            x: pose.keys.map((entry) => entry.x),
            y: pose.keys.map((entry) => entry.y),
            rotate: pose.keys.map((entry) => entry.rotate),
            scaleX: pose.keys.map((entry) => entry.scaleX),
            scaleY: pose.keys.map((entry) => entry.scaleY),
        },
        times: pose.keys.map((entry) => entry.atMs / total),
        // One easing per gap between keys: the first key has none.
        ease: pose.keys.slice(1).map((entry) => entry.ease),
        durationS: pose.durationMs / 1000,
    };
}
