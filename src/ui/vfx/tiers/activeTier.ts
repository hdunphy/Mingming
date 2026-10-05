/**
 * TICKET 190b — WHICH TIER IS ON. The settings screen says it once (`applySettings`); the hit-stop,
 * the shake and the choreography read it here. Showy until told otherwise, so a test that never
 * touches settings sees the numbers ticket 189 pinned.
 */

import { DEFAULT_BATTLE_SPEED, type BattleSpeedTier } from '../clock/battleSpeedTiers';
import { profileFor, type TierProfile } from './tierProfiles';

let tier: BattleSpeedTier = DEFAULT_BATTLE_SPEED;

export function setActiveTier(next: BattleSpeedTier): void {
    tier = next;
}

export const activeTier = (): BattleSpeedTier => tier;

export const activeProfile = (): TierProfile => profileFor(tier);

export function resetActiveTier(): void {
    tier = DEFAULT_BATTLE_SPEED;
}
