/**
 * TICKET 190c — WHEN EACH THING OF A CAST HAPPENS, as game milliseconds from the start of its beat.
 *
 *   ranged   card in + wind-up -> lunge -> (element leaves) -> travel -> HIT -> knock-back -> walk back + card out
 *   contact  card in + wind-up -> dash -> HIT -> knock-back -> walk back + card out
 *   status   card in + wiggle -> (orb leaves) -> orb flies -> LANDS -> landing -> card out
 *
 * The player's card flies in DURING the wind-up. The enemy's arrives first and hovers a second
 * (`enemyHoverMs`), and only then does its attack begin. The freeze is not here: it is real time,
 * the clock stops for it, and every offset below simply waits.
 */

import { planAttack, planStatusOnly, type AttackPlan, type StatusPlan } from '../tiers/attackPlan';
import type { TierProfile } from '../tiers/tierProfiles';

export type CastKind = 'attack' | 'contact' | 'status';

export interface CastTimesInput {
    readonly kind: CastKind;
    readonly fromPlayer: boolean;
    /** The biggest hit of the cast, which sets how long the effect runs. */
    readonly damage: number;
    readonly maxHp: number;
    readonly isKill: boolean;
}

export interface CastTimes {
    readonly cardInAtMs: number;
    /** The wind-up (or the wiggle) starts. */
    readonly poseAtMs: number;
    /** The element (or the orb) leaves the caster; a contact card's dash starts when its wind-up ends. */
    readonly launchAtMs: number;
    /** How long the element is in the air. 0 for a contact card and for an orb (the orb has its own). */
    readonly travelMs: number;
    /** The hit lands (or the orb arrives). */
    readonly impactAtMs: number;
    /** The attacker starts walking back, and the card leaves. */
    readonly returnAtMs: number;
    readonly cardOutAtMs: number;
    /** The attacker is home / the landing is over. */
    readonly endAtMs: number;
    /** The beat is over: the card has gone as well. */
    readonly beatEndMs: number;
    /** The plan the times came from: the attacker's pose is built from the same one. */
    readonly attackPlan?: AttackPlan;
    readonly statusPlan?: StatusPlan;
}

export function castTimes(profile: TierProfile, input: CastTimesInput): CastTimes {
    const poseAtMs = input.fromPlayer ? 0 : profile.cardInMs + profile.enemyHoverMs;

    if (input.kind === 'status') {
        const plan = planStatusOnly(profile);
        const wiggle = plan.segments[0].durationMs;
        const end = poseAtMs + plan.totalMs;
        return {
            cardInAtMs: 0,
            poseAtMs,
            launchAtMs: poseAtMs + wiggle,
            travelMs: 0,
            impactAtMs: poseAtMs + plan.landsAtMs,
            returnAtMs: end,
            cardOutAtMs: end,
            endAtMs: end,
            beatEndMs: end + profile.cardOutMs,
            statusPlan: plan,
        };
    }

    const plan = planAttack(profile, {
        damage: input.damage, maxHp: input.maxHp, isKill: input.isKill, contact: input.kind === 'contact',
    });
    const contact = input.kind === 'contact';
    const launchAtMs = poseAtMs + (contact ? plan.game.windupEndMs : plan.game.lungeEndMs);
    const impactAtMs = poseAtMs + plan.game.impactMs;
    const returnAtMs = poseAtMs + plan.game.knockbackEndMs;
    const endAtMs = poseAtMs + plan.game.endMs;
    return {
        cardInAtMs: 0,
        poseAtMs,
        launchAtMs,
        travelMs: contact ? 0 : impactAtMs - launchAtMs,
        impactAtMs,
        returnAtMs,
        cardOutAtMs: returnAtMs,
        endAtMs,
        beatEndMs: Math.max(endAtMs, returnAtMs + profile.cardOutMs),
        attackPlan: plan,
    };
}
