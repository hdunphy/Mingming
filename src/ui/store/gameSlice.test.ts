/**
 * The ranch slice, reducer by reducer — ticket 11.
 *
 * WHAT LEFT THIS FILE AND WHERE IT WENT. `state.game` is `IRanchState` now, so the suites that used
 * to live here for `cardInventory`, `activeDeck`, `addCardsToDeck`, `clearDeck` and the scrap
 * economy have no subject on this slice any more. The ones with a run-side successor were **moved
 * rather than deleted** — the scrap and card assertions are in `runSlice.test.ts` against
 * `addRunScrap` / `spendRunScrap` / `addRunCards` / `removeRunCard`, and the species-clause
 * assertions are in `engine/party.test.ts` against the rule itself. The deck-builder suites
 * (`setActiveDeck`, `addCardToDeck`, `DECK_SIZE`) have no successor at all: a run deck is built by
 * `createRun` and grown by rewards, and nothing composes one card at a time from an inventory.
 */

import { describe, it, expect } from 'vitest';
import gameReducer, {
    addToRoster,
    removeFromRoster,
    addBlueprint,
    markGymCleared,
    recordTierCleared,
    loadSave,
    resetSave,
    createEmptyRanch,
} from './gameSlice';
import type { IRanchMember, IRanchState } from '../../engine/runTypes';

function makeMingming(id: string, definitionId: string = 'def_fire'): IRanchMember {
    return { id, definitionId, activeOS: `${definitionId}_v1`, attackIV: 5, defenseIV: 5, hpIV: 5 };
}

describe('gameSlice', () => {
    const initial = createEmptyRanch();

    // --- Roster ---
    describe('roster', () => {
        it('adds a MingMing to the roster', () => {
            const mm = makeMingming('mm1');
            const state = gameReducer(initial, addToRoster(mm));
            expect(state.roster).toHaveLength(1);
            expect(state.roster[0].id).toBe('mm1');
        });

        it('removes a MingMing from the roster', () => {
            let state = gameReducer(initial, addToRoster(makeMingming('mm1')));
            state = gameReducer(state, addToRoster(makeMingming('mm2')));
            state = gameReducer(state, removeFromRoster('mm1'));
            expect(state.roster).toHaveLength(1);
            expect(state.roster[0].id).toBe('mm2');
        });

        it('grants no cards — ticket 11 deleted the base-deck grant outright', () => {
            // `addToRoster` used to push the species' whole starting kit into `cardInventory` and
            // record a `deckGrantKey`. Both fields are gone: cards are run-scoped, and ticket 08's
            // `startKit` tags hand out the opening deck at run start. The assertion that survives
            // is that a roster addition touches the roster and nothing else.
            const state = gameReducer(initial, addToRoster(makeMingming('mm1', 'fenrir')));
            expect(state).toEqual({ ...initial, roster: [makeMingming('mm1', 'fenrir')] });
        });

        it('an unknown definitionId is added anyway and does not crash', () => {
            // A species id the registry does not know is a renamed or unshipped species, not a
            // corrupt member. Losing the individual would be worse than carrying it.
            const state = gameReducer(initial, addToRoster(makeMingming('mm1', 'not_a_species')));
            expect(state.roster).toHaveLength(1);
        });
    });

    // --- Blueprints ---
    describe('blueprints', () => {
        it('adds a blueprint as a count of one', () => {
            const state = gameReducer(initial, addBlueprint('arch_fire'));
            expect(state.blueprints).toEqual({ arch_fire: 1 });
        });

        it('stacks a second blueprint of the same species instead of rejecting it', () => {
            // Ticket 20 inverted this: v3 refused the duplicate, because a blueprint was a
            // permanent "you may build this" permission you could only hold one of. Blueprints
            // are consumable currency now — one is spent per assembly and per OS reflash — so a
            // second one is a second assembly, not a no-op.
            let state = gameReducer(initial, addBlueprint('arch_fire'));
            state = gameReducer(state, addBlueprint('arch_fire'));
            expect(state.blueprints).toEqual({ arch_fire: 2 });
        });

        it('counts each species separately', () => {
            let state = gameReducer(initial, addBlueprint('arch_fire'));
            state = gameReducer(state, addBlueprint('arch_water'));
            state = gameReducer(state, addBlueprint('arch_fire'));
            expect(state.blueprints).toEqual({ arch_fire: 2, arch_water: 1 });
        });
    });

    // --- Gym and tier progress (ticket 11) ---
    //
    // These replace `unlockSector`. The old field said "places you may go" and was seeded with
    // three defaults; `gymsCleared` says "leaders you beat", which is a strictly narrower claim —
    // hence no defaults, and hence the idempotence test below matters more than it did.
    describe('markGymCleared', () => {
        it('records a clear', () => {
            const state = gameReducer(initial, markGymCleared('gym_emberfall'));
            expect(state.gymsCleared).toEqual(['gym_emberfall']);
        });

        it('is a no-op the second time the same gym is beaten', () => {
            let state = gameReducer(initial, markGymCleared('gym_emberfall'));
            state = gameReducer(state, markGymCleared('gym_emberfall'));
            expect(state.gymsCleared).toEqual(['gym_emberfall']);
        });

        it('a new player has cleared nothing', () => {
            // v3 seeded `unlockedSectors` with Fire/Water/Nature. Carrying that over would have
            // claimed three gym clears that never happened, and run start reads this list.
            expect(createEmptyRanch().gymsCleared).toEqual([]);
        });
    });

    describe('recordTierCleared', () => {
        it('raises the high-water mark', () => {
            const state = gameReducer(initial, recordTierCleared(2));
            expect(state.highestTierCleared).toBe(2);
        });

        it('never lowers it — a tier-0 clear after a tier-2 one is not a demotion', () => {
            let state = gameReducer(initial, recordTierCleared(2));
            state = gameReducer(state, recordTierCleared(0));
            expect(state.highestTierCleared).toBe(2);
        });

        it('refuses a negative or fractional tier rather than writing an unsavable ranch', () => {
            // `RanchStateSchema` types this as a non-negative int; writing anything else would
            // wedge the very next autosave.
            let state = gameReducer(initial, recordTierCleared(-1));
            expect(state.highestTierCleared).toBe(0);
            state = gameReducer(state, recordTierCleared(1.5));
            expect(state.highestTierCleared).toBe(0);
        });
    });

    // --- Save/Load ---
    describe('save/load', () => {
        it('loads a ranch verbatim', () => {
            // Ticket 11: no projection, no merge. What `loadGameState` returns is what the slice
            // becomes, which is the whole reason `ranchProjection.ts` could be deleted.
            const ranch: IRanchState = {
                roster: [makeMingming('mm1', 'kraken')],
                blueprints: { kraken: 3 },
                codex: { seen: ['fire_poke'], played: ['fire_poke'] },
                gymsCleared: ['gym_emberfall'],
                highestTierCleared: 1,
            };
            const state = gameReducer(initial, loadSave(ranch));
            expect(state).toEqual(ranch);
        });

        it('resets to an empty ranch', () => {
            let state = gameReducer(initial, addBlueprint('kraken'));
            state = gameReducer(state, addToRoster(makeMingming('mm1')));
            state = gameReducer(state, markGymCleared('gym_emberfall'));
            state = gameReducer(state, resetSave());
            expect(state).toEqual(createEmptyRanch());
        });
    });
});
