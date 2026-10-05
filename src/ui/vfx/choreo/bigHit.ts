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

import type { AttackEffect } from '../attacks/AttackEffect';
import { drawGlowAt } from '../attacks/glow';
import type { ParticleSeed } from '../particles';
import type { TrackKey } from '../impact/Track';
import type { AttackPlan } from '../tiers/attackPlan';
import { damageScale } from '../tiers/tierProfiles';

/** The dark layer never goes past this opacity (at s = 1). */
export const DIM_PEAK = 0.4;
/** How far from the mouth a charging spark starts. */

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
    /** The wind-up: the charge runs for exactly this long. */
    readonly durationMs: number;
    /** The element's body colour, and the hot colour the motes are born in. */
    readonly color: { readonly r: number; readonly g: number; readonly b: number };
    readonly hot: { readonly r: number; readonly g: number; readonly b: number };
    readonly rng?: () => number;
}

/** Motes per game millisecond (the lab's `acc += g * 0.35`). */
export const CHARGE_MOTES_PER_MS = 0.35;

/**
 * TICKET 198b-4 — the lab's `chargeFx`, line for line: through the wind-up, 350 motes a second are
 * born on a ring 60-90 px round the mouth and fly straight into it over their 180-260 ms life, each
 * growing from 3 to 7 px as it cools from the hot colour to the element's; the mouth itself glows,
 * 10 px swelling to 36 by the end. (190g threw one batch of sparks on paths instead.)
 */
export function chargeEffect(input: ChargeInput): AttackEffect {
    const rng = input.rng ?? Math.random;
    const rand = (lo: number, hi: number): number => lo + rng() * (hi - lo);
    const ms = Math.max(1, input.durationMs);
    const { muzzle: o, color, hot } = input;
    let acc = 0;
    return {
        durationMs: ms,
        step(_age, dt, spawn) {
            acc += dt * CHARGE_MOTES_PER_MS;
            const seeds: ParticleSeed[] = [];
            while (acc >= 1) {
                acc -= 1;
                const a = rand(0, Math.PI * 2);
                const r = rand(60, 90);
                const life = rand(180, 260);
                seeds.push({
                    x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r,
                    vx: (-Math.cos(a) * r) / life * 1000, vy: (-Math.sin(a) * r) / life * 1000,
                    life, size: 3, size2: 7,
                    r: hot.r, g: hot.g, b: hot.b, r2: color.r, g2: color.g, b2: color.b,
                    shape: 'glow',
                });
            }
            if (seeds.length) spawn(seeds);
        },
        draw(ctx, age) {
            drawGlowAt(ctx, o.x, o.y, 10 + 26 * (age / ms), [color.r, color.g, color.b], 0.8);
        },
    };
}
