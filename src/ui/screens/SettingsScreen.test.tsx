/**
 * Ticket 36. What the settings screen puts on screen, and what it deliberately does not.
 *
 * `renderToStaticMarkup`, the house pattern — so this asserts markup, and the behaviour lives in
 * `settings.test.ts` (persistence + the document), `wipeSave.test.ts` (the destructive path),
 * `keybinds.test.ts` (the table) and `uiSlice.test.ts` (the overlay flag). What no test in this repo
 * can reach is a click, so the two-step wipe is asserted in its armed-at-rest state only and its
 * *effect* is tested through `wipeSave` directly.
 */

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import SettingsScreen from './SettingsScreen';
import { KEYBINDS } from '../keybinds';
import battleReducer from '../store/battleSlice';
import gameReducer from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';

function render(): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <SettingsScreen />
        </Provider>,
    );
}

describe('SettingsScreen', () => {
    it('is a dialog, and it can be left', () => {
        const markup = render();
        expect(markup).toContain('role="dialog"');
        expect(markup).toContain('aria-modal="true"');
        expect(markup).toContain('Close');
    });

    it('lists every keybind from the one table', () => {
        // Same source as the strip under the hand. A binding added to `keybinds.ts` appears in both
        // without either being edited, which is the entire point of that file.
        const markup = render();
        for (const bind of KEYBINDS) {
            expect(markup).toContain(bind.action);
        }
    });

    it('offers the motion and text-size choices, defaulting to system and 100%', () => {
        const markup = render();
        expect(markup).toContain('Follow system');
        expect(markup).toContain('Reduce motion');
        expect(markup).toContain('Full motion');
        expect(markup).toContain('100%');
        // `aria-pressed` carries which one is live, since these are buttons rather than a radio set.
        expect(markup).toContain('aria-pressed="true"');
    });

    it('shows ONE volume control and does not invent music', () => {
        // The engine has a single gain node and no music at all. Three sliders would be a screen
        // that lies, so there is exactly one — and the note beside it says why, which is the only
        // place the word "music" is allowed to appear.
        const markup = render();
        expect(markup.match(/type="range"/g) ?? []).toHaveLength(1);
        expect(markup).not.toContain('Music volume');
        expect(markup).toContain('there is no music yet');
    });

    it('arms the wipe rather than firing it, and never uses window.confirm', () => {
        const markup = render();
        expect(markup).toContain('Wipe save');
        // The second step's wording appears only after the first click. A confirm that ships both
        // states at once is not a confirm — ticket 19's rule, and the same assertion it wrote.
        expect(markup).not.toContain('Confirm — this cannot be undone');
    });

    it('names what it does not do yet instead of showing dead controls', () => {
        // Fullscreen/resolution (37), the colourblind palette (38) and remapping are all listed as
        // absent. A disabled control the player cannot use is indistinguishable from a bug.
        const markup = render();
        expect(markup).toContain('Not here yet');
        expect(markup).toMatch(/Fullscreen and resolution/);
        expect(markup).toMatch(/Colourblind-safe/);
        expect(markup).toMatch(/Key remapping/);
    });

    it('says the settings are not part of the save', () => {
        const markup = render();
        expect(markup).toMatch(/across slots|never part of the save/);
    });
});
