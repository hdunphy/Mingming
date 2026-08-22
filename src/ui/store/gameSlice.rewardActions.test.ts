/**
 * What a won fight writes into the RANCH — ticket 11.
 *
 * This file used to test `unlockSector`, the reducer a Gym clear called to append an element to
 * `unlockedSectors`. Both are gone. The successor field is `gymsCleared`, and it is a narrower
 * claim: "leaders you have beaten", not "places you may go" — so the successor reducer is
 * `markGymCleared`, keyed by gym id rather than by element, plus `recordTierCleared` for the tier
 * high-water mark that `IRanchState` also carries and `unlockedSectors` had no equivalent of.
 *
 * The rest of the reward pipeline left the ranch entirely. `applyRewardBundle` wrote scrap, cards
 * and blueprints in one reducer; only blueprints are persistent, so `BattleArena` now dispatches
 * `addBlueprint` per dropped species into the ranch and `addRunScrap` / `addRunCards` / `addDriver`
 * into the run. The scrap-and-cards half of those assertions lives in `runSlice.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import gameReducer, { addBlueprint, markGymCleared, recordTierCleared, createEmptyRanch } from './gameSlice';
import { RanchStateSchema } from '../../engine/runTypes';

describe('gameSlice reward actions', () => {
    describe('markGymCleared', () => {
        it('appends a gym that has not been cleared yet', () => {
            const initial = createEmptyRanch();
            expect(initial.gymsCleared).not.toContain('gym_emberfall');

            const state = gameReducer(initial, markGymCleared('gym_emberfall'));

            expect(state.gymsCleared).toContain('gym_emberfall');
            expect(state.gymsCleared).toHaveLength(1);
        });

        it('is a no-op when the gym is already cleared', () => {
            const first = gameReducer(createEmptyRanch(), markGymCleared('gym_tidewrack'));

            const second = gameReducer(first, markGymCleared('gym_tidewrack'));

            expect(second.gymsCleared).toEqual(first.gymsCleared);
            expect(second.gymsCleared.filter((g) => g === 'gym_tidewrack')).toHaveLength(1);
        });

        it('leaves the ranch schema-valid', () => {
            const state = gameReducer(createEmptyRanch(), markGymCleared('gym_rootfall'));
            expect(() => RanchStateSchema.parse(state)).not.toThrow();
        });
    });

    describe('recordTierCleared', () => {
        it('leaves the ranch schema-valid', () => {
            const state = gameReducer(createEmptyRanch(), recordTierCleared(2));
            expect(state.highestTierCleared).toBe(2);
            expect(() => RanchStateSchema.parse(state)).not.toThrow();
        });
    });

    describe('blueprints — the only reward the ranch keeps', () => {
        it('takes one dispatch per dropped species, and a repeat drop stacks', () => {
            // The bundle's `blueprints` is a list of species ids in which duplicates are
            // meaningful, so `BattleArena` dispatches once per entry rather than once per species.
            let state = createEmptyRanch();
            for (const speciesId of ['arch_fire', 'arch_fire', 'arch_water']) {
                state = gameReducer(state, addBlueprint(speciesId));
            }
            expect(state.blueprints).toEqual({ arch_fire: 2, arch_water: 1 });
            expect(() => RanchStateSchema.parse(state)).not.toThrow();
        });
    });
});
