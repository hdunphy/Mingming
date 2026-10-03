/**
 * TICKET 190b — a plan for one attack, built from a tier profile: the order and the length of the
 * beats. 190c plays them and 190d draws the middle. Pure data in, pure data out.
 *
 *   wind-up -> lunge -> travel -> hit-stop -> knockback -> return
 *
 * The travel is the head of the projectile plus the pour behind it (`headMs + sustainMs`). A contact
 * card has no travel: the attacker dashes the whole way in on a longer lunge and the hit lands at the
 * end of it. The hit lands the moment the travel (or the dash) ends, and the freeze starts there.
 */

import { CONTACT_LUNGE_FACTOR, type TierProfile, damageScale } from './tierProfiles';

export type AttackBeat = 'windup' | 'lunge' | 'travel' | 'hitstop' | 'knockback' | 'return';

export interface AttackSegment {
    readonly kind: AttackBeat;
    readonly startMs: number;
    readonly durationMs: number;
}

export interface AttackPlan {
    readonly segments: readonly AttackSegment[];
    readonly totalMs: number;
    /** When the hit lands: the end of the travel (or dash) and the start of the freeze. */
    readonly impactAtMs: number;
    /** The damage scale the plan was built at, 0..1. */
    readonly scale: number;
}

export interface AttackInputs {
    readonly damage: number;
    readonly maxHp: number;
    readonly isKill: boolean;
    /** A card that hits by touching: no travel, a longer lunge. */
    readonly contact: boolean;
    /** The freeze to use instead of the profile's (super-effective, resisted, several bodies). */
    readonly hitStopMs?: number;
}

const round = (n: number): number => Math.round(n);

export function planAttack(profile: TierProfile, input: AttackInputs): AttackPlan {
    const s = damageScale(input.damage, input.maxHp);
    const freeze = input.hitStopMs ?? (input.isKill ? profile.hitStopKillMs : profile.hitStopMs(s));

    const beats: Array<readonly [AttackBeat, number]> = [['windup', profile.windupMs(s)]];
    beats.push(['lunge', input.contact ? profile.lunge.ms * CONTACT_LUNGE_FACTOR : profile.lunge.ms]);
    if (!input.contact) beats.push(['travel', profile.headMs(s) + profile.sustainMs(s)]);
    beats.push(['hitstop', freeze], ['knockback', profile.knockbackMs], ['return', profile.returnMs]);

    const segments: AttackSegment[] = [];
    let at = 0;
    let impactAtMs = 0;
    for (const [kind, ms] of beats) {
        if (kind === 'hitstop') impactAtMs = at;
        const durationMs = round(ms);
        segments.push({ kind, startMs: at, durationMs });
        at += durationMs;
    }
    return { segments, totalMs: at, impactAtMs, scale: s };
}
