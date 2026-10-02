// @vitest-environment jsdom
/**
 * TICKET 182a — THE COPY BUDGET TEST.
 *
 * Renders each main screen in a new-player state (one starter, nothing else held) and fails if a
 * `<p>` is longer than 140 characters or a screen has more than one `<p>`. Henry, 2026-10-01: *"The
 * game currently looks like a generic Claude web app and is AI sloppy because of all the heavy
 * text."* This test is what stops the paragraphs coming back.
 *
 * Hover text and screen-reader-only text do not count (see `copyBudget.ts`). Each screen is added by
 * the row of 182a that cut its copy, so a screen listed here has already been cut.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

import MainMenuView from '../components/MainMenuView';
import RanchScreen from '../screens/RanchScreen';
import { createRanchMember } from '../../engine/gameTypes';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { budgetProblem, readCopy } from './copyBudget';

function storeFor(game = createEmptyRanch()) {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: { game },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

function render(tree: ReactNode, game = createEmptyRanch()): string {
    return renderToStaticMarkup(<Provider store={storeFor(game)}>{tree}</Provider>);
}

/** The new-player state: one starter assembled, nothing else held. */
function oneStarter() {
    return { ...createEmptyRanch(), roster: [createRanchMember('kraken', 'kraken_v1')] };
}

describe('the copy budget', () => {
    it('the starter screen is inside it', () => {
        const report = readCopy(render(<MainMenuView />));
        expect(budgetProblem(report)).toBeNull();
    });

    it('the ranch (Expedition) is inside it', () => {
        const report = readCopy(render(<RanchScreen initialSection="expedition" />, oneStarter()));
        expect(budgetProblem(report)).toBeNull();
    });

    it('the measurement itself: two paragraphs, or one that runs long, is over budget', () => {
        expect(budgetProblem(readCopy('<p>One.</p><p>Two.</p>'))).toMatch(/2 paragraphs/);
        expect(budgetProblem(readCopy(`<p>${'x'.repeat(141)}</p>`))).toMatch(/141 characters/);
        expect(budgetProblem(readCopy('<p>One short line.</p>'))).toBeNull();
        // Screen-reader-only text and hover text are not on screen.
        expect(budgetProblem(readCopy('<p>Seen.</p><p class="sr-only">Heard.</p><div title="a hover that is long"></div>'))).toBeNull();
    });
});
