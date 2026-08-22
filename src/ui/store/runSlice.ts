/**
 * The run in progress — ticket 09 (steam-release map).
 *
 * # WHY THIS IS A SEPARATE SLICE
 *
 * Ticket 06 drew the line and ticket 23 built the storage for it: the **ranch** persists and a
 * **run** does not. They are written to two different storage keys precisely so a corrupt run costs
 * a run and never a blueprint, and `SaveSystem.saveRun` is already there waiting for something to
 * call it. A single slice holding both would have made that split a lie at the one layer that
 * matters — the autosave subscription, which has to be able to write one key without the other.
 *
 * So: `state.game` is the ranch and everything the pre-roguelike battle path still needs;
 * `state.run` is this, `IRunState | null`. Null is the normal state — you are at the ranch.
 *
 * # WHAT IS DELIBERATELY NOT HERE YET
 *
 * Travel, encounters, rewards, the gauntlet: tickets 10 through 19. This slice starts a run, ends
 * one, and rehydrates one from disk, which is exactly what ticket 09 needs and nothing more. Every
 * later ticket adds reducers here rather than reaching into `IRunState` from a component.
 */

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { IRunState, RunOutcome } from '../../engine/runTypes';

export interface RunSliceState {
    /** Null means no run in progress — the player is at the ranch. */
    run: IRunState | null;
}

const initialState: RunSliceState = { run: null };

const runSlice = createSlice({
    name: 'run',
    initialState,
    reducers: {
        // Every reducer here REPLACES rather than mutates. `IRunState` is deeply readonly by
        // design — it is the ratified save shape and nothing should be editing it in place — and
        // immer's draft type refuses a readonly array assignment, which is the type system telling
        // the truth rather than getting in the way. Later tickets that need to change one field
        // should spread, not reach in.

        /** Begin a run. `engine/run/createRun.ts` builds the state; this only installs it. */
        startRun: (_state, action: PayloadAction<IRunState>): RunSliceState => ({ run: action.payload }),

        /**
         * Rehydrate from storage, or clear. Distinct from `startRun` only in intent — this is what
         * `App`'s load effect and the debug tools call, and keeping the two named apart means a
         * reducer log reads as a story rather than a shrug.
         */
        setRun: (_state, action: PayloadAction<IRunState | null>): RunSliceState => ({ run: action.payload }),

        /**
         * Mark the run finished. Does NOT clear it: ticket 19 owns the run-summary screen, which
         * has to read the corpse — fights resolved, what was banked, how it ended. `clearRun` is
         * the separate step that throws it away, and the autosave arm removes the storage key when
         * it does.
         */
        endRun: (state, action: PayloadAction<RunOutcome>): RunSliceState => {
            const run = state.run as IRunState | null;
            if (!run) return { run: null };
            return { run: { ...run, phase: 'ended', outcome: action.payload } };
        },

        /** Throw the run away and go back to the ranch. Removes the run save key. */
        clearRun: (): RunSliceState => ({ run: null }),
    },
});

export const { startRun, setRun, endRun, clearRun } = runSlice.actions;

export default runSlice.reducer;
