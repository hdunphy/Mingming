import { configureStore } from '@reduxjs/toolkit';
import battleReducer from './battleSlice';
import gameReducer from './gameSlice';
import { saveGame } from '../../engine/SaveSystem';

export const store = configureStore({
    reducer: {
        battle: battleReducer,
        game: gameReducer
    },
    // Adding middleware to ignore non-serializable objects (like BattleEventBus in state if added later)
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        })
});

// Auto-save subscription
let prevGameState = store.getState().game;
store.subscribe(() => {
    const state = store.getState();
    if (state.game !== prevGameState) {
        saveGame(state.game);
        prevGameState = state.game;
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

