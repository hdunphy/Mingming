/**
 * Regression: a scenario launched into a fresh save slot was created but never rendered.
 *
 * `App` had `rosterSize === 0 -> MainMenuView` ahead of `isInBattle -> BattleArena`. A new save
 * slot starts from `createDefaultSave()`, whose roster is empty, so launching a composed scenario
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
import { createDefaultSave } from './engine/gameTypes';
import battleReducer from './ui/store/battleSlice';
import gameReducer from './ui/store/gameSlice';
import { createSparseBattleState } from './debug/scenarios/scenarioTestSupport';

function render(battle: ReturnType<typeof createSparseBattleState> | null): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer },
        preloadedState: {
            game: createDefaultSave(),
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
