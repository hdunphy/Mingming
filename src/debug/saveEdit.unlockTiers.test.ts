/** TICKET 169d — the debug "Unlock all tiers" button opens tier 3 through the same dry-run guard as every edit. */

import { describe, expect, it, vi } from 'vitest';

import { unlockedTiers } from '../engine/run/tiers/tierUnlocks';
import { createEmptyRanch } from '../ui/store/gameSlice';
import { buildUnlockAllTiers, commitEdit, projectSave } from './saveEdit';

describe('buildUnlockAllTiers', () => {
    it('opens tiers 0 to 3 on a fresh ranch, by clearing 0, 1 and 2 on Emberfall', () => {
        const after = projectSave(createEmptyRanch(), buildUnlockAllTiers(createEmptyRanch()));
        expect(after.tierClears).toEqual({ gym_emberfall: [0, 1, 2] });
        expect(unlockedTiers(after)).toEqual([0, 1, 2, 3]);
    });

    it('only adds: existing clears on any gym survive', () => {
        const before = { ...createEmptyRanch(), tierClears: { gym_emberfall: [3], gym_rootfall: [1] } };
        const after = projectSave(before, buildUnlockAllTiers(before));
        expect(after.tierClears).toEqual({ gym_emberfall: [0, 1, 2, 3], gym_rootfall: [1] });
    });

    it('passes the schema dry run and dispatches', () => {
        const dispatch = vi.fn();
        const ranch = createEmptyRanch();
        const result = commitEdit(ranch, buildUnlockAllTiers(ranch), dispatch);
        expect(result.ok).toBe(true);
        expect(dispatch).toHaveBeenCalledTimes(1);
    });
});
