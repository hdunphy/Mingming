/**
 * TICKET 169d — what a ranch's clears unlock: tiers, the modifier row, and the per-gym achievement.
 *
 * Henry's rulings (2026-09-29): beating any gym at tier N unlocks tier N+1 for EVERY gym, tier 0 is
 * always open and the top tier is `MAX_TIER`. Modifiers unlock after the first gym clear (D2).
 * Everything here is a pure read of `IRanchState`; nothing is stored beyond `tierClears`.
 */

import type { IRanchState } from '../../runTypes';
import { MAX_TIER } from './tierRegistry';

type ClearRecord = Pick<IRanchState, 'gymsCleared' | 'tierClears'>;

/**
 * Each gym's cleared tiers, ascending. `tierClears` is the record; a gym listed in `gymsCleared`
 * with no entry there (a save from before 169d) counts as a tier-0 clear, which is what it was.
 * There is no migration code: the old field is simply read as what it always meant.
 */
export function clearsByGym(ranch: ClearRecord): Record<string, number[]> {
    const clears: Record<string, number[]> = {};
    for (const [gymId, tiers] of Object.entries(ranch.tierClears ?? {})) {
        clears[gymId] = [...tiers].sort((a, b) => a - b);
    }
    for (const gymId of ranch.gymsCleared) {
        if (clears[gymId] === undefined) clears[gymId] = [0];
    }
    return clears;
}

/** The highest tier cleared on any gym, or -1 when nothing has been cleared anywhere. */
function highestClear(ranch: ClearRecord): number {
    let highest = -1;
    for (const tiers of Object.values(clearsByGym(ranch))) {
        for (const tier of tiers) highest = Math.max(highest, tier);
    }
    return highest;
}

/** The tiers a run may be started at: `[0]` on a fresh ranch, else `0..min(MAX_TIER, highest clear + 1)`. */
export function unlockedTiers(ranch: ClearRecord): number[] {
    const top = highestClear(ranch) < 0 ? 0 : Math.min(MAX_TIER, highestClear(ranch) + 1);
    return Array.from({ length: top + 1 }, (_, tier) => tier);
}

/**
 * Whether `gymId` has been cleared at tiers 1, 2 and 3 — the achievement's condition. The three must
 * be on the SAME gym; clears spread over different gyms do not count. Steam wiring is ticket 43.
 */
export function gymMastered(ranch: ClearRecord, gymId: string): boolean {
    const cleared = clearsByGym(ranch)[gymId] ?? [];
    return [1, 2, 3].every((tier) => cleared.includes(tier));
}

/** Modifiers unlock after the first gym clear, any gym at any tier (default D2). */
export function modifiersUnlocked(ranch: ClearRecord): boolean {
    return highestClear(ranch) >= 0;
}
