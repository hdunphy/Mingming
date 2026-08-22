/**
 * The ranch slice — ticket 11 (steam-release map), part 1.
 *
 * # `state.game` IS `IRanchState`, EXACTLY
 *
 * Ticket 06 ratified two shapes and ticket 23 built the two-key save for them: **`IRanchState` is
 * what persists** (assembled individuals, blueprint counts, the codex, gyms and tiers cleared) and
 * **`IRunState` is what does not** (the deck, scrap, drivers, gauntlet progress — `runSlice.ts`).
 * Until this ticket the slice still held `IPlayerSave`, the pre-roguelike blob, and
 * `engine/save/ranchProjection.ts` translated between the two at the save boundary. Both are gone:
 * this reducer's state object *is* the thing that gets written, field for field, so `store.ts` can
 * hand `state.game` straight to `saveRanch` and there is nothing left to keep in sync.
 *
 * # WHY THIS FILE IS STILL CALLED `gameSlice` AND THE KEY IS STILL `game`
 *
 * Deliberately, and only for the length of one commit. Renaming the module and the state key to
 * `ranch` touches every `useSelector` and every test in the repo for zero behavioural change, which
 * would bury this diff — the one that actually moves the shape — under pure churn. The rename is
 * its own commit.
 *
 * # WHAT LEFT, AND WHERE IT WENT
 *
 * - `version` — vestigial. Save versions are `SAVE_VERSION_V4`, per envelope (`runTypes.ts`).
 * - `activeParty` — **gone from the ranch entirely**, along with `setActiveParty`. The party is
 *   chosen at run start and lives in `IRunState.partyIds`, so a persistent ranch party is not a
 *   concept any more. `engine/party.ts` still owns the species clause, and the two places that can
 *   still create a party both enforce it: `RunStart` (via `partyBlockFor`) at pick time, and
 *   `reconcileLoadedState` at load — the latter spelling the laws out itself, because it also has
 *   to decide what to discard when they fail.
 * - `cardInventory` / `activeDeck` / `baseDecksGranted` — collapsed into `IRunState.deck`, which is
 *   `IRunCard[]` carrying `dataId` directly, so the instance-id indirection disappears with them.
 * - `scrapCount` → `IRunState.scrap`; `relics` → `IRunState.drivers`; `gauntlet` →
 *   `IRunState.gauntlet`. See `runSlice.ts` for the reducers.
 * - `unlockedSectors` → `gymsCleared`, the ranch field that already meant this.
 *
 * # THE NO-OP CONVENTION
 *
 * Every reducer that can fail a precondition **returns silently** rather than throwing: a reducer
 * has no error channel, the store has nowhere to put one, and the screens check affordability
 * before dispatching. `assembleMingming` and `swapOS` both spend a blueprint atomically for the
 * same reason — the old two-dispatch flow (`spendScrap` then `addToRoster`) had a window in which
 * a unit could be built for free.
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import type { IRanchMember, IRanchState } from '../../engine/runTypes';

/**
 * A ranch with nothing in it — a new player, and what `resetSave` returns to.
 *
 * There is no starting sector list any more. v3 seeded `unlockedSectors` with Fire/Water/Nature
 * because the sector picker needed somewhere to go; `gymsCleared` means something different and
 * narrower — gyms you have actually beaten — so seeding it would be claiming three clears that
 * never happened. What a new player may attempt is decided at run start by `offerGyms`, not by
 * this list.
 */
export function createEmptyRanch(): IRanchState {
    return {
        roster: [],
        blueprints: {},
        codex: { seen: [], played: [] },
        gymsCleared: [],
        highestTierCleared: 0,
    };
}

const initialState: IRanchState = createEmptyRanch();

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        // --- Roster ---
        /**
         * Bare add, no cost. **Not the player-facing path** — ticket 20 routes assembly through
         * `assembleMingming`, which spends the blueprint. This one survives for the debug toolkit
         * and for tests that need a roster member without an economy.
         *
         * Ticket 11 deleted its base-deck grant. It used to push the species' starting kit into
         * `cardInventory` and record a `deckGrantKey`, which was pre-run-loop behaviour kept alive
         * only so the debug launcher's "saved deck" mode had something to read. Cards are
         * run-scoped now and ticket 08's `startKit` tags supply the start deck at run start, so a
         * roster addition grants nothing at all.
         */
        addToRoster: (state, action: PayloadAction<IRanchMember>) => {
            (state.roster as IRanchMember[]).push(action.payload);
        },
        removeFromRoster: (state, action: PayloadAction<string>) => {
            state.roster = (state.roster as IRanchMember[]).filter(m => m.id !== action.payload);
        },

        // --- Blueprints ---
        /**
         * Ticket 20: **stacks, never dedupes.** v3 refused a second blueprint of a species you
         * already had, which made sense when a blueprint was a permanent "you may build this"
         * permission. It is currency now — a second one is a second assembly.
         */
        addBlueprint: (state, action: PayloadAction<string>) => {
            const counts = state.blueprints as Record<string, number>;
            counts[action.payload] = (counts[action.payload] ?? 0) + 1;
        },

        /**
         * The player-facing assembly path (ticket 20). **Costs exactly one blueprint of the
         * species and no scrap** — `economy-session.md` and `vision.md` agree once you split the
         * places apart: a blueprint at the ranch, a blueprint PLUS scrap at a mid-run workshop
         * (ticket 14 set that price at `WORKSHOP_ASSEMBLY_SCRAP`). Scrap is run-scoped, so a ranch
         * that charged it would be charging a currency the player cannot bring home.
         *
         * Atomic on purpose; silent no-op with no blueprint. The caller builds the individual (it
         * owns the RNG for the stat roll), which is also what makes re-assembly the re-roll: same
         * species, new individual, one more blueprint.
         *
         * **Ticket 14 gave it a second caller, and the reducer did not have to change.** A mid-run
         * recruit is this action plus `runSlice.recruitIntoParty`, dispatched in that order — the
         * ranch half first, so that dying in between leaves the player holding an assembled
         * individual rather than a run whose party names a member the roster does not have. See
         * `recruitIntoParty` for the argument; the reason it works is that this reducer is already
         * atomic in the currency it spends.
         */
        assembleMingming: (state, action: PayloadAction<IRanchMember>) => {
            const counts = state.blueprints as Record<string, number>;
            const held = counts[action.payload.definitionId] ?? 0;
            if (held < 1) return;
            counts[action.payload.definitionId] = held - 1;
            if (counts[action.payload.definitionId] === 0) delete counts[action.payload.definitionId];
            (state.roster as IRanchMember[]).push(action.payload);
        },

        // --- Gym and tier progress ---
        /**
         * Record a gym clear. `gymsCleared` is what run start reads to decide which leaders and
         * tiers to offer (`IRanchState`), so this is the only durable consequence of winning a
         * gauntlet — the run it happened in is thrown away with everything else in it.
         *
         * Idempotent: beating the same leader twice is not two clears.
         */
        markGymCleared: (state, action: PayloadAction<string>) => {
            if (state.gymsCleared.includes(action.payload)) return;
            (state.gymsCleared as string[]).push(action.payload);
        },

        /**
         * Raise the high-water mark of tiers beaten. **Monotonic**: a tier-0 clear after a tier-2
         * one must not demote the player, because `exploration-map.md` makes tier an unlock ("meaner
         * curated teams, more elites, enemy relics"), not a current-difficulty setting.
         */
        recordTierCleared: (state, action: PayloadAction<number>) => {
            if (!Number.isInteger(action.payload) || action.payload < 0) return;
            if (action.payload <= state.highestTierCleared) return;
            state.highestTierCleared = action.payload;
        },

        // --- OS Management ---
        updateMingmingOS: (state, action: PayloadAction<{ id: string, activeOS: string }>) => {
            const { id, activeOS } = action.payload;
            const mm = state.roster.find(m => m.id === id);
            if (mm) {
                mm.activeOS = activeOS;
            }
        },
        /**
         * Player-facing firmware reflash (ticket 15, re-priced by ticket 20).
         *
         * **Costs exactly one blueprint of the species and grants nothing.** Ticket 15 gave the
         * first swap to an OS a one-time pick of two cards from that OS's kit; ticket 11 deletes
         * that pick along with `baseDecksGranted`, because a ranch handing out cards is a ranch
         * handing out run-scoped resources. A reflash costs a blueprint and changes which firmware
         * the individual runs — that is the whole transaction.
         *
         * Silent no-op when any cost or validation fails. Debug tools keep using the bare
         * `updateMingmingOS` above, which charges nothing.
         */
        swapOS: (state, action: PayloadAction<{ id: string; targetOS: string }>) => {
            const { id, targetOS } = action.payload;
            const mm = state.roster.find(m => m.id === id);
            if (!mm) return;
            const definition = MingmingRegistry[mm.definitionId];
            if (!definition || !definition.availableOS.includes(targetOS)) return;
            if (mm.activeOS === targetOS) return;

            const counts = state.blueprints as Record<string, number>;
            const held = counts[mm.definitionId] ?? 0;
            if (held < 1) return;

            counts[mm.definitionId] = held - 1;
            if (counts[mm.definitionId] === 0) delete counts[mm.definitionId];
            mm.activeOS = targetOS;
        },

        // --- Load / reset ---
        /**
         * Install a ranch wholesale. `App`'s boot effect hands it exactly what came out of
         * `loadGameState()` — no projection, no merge — because the stored shape and this slice's
         * shape are now the same type.
         */
        loadSave: (_state, action: PayloadAction<IRanchState>) => {
            return action.payload;
        },
        resetSave: (state) => {
            void state;
            return createEmptyRanch();
        },
    }
});

export const {
    addToRoster,
    removeFromRoster,
    addBlueprint,
    assembleMingming,
    markGymCleared,
    recordTierCleared,
    updateMingmingOS,
    swapOS,
    loadSave,
    resetSave,
} = gameSlice.actions;

export default gameSlice.reducer;
