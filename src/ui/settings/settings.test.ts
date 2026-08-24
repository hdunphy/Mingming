// @vitest-environment jsdom
/**
 * Ticket 36. Settings round-trip, and reach the document.
 *
 * "Every setting round-trips through restart" is the ticket's Done-when, and a restart is exactly
 * what these tests simulate: write with one storage, read it back with another instance holding the
 * same bytes. The `makeMockStorage` shape is `AudioEngine.test.ts`'s, since this module follows that
 * module's pattern deliberately.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
    BASE_FONT_PX,
    DEFAULT_SETTINGS,
    SETTINGS_STORAGE_KEY,
    TEXT_SCALES,
    applySettings,
    fontSizeFor,
    loadSettings,
    saveSettings,
    type ISettings,
    type SettingsStorage,
} from './settings';
import { getReducedMotionOverride, prefersReducedMotion, setReducedMotionOverride } from '../utils/motionPrefs';

function makeMockStorage(seed: Record<string, string> = {}) {
    const data: Record<string, string> = { ...seed };
    const storage: SettingsStorage & { data: Record<string, string> } = {
        data,
        read: (key) => data[key] ?? null,
        write: (key, value) => {
            data[key] = value;
        },
    };
    return storage;
}

afterEach(() => {
    // The override is module state; leaving it set would leak into every other suite's motion.
    setReducedMotionOverride(null);
});

describe('settings persistence', () => {
    it('defaults when nothing is stored', () => {
        expect(loadSettings(makeMockStorage())).toEqual(DEFAULT_SETTINGS);
    });

    it('round-trips through storage — the Done-when, in one line', () => {
        const storage = makeMockStorage();
        const chosen: ISettings = { ...DEFAULT_SETTINGS, reducedMotion: 'on', textScale: 1.3 };
        saveSettings(chosen, storage);
        expect(loadSettings(makeMockStorage(storage.data))).toEqual(chosen);
    });

    it('writes one top-level key, with no slot in it', () => {
        // The point of the key: switching save slot must not change how loud or how big the game is.
        const storage = makeMockStorage();
        saveSettings(DEFAULT_SETTINGS, storage);
        expect(Object.keys(storage.data)).toEqual([SETTINGS_STORAGE_KEY]);
        expect(SETTINGS_STORAGE_KEY).not.toContain('__');
    });

    it('falls back to defaults on junk rather than rewriting it', () => {
        const storage = makeMockStorage({ [SETTINGS_STORAGE_KEY]: 'not json{' });
        expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
        // Untouched: a hand-edited file is not silently replaced by the act of reading it.
        expect(storage.data[SETTINGS_STORAGE_KEY]).toBe('not json{');
    });

    it('rejects a value outside the allowed range instead of clamping it', () => {
        // `.default()` not `.catch()` — ticket 23's rule. An invalid field fails the parse, and the
        // whole blob falls back, rather than half-applying something nobody chose.
        const storage = makeMockStorage({
            [SETTINGS_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, reducedMotion: 'on', textScale: 9 }),
        });
        expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    });

    it('fills a missing field from the default and keeps the one that is there', () => {
        const storage = makeMockStorage({
            [SETTINGS_STORAGE_KEY]: JSON.stringify({ reducedMotion: 'off' }),
        });
        expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, reducedMotion: 'off', textScale: 1 });
    });

    it('reads a blob written before auto-save existed as auto-save OFF', () => {
        // The direction of the surprise matters: a settings file from an older build turning
        // auto-save ON would start writing a JSON download after every run for a player who never
        // asked for one. `.default(false)` is what makes the older blob parse at all.
        const storage = makeMockStorage({
            [SETTINGS_STORAGE_KEY]: JSON.stringify({ reducedMotion: 'off', textScale: 1 }),
        });
        expect(loadSettings(storage).autoSaveRunLog).toBe(false);
    });

    it('survives storage that throws in either direction', () => {
        const broken: SettingsStorage = {
            read: () => {
                throw new Error('unavailable');
            },
            write: () => {
                throw new Error('quota');
            },
        };
        expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
        expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
    });
});

describe('applySettings', () => {
    it('sets the root font size from the scale ladder', () => {
        const root = document.createElement('html');
        for (const scale of TEXT_SCALES) {
            applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'system', textScale: scale }, root);
            expect(root.style.fontSize).toBe(fontSizeFor(scale));
        }
        expect(fontSizeFor(1)).toBe(`${BASE_FONT_PX}px`);
    });

    it('stamps the attribute the CSS reads — and removes it for "system"', () => {
        // `system` must leave NO attribute, because the stylesheets' media queries are scoped to
        // `:root:not([data-reduced-motion])`. An attribute of "system" would silently disable them.
        const root = document.createElement('html');

        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'on', textScale: 1 }, root);
        expect(root.getAttribute('data-reduced-motion')).toBe('on');

        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'off', textScale: 1 }, root);
        expect(root.getAttribute('data-reduced-motion')).toBe('off');

        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'system', textScale: 1 }, root);
        expect(root.hasAttribute('data-reduced-motion')).toBe(false);
    });

    it('moves the JS gate in the same call as the CSS one', () => {
        // Two mechanisms, one decision. They are set together here so they cannot come apart.
        const root = document.createElement('html');

        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'on', textScale: 1 }, root);
        expect(getReducedMotionOverride()).toBe(true);
        expect(prefersReducedMotion()).toBe(true);

        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'off', textScale: 1 }, root);
        expect(getReducedMotionOverride()).toBe(false);
        expect(prefersReducedMotion()).toBe(false);

        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'system', textScale: 1 }, root);
        expect(getReducedMotionOverride()).toBeNull();
    });
});
