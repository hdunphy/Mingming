// @vitest-environment jsdom
/**
 * TICKET 182a — the starter screen, cut to a title, one line, three starters.
 *
 * The cut list (2026-10-01) found "TERMINAL GAUNTLET", a heading in capitals, and a paragraph about
 * blueprints on the first screen a player sees. The run summary teaches blueprints; this screen says
 * the game's name, one line, and gives each starter one short line of flavour.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import MainMenuView from './MainMenuView';
import { STARTER_FLAVOUR } from './starterFlavour';
import battleReducer from '../store/battleSlice';
import gameReducer from '../store/gameSlice';
import runReducer from '../store/runSlice';

function render(): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(<Provider store={store}><MainMenuView /></Provider>);
}

describe('the starter screen (182a)', () => {
    it('is titled with the game\'s name and says "Choose your starter"', () => {
        const markup = render();
        expect(markup).toMatch(/<h1[^>]*>Mingming<\/h1>/);
        expect(markup).toContain('Choose your starter');
        expect(markup).not.toMatch(/TERMINAL|GAUNTLET|CHOOSE YOUR FIRST/);
    });

    it('no longer explains blueprints', () => {
        const markup = render();
        expect(markup).not.toContain('You are granted its blueprint');
        expect(markup).not.toMatch(/Assemble it at the ranch/);
    });

    it('gives each starter one line of flavour, eight words at most', () => {
        const markup = render();
        for (const id of ['kraken', 'fenrir', 'ratatoskr'] as const) {
            const line = STARTER_FLAVOUR[id];
            expect(line.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
            expect(line.length).toBeGreaterThan(0);
            expect(markup).toContain(line);
        }
    });

    it('draws the build label small, in a corner', () => {
        const markup = render();
        const label = markup.match(/<div[^>]*data-testid="build-label"[^>]*>/)?.[0] ?? '';
        expect(label).toContain('position:fixed');
        expect(label).toMatch(/right:\d+px/);
        expect(label).toMatch(/bottom:\d+px/);
        const size = Number(label.match(/font-size:([\d.]+)rem/)?.[1]);
        expect(size).toBeLessThanOrEqual(0.7);
        expect(label).not.toContain('left:');
    });
});
