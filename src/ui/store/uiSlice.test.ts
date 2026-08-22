/**
 * Ticket 36. One boolean, three actions, and the reason the slice exists at all.
 */

import { describe, expect, it } from 'vitest';

import uiReducer, { closeSettings, openSettings, toggleSettings } from './uiSlice';

const initial = uiReducer(undefined, { type: '@@init' });

describe('uiSlice', () => {
    it('starts closed', () => {
        expect(initial.settingsOpen).toBe(false);
    });

    it('opens, closes, and is idempotent in both directions', () => {
        // Idempotence matters because two entry points dispatch `openSettings`: the nav button and
        // Escape in a fight. Pressing Escape twice with the screen already up must not toggle it shut
        // by accident — that is `toggleSettings`'s job, and only the nav uses it.
        let state = uiReducer(initial, openSettings());
        expect(state.settingsOpen).toBe(true);
        state = uiReducer(state, openSettings());
        expect(state.settingsOpen).toBe(true);

        state = uiReducer(state, closeSettings());
        expect(state.settingsOpen).toBe(false);
        state = uiReducer(state, closeSettings());
        expect(state.settingsOpen).toBe(false);
    });

    it('toggles', () => {
        const open = uiReducer(initial, toggleSettings());
        expect(open.settingsOpen).toBe(true);
        expect(uiReducer(open, toggleSettings()).settingsOpen).toBe(false);
    });

    it('holds nothing that belongs in a save', () => {
        // The settings themselves live outside the save (`ui/settings/settings.ts`) and are applied
        // to the document. If this object ever grows a second field, ask whether it is session state
        // before adding it here — the autosave subscription does not read this slice and must not
        // need to.
        expect(Object.keys(initial)).toEqual(['settingsOpen']);
    });
});
