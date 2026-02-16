import { configureStore } from '@reduxjs/toolkit';
import battleReducer from './battleSlice';

export const store = configureStore({
    reducer: {
        battle: battleReducer
    },
    // Adding middleware to ignore non-serializable objects (like BattleEventBus in state if added later)
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
