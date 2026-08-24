import { configureStore } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';
import battleReducer from './battleSlice';
import gameReducer from './gameSlice';
import runReducer from './runSlice';
import uiReducer from './uiSlice';
import { saveRanch, saveRun } from '../../engine/SaveSystem';
import { readRunLogs } from '../../engine/run/runLog';
import { reportSaveResult } from './saveHealth';
import { createRunLogMiddleware } from './runLogMiddleware';

/**
 * Dispatch tap — one optional observer of every dispatched action.
 *
 * `store.subscribe` reports *that* state changed but never *which* action changed it, so
 * anything needing the action itself (recorders, loggers, instrumentation) has to sit in a
 * middleware. This is that seam and nothing else: one slot, general-purpose, with no consumer
 * in this file and no import of one. It stays inert until something calls `setActionTap`.
 */
export type ActionTap = (action: unknown) => void;

let actionTap: ActionTap | null = null;

/** Install the dispatch tap, or pass `null` to remove it. Last caller wins. */
export function setActionTap(tap: ActionTap | null): void {
    actionTap = tap;
}

const tapMiddleware: Middleware = () => (next) => (action) => {
    actionTap?.(action);
    return next(action);
};

export const store = configureStore({
    reducer: {
        battle: battleReducer,
        game: gameReducer,
        run: runReducer,
        // Ticket 36. Session-only: what is layered over the game. Nothing here is persisted, and
        // the autosave subscription below deliberately does not read it.
        ui: uiReducer
    },
    // Adding middleware to ignore non-serializable objects (like BattleEventBus in state if added later)
    //
    // TICKET 59: the run log rides ALONGSIDE the tap rather than inside it. `setActionTap` is one
    // slot, last caller wins, and the debug action tape holds it — a production consumer installing
    // itself there would silently disable the tape, and opening the debug panel would silently
    // disable the log. `concat` takes a list, so both observers run and neither can evict the
    // other. See `runLogMiddleware`'s header.
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        }).concat(tapMiddleware, createRunLogMiddleware(readRunLogs))
});

// Auto-save subscription
//
// `saveRanch` validates before it serializes and serializes before it writes, so a state that
// fails `RanchSaveSchema` never reaches storage and a write that throws leaves the previous bytes
// alone. What ticket 04 added on this side is the *reporting*: every outcome, success or failure,
// goes to `saveHealth`, which `SaveHealthBanner` renders. The old `console.error` was the only
// signal, and a packaged desktop build has no console for anyone to read it in.
//
// `reportSaveResult` is deliberately not a dispatch — this callback runs inside `store.subscribe`,
// so dispatching here would re-enter the store on every single save.
//
// TICKET 09: the second arm. Save v4's two keys are written INDEPENDENTLY — that is the whole
// point of the split (a corrupt run costs a run, never a blueprint), and it is only true if the two
// writes are two writes. Each arm fires on its own slice's identity changing, so travelling a node
// does not rewrite the ranch and assembling a mingming does not rewrite the run.
//
// `saveRun(null)` REMOVES the run key rather than writing a null envelope, so ending a run leaves
// no bytes behind and the next load takes the "no run" branch by absence.
//
// Only the ranch arm reports to `saveHealth`. A failed ranch write is the one the player must know
// about — it is the irreplaceable half — while a failed run write costs at most the current run and
// would otherwise fill the banner with noise on every step of the map. It still logs.
//
// TICKET 11: `state.game` IS an `IRanchState`, so it goes to `saveRanch` unchanged. There used to
// be a `toRanchState` projection here, translating the pre-roguelike slice blob into the v4 ranch;
// with the slice moved onto the ratified shape there is nothing left to translate, and the class of
// bug where the projection and the slice drift apart cannot happen any more.
let prevGameState = store.getState().game;
let prevRunState = store.getState().run.run;
store.subscribe(() => {
    const state = store.getState();
    if (state.game !== prevGameState) {
        const result = saveRanch(state.game);
        if (!result.success) {
            console.error('[AutoSave] FAILED — progress is NOT being saved:', result.error);
        }
        reportSaveResult(result);
        prevGameState = state.game;
    }
    if (state.run.run !== prevRunState) {
        const result = saveRun(state.run.run);
        if (!result.success) {
            console.error('[AutoSave] run write failed — the ranch is unaffected:', result.error);
        }
        prevRunState = state.run.run;
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

