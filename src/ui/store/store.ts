import { configureStore } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';
import battleReducer from './battleSlice';
import gameReducer from './gameSlice';
import { saveGame } from '../../engine/SaveSystem';

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
        game: gameReducer
    },
    // Adding middleware to ignore non-serializable objects (like BattleEventBus in state if added later)
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        }).concat(tapMiddleware)
});

// Auto-save subscription
let prevGameState = store.getState().game;
store.subscribe(() => {
    const state = store.getState();
    if (state.game !== prevGameState) {
        const result = saveGame(state.game);
        if (!result.success) {
            // A failed autosave means player progress is silently not persisting.
            // Shout so it gets caught in development instead of surfacing as data loss.
            console.error('[AutoSave] FAILED — progress is NOT being saved:', result.error);
        }
        prevGameState = state.game;
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

