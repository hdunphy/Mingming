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
        expect(markup).toContain('No music yet');
    });

    it('arms the wipe rather than firing it, and never uses window.confirm', () => {
        const markup = render();
        expect(markup).toContain('Wipe save');
        // The second step's wording appears only after the first click. A confirm that ships both
        // states at once is not a confirm — ticket 19's rule, and the same assertion it wrote.
        expect(markup).not.toContain('Confirm — this cannot be undone');
    });

    it('offers no quit control in a build that cannot quit', () => {
        // The 2026-08-30 fix adds a QUIT section — to the DESKTOP build only. These tests render
        // with no `window.mingmingDesktop`, which is the web build, and a quit button there would
        // be the one thing this screen's own "Not here yet" section exists to avoid: a control that
        // takes a click and does nothing. `quitGame.test.ts` owns the other half.
        expect(render()).not.toContain('Quit game');
    });

    it('names what it does not do yet instead of showing dead controls', () => {
        /*
         * The colourblind palette (38) and remapping are still listed as absent. A disabled control
         * the player cannot use is indistinguishable from a bug, so the screen names them in prose.
         *
         * **FULLSCREEN LEFT THIS LIST IN TICKET 37** and the row that replaced it is what this
         * assertion now pins: windowing is still deferred, but fullscreen is a real control in the
         * Display group. Asserted as the absence of the old phrasing as well as the presence of the
         * new one, because a half-applied revert would otherwise leave the screen claiming both.
         */
        const markup = render();
        expect(markup).toContain('Not here yet');
        expect(markup).not.toMatch(/Fullscreen and resolution/);
        expect(markup).toMatch(/Resolution/);
        expect(markup).toMatch(/Colourblind-safe/);
        expect(markup).toMatch(/Key remapping/);
    });

    it('offers the battle-log switch, on by default, and says what off costs', () => {
        /*
         * Henry, 2026-09-20 — the switch that came with splitting transcripts out of the run log.
         * On by default because ticket 156 exists precisely because the logs were missing, and the
         * note has to say what "off" actually loses: the TEXT, not the run's numbers. A player who
         * reads "off" as "stop recording my runs" would turn it off for the wrong reason.
         */
        const markup = render();
        expect(markup).toContain('Save battle logs');
        expect(markup).toContain('combat log is kept');
        // Defaulting to on means the On choice carries the pressed state, not the Off one.
        const onIndex = markup.indexOf('Save battle logs');
        const block = markup.slice(onIndex, onIndex + 600);
        expect(block).toContain('aria-pressed="true"');
    });

    it('says the settings are not part of the save', () => {
        const markup = render();
        expect(markup).toMatch(/kept apart from your save|never part of the save/);
    });
    it('offers the enemy-hand switch, on, and away from the motion switches \u2014 159c', () => {
        /*
         * \u00a75 said "beside 146's three" and it cannot sit there: the note under those three reads
         * "so particles and animations are off whatever these say" under reduced motion, and
         * reduced motion does NOT touch this one. A player reading that line directly above this
         * switch has been told something false about it.
         *
         * So: present, on by default, and under its own heading rather than Motion's.
         */
        const markup = render();
        expect(markup).toContain('Show enemy hand');

        const battleHeading = markup.indexOf('>Battle<');
        const motionHeading = markup.indexOf('>Motion<');
        const switchAt = markup.indexOf('Show enemy hand');
        expect(battleHeading).toBeGreaterThan(-1);
        // It is under Battle, not under Motion.
        expect(switchAt).toBeGreaterThan(battleHeading);
        expect(battleHeading).toBeGreaterThan(motionHeading);

        // On by default, and the note says what "on" actually shows rather than naming the control.
        expect(markup).toContain('what they draw next');
    });
});
