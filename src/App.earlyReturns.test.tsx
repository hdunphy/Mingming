/**
 * Regression: a scenario launched into a fresh save slot was created but never rendered.
 *
 * `App` had `rosterSize === 0 -> MainMenuView` ahead of `isInBattle -> BattleArena`. A new save
 * slot starts from an empty ranch, whose roster is empty, so launching a composed scenario
 * from the debug launcher set `state.battle.battle` correctly and then rendered the main menu on
 * top of it. From the outside, Launch "did nothing".
 *
 * Composing a party from scratch is the launcher's entire purpose, so an empty roster is the
 * normal case there — which is why the ordering had to change rather than the launcher working
 * around it.
 *
 * Rendered to static markup in the shape the panel tests established (`SnapshotPanel.test.tsx`):
 * the repo has no `@testing-library/react`, and `renderToStaticMarkup` never runs effects, so
 * `initAudio()` and the `loadGame()` mount effect stay out of the way.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

const backing: Record<string, string> = {};
vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing[key] ?? null,
    setItem: (key: string, value: string) => {
        backing[key] = value;
    },
    removeItem: (key: string) => {
        delete backing[key];
    },
    clear: () => {
        Object.keys(backing).forEach((k) => delete backing[k]);
    },
    get length() {
        return Object.keys(backing).length;
    },
    key: (i: number) => Object.keys(backing)[i] ?? null,
});

import App from './App';
import battleReducer from './ui/store/battleSlice';
import gameReducer, { createEmptyRanch } from './ui/store/gameSlice';
import runReducer from './ui/store/runSlice';
import { createSparseBattleState } from './debug/scenarios/scenarioTestSupport';

function render(battle: ReturnType<typeof createSparseBattleState> | null): string {
    const store = configureStore({
        // Ticket 09 added the `run` slice; `App` reads `state.run.run` to decide whether the
        // player is at the ranch or in a run, so a store without it renders undefined.
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: {
            game: createEmptyRanch(),
            battle: {
                battle,
                selectedSourceId: null,
                selectedTargetId: null,
                selectedCardId: null,
            },
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });

    return renderToStaticMarkup(
        <Provider store={store}>
            <App />
        </Provider>,
    );
}

describe('App early returns', () => {
    it('renders the battle when a scenario is injected into an empty-roster slot', () => {
        const markup = render(createSparseBattleState());

        // The failure this guards: markup was MainMenuView while state.battle.battle was set.
        expect(markup).toContain('battle-screen');
    });

    it('still renders the main menu for an empty roster with no battle', () => {
        const markup = render(null);

        expect(markup).not.toContain('battle-screen');
    });
});
