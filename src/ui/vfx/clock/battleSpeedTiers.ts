/**
 * THE FIVE BATTLE SPEEDS — ticket 190a. Slow · Showy · Snappy · Fast · Instant.
 *
 * Henry, 2026-10-02: *"a button toggle group [Slow] [Showy] [Snappy] [Fast] [Instant] with slow being
 * a more impactful slower 'Showy' and fast 2x Snappy"*, replacing 1x / 2x / 4x. Showy is the default.
 *
 * This file is only the list and the clock multiplier of each. HOW each tier looks (the timings of
 * the wind-up, the lunge, the pour, ...) is 190b's profile table; the clock never needs to know.
 * Slow, Showy and Snappy all run the clock at 1 because they differ in their own timings, not in
 * speed. Fast IS Snappy with the clock at 2, so the hits keep their shape. Instant is `Infinity`:
 * every wait and play resolves at once.
 */

import { INSTANT } from './instantSpeed';

export const BATTLE_SPEEDS = ['slow', 'showy', 'snappy', 'fast', 'instant'] as const;
export type BattleSpeedTier = (typeof BATTLE_SPEEDS)[number];

export const DEFAULT_BATTLE_SPEED: BattleSpeedTier = 'showy';

const MULTIPLIER: Readonly<Record<BattleSpeedTier, number>> = {
    slow: 1,
    showy: 1,
    snappy: 1,
    fast: 2,
    instant: INSTANT,
};

/** The battle clock's multiplier for a tier. */
export const tierMultiplier = (tier: BattleSpeedTier): number => MULTIPLIER[tier];

export const isInstantTier = (tier: BattleSpeedTier): boolean => tier === 'instant';
