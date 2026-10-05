/**
 * TICKET 190b — THE TIER PROFILES. One table of every timing and strength that changes between the
 * battle speeds, read by the clock-side code (hit-stop, shake) and by the choreography (190c on).
 *
 * The numbers are Henry's rulings of 2026-10-02 on the Battle Juice Lab. There are three columns,
 * not five: Slow, Showy and Snappy each have their own; Fast reads Snappy (the clock runs it at x2,
 * so the hits keep their shape) and Instant reads Snappy too (the clock resolves everything at once,
 * so the profile is never seen). `profileFor(tier)` is the one place that mapping lives.
 *
 * Almost everything is a number that grows with `s`, the damage scale in 0..1 (`damageScale`), so a
 * chip is quick and a 45-in-100 hit is the full show. Slow is DERIVED from Showy (a heavier Showy),
 * so the two cannot drift apart when Showy is tuned.
 */

import type { BattleSpeedTier } from '../clock/battleSpeedTiers';

export const PROFILE_KEYS = ['slow', 'showy', 'snappy'] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];

/**
 * Share of max HP that reads as a full-strength hit. TICKET 194k-1: this was 0.45, set against the
 * Battle Juice Lab's 100-HP units (where a "Solid 22" is s = 0.70). The game's units have
 * 1,100-1,350 HP and Henry's 10-04 logs have a median hit of 50 (4%), so at 0.45 the median hit was
 * s = 0.31 and every effect sat at the bottom of its range. At 0.15 the median hit is s = 0.54, the
 * 75th percentile (103) is 0.77 and the 90th (214) is 1.0: where the lab's Chip and Solid sit.
 */
export const FULL_HIT_FRACTION = 0.15;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** `s = clamp(sqrt((damage / maxHp) / 0.15), 0, 1)` — the square root keeps a chip felt. */
export function damageScale(damage: number, maxHp: number): number {
    if (!(maxHp > 0) || !(damage > 0)) return 0;
    return clamp01(Math.sqrt(damage / maxHp / FULL_HIT_FRACTION));
}

/** A number that goes from `atZero` (a chip) to `atFull` (a full-strength hit) as `s` goes 0 to 1. */
export type Curve = (s: number) => number;

const between =
    (atZero: number, atFull: number): Curve =>
    (s) =>
        atZero + (atFull - atZero) * clamp01(s);

const scaled =
    (curve: Curve, factor: number): Curve =>
    (s) =>
        curve(s) * factor;

export interface TierProfile {
    /** The crouch before the lunge. */
    readonly windupMs: Curve;
    /** The hop forward. `px` is how far; a contact card's dash is a longer lunge (`CONTACT_LUNGE_FACTOR`). */
    readonly lunge: { readonly ms: number; readonly px: number };
    /** How long the head of the projectile / beam takes to reach the target. */
    readonly headMs: Curve;
    /** How long the beam or stream keeps pouring after the head lands. Travel = head + sustain. */
    readonly sustainMs: Curve;
    /** Real-ms freeze at the hit, before the clock shrinks it for speed. */
    readonly hitStopMs: Curve;
    readonly hitStopKillMs: number;
    readonly knockbackMs: number;
    /** The attacker walking back to its place. */
    readonly returnMs: number;
    /** A card that deals no damage: the wiggle, the orb's flight and how long the landing lasts. */
    readonly statusOnly: { readonly wiggleMs: number; readonly orbMs: number; readonly landingMs: number };
    readonly cardInMs: number;
    readonly cardOutMs: number;
    /** How long the enemy's card hovers on screen before it plays. */
    readonly enemyHoverMs: number;
    /**
     * A hit under this damage scale `s` shakes the target and nothing else. TICKET 194k-2: every
     * big-hit threshold below is a number on `s`, as the lab has it, NOT a share of max HP. 190
     * converted them to shares and, on 1,100-HP bodies, that left the dim and the charge-up for
     * about 1% of hits.
     */
    readonly cameraShakeFrom: number;
    /** Camera trauma a hit adds (0..1). */
    readonly trauma: Curve;
    /** How far the target sprite shakes after the freeze. */
    readonly targetShakePx: Curve;
    /** Multiplies how many particles every burst throws. */
    readonly particleScale: number;
    /** The stage dims for a hit whose damage scale `s` is at or over this; null never dims. */
    readonly dimFrom: number | null;
    /** The attacker charges up for a hit whose damage scale `s` is at or over this; null never charges. */
    readonly chargeFrom: number | null;
    /** Fraction the stage zooms in on a big hit; 0 is none. */
    readonly cameraPunch: number;
    readonly damageNumberPx: Curve;
}

/** A contact card dashes in on a lunge this many times longer than a ranged card's hop. */
export const CONTACT_LUNGE_FACTOR = 1.6;

const SHOWY: TierProfile = {
    windupMs: between(120, 220),
    lunge: { ms: 150, px: 54 },
    headMs: between(180, 260),
    sustainMs: between(120, 600),
    hitStopMs: between(60, 140),
    hitStopKillMs: 170,
    knockbackMs: 170,
    returnMs: 200,
    statusOnly: { wiggleMs: 300, orbMs: 320, landingMs: 520 },
    cardInMs: 180,
    cardOutMs: 160,
    enemyHoverMs: 1000,
    // The lab's 12% of a 100-HP body, as s: sqrt(0.12 / 0.45) = 0.52 (about 4% of max HP on the game's curve).
    cameraShakeFrom: 0.52,
    trauma: between(0.3, 0.85),
    targetShakePx: between(4, 11),
    particleScale: 1.3,
    dimFrom: 0.6,
    chargeFrom: 0.5,
    cameraPunch: 0.03,
    damageNumberPx: between(30, 60),
};

const SNAPPY: TierProfile = {
    windupMs: () => 50,
    lunge: { ms: 100, px: 34 },
    headMs: between(120, 180),
    sustainMs: between(20, 200),
    hitStopMs: between(40, 110),
    hitStopKillMs: 140,
    knockbackMs: 110,
    returnMs: 130,
    statusOnly: { wiggleMs: 200, orbMs: 220, landingMs: 340 },
    cardInMs: 150,
    cardOutMs: 140,
    enemyHoverMs: 1000,
    cameraShakeFrom: 0.67,   // the lab's 20%: sqrt(0.2 / 0.45)
    trauma: between(0.25, 0.7),
    targetShakePx: between(3, 8),
    particleScale: 0.85,
    dimFrom: null,
    chargeFrom: null,
    cameraPunch: 0,
    damageNumberPx: between(26, 48),
};

/** Slow: Showy with a heavier hand. 1.3 x the wind-up, head and pour; 1.25 x the freeze; a bit more shake. */
const SLOW: TierProfile = {
    ...SHOWY,
    windupMs: scaled(SHOWY.windupMs, 1.3),
    lunge: { ms: 190, px: 62 },
    headMs: scaled(SHOWY.headMs, 1.3),
    sustainMs: scaled(SHOWY.sustainMs, 1.3),
    hitStopMs: scaled(SHOWY.hitStopMs, 1.25),
    hitStopKillMs: 210,
    knockbackMs: 220,
    returnMs: 250,
    statusOnly: { wiggleMs: 380, orbMs: 400, landingMs: 650 },
    cardInMs: 220,
    cardOutMs: 200,
    cameraShakeFrom: 0.42,   // the lab's 8%: sqrt(0.08 / 0.45)
    trauma: (s) => Math.min(1, SHOWY.trauma(s) + 0.1),
    targetShakePx: between(5, 13),
    particleScale: 1.5,
    dimFrom: 0.35,
    chargeFrom: 0.3,
    cameraPunch: 0.045,
    damageNumberPx: between(34, 66),
};

export const TIER_PROFILES: Readonly<Record<ProfileKey, TierProfile>> = { slow: SLOW, showy: SHOWY, snappy: SNAPPY };

const KEY_OF: Readonly<Record<BattleSpeedTier, ProfileKey>> = {
    slow: 'slow',
    showy: 'showy',
    snappy: 'snappy',
    fast: 'snappy',
    instant: 'snappy',
};

export const profileKeyFor = (tier: BattleSpeedTier): ProfileKey => KEY_OF[tier];
export const profileFor = (tier: BattleSpeedTier): TierProfile => TIER_PROFILES[KEY_OF[tier]];
