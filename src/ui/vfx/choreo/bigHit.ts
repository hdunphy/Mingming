/**
 * TICKET 190g - THE BIG-HIT EXTRAS, as pure pieces: which hits are big, how the stage dims across a
 * cast, and the sparks that charge into the caster's mouth during the wind-up.
 *
 * "Big" is the hit's damage scale `s` against the tier's thresholds (`dimFrom`, `chargeFrom`), as the
 * Battle Juice Lab has it (TICKET 194k-2): Showy dims from s 0.6 and charges from 0.5, Slow from 0.35
 * and 0.3, Snappy (and Fast, which reads it) never does. 190 had turned these into shares of max HP,
 * which on 1,100-HP bodies reached about 1% of hits; on `s` a median hit (s 0.54) charges up and a
 * 4% hit dims on Slow.
 */

import { randomIn, inQuad, lerp } from '../attacks/curves';
import type { ParticleSeed } from '../particles';
import type { TrackKey } from '../impact/Track';
import type { AttackPlan } from '../tiers/attackPlan';
import { damageScale } from '../tiers/tierProfiles';

/** The dark layer never goes past this opacity (at s = 1). */
export const DIM_PEAK = 0.4;
/** How far from the mouth a charging spark starts. */
const SPARK_START_MIN_PX = 60;
const SPARK_START_MAX_PX = 110;

/** `s` for a hit: the same number the pour, the shake and the freeze grow on. */
export const hitScale = (damage: number, maxHp: number): number => damageScale(damage, maxHp);

export const isBigHit = (s: number, threshold: number | null): boolean => threshold !== null && s >= threshold;

/** The dim across a cast: up across the wind-up, held to the impact, released on the knock-back. */
export function dimKeys(game: Pick<AttackPlan['game'], 'windupEndMs' | 'impactMs' | 'knockbackEndMs'>, s: number): TrackKey[] {
    const peak = DIM_PEAK * Math.max(0, Math.min(1, s));
    const up = Math.max(1, game.windupEndMs);
    const hold = Math.max(up, game.impactMs);
    const down = Math.max(hold + 1, game.knockbackEndMs);
    return [
        { atMs: 0, value: 0 },
        { atMs: up, value: peak, ease: 'easeOut' },
        { atMs: hold, value: peak },
        { atMs: down, value: 0, ease: 'easeOut' },
    ];
}

export interface ChargeInput {
    /** Where the mouth is, in stage-box coordinates. */
    readonly muzzle: { readonly x: number; readonly y: number };
    /** The wind-up: the sparks arrive as it ends. */
    readonly durationMs: number;
    readonly s: number;
    readonly particleScale: number;
    readonly color: { readonly r: number; readonly g: number; readonly b: number };
    readonly rng?: () => number;
}

export function chargeSparks(input: ChargeInput): ParticleSeed[] {
    const rand = randomIn(input.rng ?? Math.random);
    const count = Math.max(1, Math.round((8 + 10 * input.s) * input.particleScale));
    const life = Math.max(120, Math.round(input.durationMs));
    const seeds: ParticleSeed[] = [];
    for (let i = 0; i < count; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const radius = rand(SPARK_START_MIN_PX, SPARK_START_MAX_PX);
        const start = { x: input.muzzle.x + Math.cos(angle) * radius, y: input.muzzle.y + Math.sin(angle) * radius };
        seeds.push({
            x: start.x, y: start.y, vx: 0, vy: 0, life, size: rand(2.6, 3.8),
            r: 255, g: 250, b: 225, r2: input.color.r, g2: input.color.g, b2: input.color.b,
            a: 1, shape: 'spark',
            path: (t) => {
                const u = inQuad(Math.min(1, Math.max(0, t)));
                return { x: lerp(start.x, input.muzzle.x, u), y: lerp(start.y, input.muzzle.y, u) };
            },
        });
    }
    return seeds;
}
