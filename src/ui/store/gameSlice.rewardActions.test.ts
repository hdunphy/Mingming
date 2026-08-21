import { describe, it, expect } from 'vitest';
import gameReducer, { unlockSector, addToRoster } from './gameSlice';
import { createDefaultSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';
import { PlayerSaveSchema } from '../../engine/SaveSystem';

function makeMingming(id: string): IMingmingState {
    return {
        id,
        definitionId: 'kraken',
        attackIV: 10,
        defenseIV: 10,
        hpIV: 10,
        blueprintsCollected: 0
    };
}

function saveWith(mm: IMingmingState) {
    return gameReducer(createDefaultSave(), addToRoster(mm));
}

describe('gameSlice reward actions', () => {
    describe('unlockSector', () => {
        it('appends a sector that is not yet unlocked', () => {
            const initial = createDefaultSave();
            expect(initial.unlockedSectors).not.toContain('Electric');

            const state = gameReducer(initial, unlockSector('Electric'));

            expect(state.unlockedSectors).toContain('Electric');
            expect(state.unlockedSectors).toHaveLength(initial.unlockedSectors.length + 1);
        });

        it('is a no-op when the sector is already unlocked', () => {
            const initial = createDefaultSave();
            expect(initial.unlockedSectors).toContain('Fire');

            const state = gameReducer(initial, unlockSector('Fire'));

            expect(state.unlockedSectors).toEqual(initial.unlockedSectors);
            expect(state.unlockedSectors.filter(s => s === 'Fire')).toHaveLength(1);
        });

        it('is still a no-op when the sector was unlocked by a previous dispatch', () => {
            let state = gameReducer(createDefaultSave(), unlockSector('Electric'));
            const afterFirst = state.unlockedSectors;

            state = gameReducer(state, unlockSector('Electric'));

            expect(state.unlockedSectors).toEqual(afterFirst);
        });

        it('leaves the save schema-valid', () => {
            const state = gameReducer(createDefaultSave(), unlockSector('Electric'));
            expect(() => PlayerSaveSchema.parse(state)).not.toThrow();
        });
    });

});
