/**
 * HOW HARD A HIT LANDS — ticket 189d. The numbers behind the hit-stop, the vibration and both
 * shakes, as pure functions of the hit. The constants below are Showy's (the default tier); since
 * ticket 190b the functions read the ACTIVE tier's profile (`tiers/tierProfiles.ts`), so Slow and
 * Snappy hit differently, and Showy gives exactly the numbers these constants name.
 *
 * Everything runs off one number, `severity` (0..1): the share of the target's max HP the hit took,
 * on a square-root curve so a chip is still felt and a heavy hit does not need half the bar:
 * `s = clamp(sqrt((damage / maxHp) / FULL_HIT_FRACTION), 0, 1)` (0.15 since 194k-1). The curve replaces 146e's linear one (30 + 80 *
 * clamp((frac - 0.05) / 0.30)), whose floor sat at 30 ms and whose ceiling was met at 35%.
 */

import { activeProfile } from '../tiers/activeTier';
import { FULL_HIT_FRACTION } from '../tiers/tierProfiles';

/**
 * Damage share that reads as a full-strength hit (severity 1). TICKET 194k-1: the same number as
 * the damage scale `s` (`FULL_HIT_FRACTION`), imported rather than repeated, so the freeze, the
 * vibration and the shake grow with the same curve as the pour and the particle counts. It was a
 * second 0.45 beside the first, and re-tuning one for 1,100-HP bodies would have left the other
 * pinned to the lab's 100-HP ones.
 */
export const SEVERITY_FULL_FRACTION = FULL_HIT_FRACTION;

export const HIT_STOP_BASE_MS = 60;
export const HIT_STOP_SPAN_MS = 80;
export const HIT_STOP_KILL_MS = 170;
export const HIT_STOP_SUPER_BONUS_MS = 20;
export const HIT_STOP_RESISTED_SCALE = 0.6;
export const HIT_STOP_MULTI_TARGET_SCALE = 0.6;

/** Above this multiplier a hit is super-effective; below its reciprocal-ish line, resisted. */
export const SUPER_EFFECTIVE_AT = 1.2;
export const RESISTED_AT = 0.85;

/** The shake setting (ruled 2026-10-02: "60% is good"). Ticket 190a makes it a slider. */
export const SHAKE_SETTING = 0.6;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function damageSeverity(applied: number, maxHp: number): number {
    if (!(maxHp > 0) || !(applied > 0)) return 0;
    return clamp01(Math.sqrt(applied / maxHp / SEVERITY_FULL_FRACTION));
}

export interface HitStopInputs {
    readonly severity: number;
    readonly isKill: boolean;
    readonly superEffective: boolean;
    readonly resisted: boolean;
    /** Bodies the card hit. More than one scales every hit's freeze down, so a Side card is not a wall of stops. */
    readonly targets: number;
}

/** Real milliseconds of freeze, before the clock shrinks it for speed (`freezeLengthMs`). */
export function hitStopLengthMs(input: HitStopInputs): number {
    const profile = activeProfile();
    let ms = input.isKill ? profile.hitStopKillMs : profile.hitStopMs(input.severity);
    if (input.superEffective) ms += HIT_STOP_SUPER_BONUS_MS;
    if (input.resisted) ms *= HIT_STOP_RESISTED_SCALE;
    if (input.targets > 1) ms *= HIT_STOP_MULTI_TARGET_SCALE;
    return Math.round(ms);
}

/** How far the target and the attacker shudder during the freeze, in px. */
export const vibratePx = (severity: number): number => 2 + 4 * clamp01(severity);

/** How far the target sprite shakes after the freeze, in px. */
export const targetShakePx = (severity: number): number => activeProfile().targetShakePx(severity);

export interface CameraHit {
    readonly applied: number;
    readonly maxHp: number;
    readonly isKill: boolean;
    readonly resisted: boolean;
}

/** Does this hit shake the camera? Small hits do not; a resisted hit never does; a kill always does. */
export function addsCameraTrauma(hit: CameraHit): boolean {
    if (hit.resisted) return false;
    if (hit.isKill) return true;
    // 194k-2: on the damage scale `s` (the lab's 12% of a 100-HP body is s 0.52), not a share of max HP.
    return damageSeverity(hit.applied, hit.maxHp) >= activeProfile().cameraShakeFrom;
}

/** Trauma a hit adds: the tier's curve (Showy `0.3 + 0.55 s`), and 0.25 more on a kill. */
export function cameraTraumaFor(severity: number, isKill: boolean): number {
    return Math.min(1, activeProfile().trauma(severity) + (isKill ? 0.25 : 0));
}
