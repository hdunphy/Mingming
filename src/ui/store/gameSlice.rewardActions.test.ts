import { describe, it, expect } from 'vitest';
import gameReducer, { unlockSector, grantExperience, addToRoster } from './gameSlice';
import { createDefaultSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';
import { PlayerSaveSchema } from '../../engine/SaveSystem';

function makeMingming(id: string, level: number, experience: number): IMingmingState {
    return {
        id,
        definitionId: 'kraken',
        level,
        experience,
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

    describe('grantExperience', () => {
        it('adds experience without levelling below the next threshold', () => {
            // Lv5 sits at 100 XP; Lv6 needs 173.
            const state = gameReducer(
                saveWith(makeMingming('mm1', 5, getExpForLevel(5))),
                grantExperience({ mingmingId: 'mm1', amount: 72 })
            );

            expect(state.roster[0].experience).toBe(172);
            expect(state.roster[0].level).toBe(5);
        });

        it('levels up when experience exactly reaches the threshold', () => {
            const state = gameReducer(
                saveWith(makeMingming('mm1', 5, getExpForLevel(5))),
                grantExperience({ mingmingId: 'mm1', amount: 73 })
            );

            expect(state.roster[0].experience).toBe(173);
            expect(state.roster[0].level).toBe(6);
        });

        it('levels up across multiple thresholds on one large grant', () => {
            const state = gameReducer(
                saveWith(makeMingming('mm1', 1, 0)),
                grantExperience({ mingmingId: 'mm1', amount: 10000 })
            );

            // getExpForLevel(23) = 9734 <= 10000 < 11059 = getExpForLevel(24)
            expect(state.roster[0].level).toBe(23);
            // XP is cumulative in the battle path: levelling never spends it.
            expect(state.roster[0].experience).toBe(10000);
        });

        it('matches the battle path: one big grant equals the same XP in slices', () => {
            const oneShot = gameReducer(
                saveWith(makeMingming('mm1', 1, 0)),
                grantExperience({ mingmingId: 'mm1', amount: 10000 })
            );

            let sliced = saveWith(makeMingming('mm1', 1, 0));
            for (let i = 0; i < 100; i++) {
                sliced = gameReducer(sliced, grantExperience({ mingmingId: 'mm1', amount: 100 }));
            }

            expect(sliced.roster[0].level).toBe(oneShot.roster[0].level);
            expect(sliced.roster[0].experience).toBe(oneShot.roster[0].experience);
        });

        it('only touches the targeted roster instance', () => {
            let state = saveWith(makeMingming('mm1', 5, getExpForLevel(5)));
            state = gameReducer(state, addToRoster(makeMingming('mm2', 5, getExpForLevel(5))));

            state = gameReducer(state, grantExperience({ mingmingId: 'mm2', amount: 10000 }));

            expect(state.roster.find(m => m.id === 'mm1')!.level).toBe(5);
            expect(state.roster.find(m => m.id === 'mm1')!.experience).toBe(getExpForLevel(5));
            expect(state.roster.find(m => m.id === 'mm2')!.level).toBe(23);
        });

        it('ignores unknown ids and non-granting amounts', () => {
            const base = saveWith(makeMingming('mm1', 5, getExpForLevel(5)));

            expect(gameReducer(base, grantExperience({ mingmingId: 'nope', amount: 500 })).roster[0])
                .toEqual(base.roster[0]);
            expect(gameReducer(base, grantExperience({ mingmingId: 'mm1', amount: 0 })).roster[0])
                .toEqual(base.roster[0]);
            expect(gameReducer(base, grantExperience({ mingmingId: 'mm1', amount: -50 })).roster[0])
                .toEqual(base.roster[0]);
            expect(gameReducer(base, grantExperience({ mingmingId: 'mm1', amount: NaN })).roster[0])
                .toEqual(base.roster[0]);
        });

        it('keeps experience an integer for a fractional grant', () => {
            const state = gameReducer(
                saveWith(makeMingming('mm1', 5, getExpForLevel(5))),
                grantExperience({ mingmingId: 'mm1', amount: 10.7 })
            );

            expect(Number.isInteger(state.roster[0].experience)).toBe(true);
            expect(state.roster[0].experience).toBe(110);
        });

        it('leaves the save schema-valid after a multi-level grant', () => {
            const state = gameReducer(
                saveWith(makeMingming('mm1', 1, 0)),
                grantExperience({ mingmingId: 'mm1', amount: 10000 })
            );
            expect(() => PlayerSaveSchema.parse(state)).not.toThrow();
        });
    });
});
