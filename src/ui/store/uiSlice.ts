/**
 * SHELL STATE — ticket 36. What screen is layered over the game, and nothing else.
 *
 * # WHY A FOURTH SLICE FOR ONE BOOLEAN
 *
 * Because two unrelated places have to open the same overlay: the nav bar outside a fight, and the
 * Escape key inside one. `BattleArena` cannot reach a `useState` in `App`, and the alternatives are
 * worse than a slice — a bespoke event bus is a store with none of the tooling, and hanging
 * `settingsOpen` off `battleSlice` would make "is the settings screen open" a property of a battle
 * that may not exist.
 *
 * The precedent is ticket 09, which added the run slice the same way and fixed the handful of test
 * stores that build their reducers by hand. A slice with a defaulted initial state costs a
 * preloaded store nothing: omit it and the reducer supplies its own state.
 *
 * # WHAT DOES NOT GO IN HERE
 *
 * The settings themselves. They persist outside the save through `ui/settings/settings.ts` and are
 * applied to the document, so putting a copy in Redux would be a second source of truth for
 * something no reducer needs to read. This slice holds only what is genuinely *session* state: what
 * is currently on screen.
 */

import { createSlice } from '@reduxjs/toolkit';

export interface IUiState {
    /** Is the settings overlay up? It is an overlay, not a route — the game stays mounted behind it. */
    readonly settingsOpen: boolean;
}

const initialState: IUiState = { settingsOpen: false };

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        openSettings: (state) => {
            state.settingsOpen = true;
        },
        closeSettings: (state) => {
            state.settingsOpen = false;
        },
        /** Esc's binding outside a selection, and the nav button's. */
        toggleSettings: (state) => {
            state.settingsOpen = !state.settingsOpen;
        },
    },
});

export const { openSettings, closeSettings, toggleSettings } = uiSlice.actions;

export default uiSlice.reducer;
