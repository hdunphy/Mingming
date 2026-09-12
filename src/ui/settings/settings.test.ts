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
    resolveVfxGates,
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


describe('146a — the three effect switches', () => {
    it('default to on, so an existing player notices nothing', () => {
        expect(DEFAULT_SETTINGS.particles).toBe(true);
        expect(DEFAULT_SETTINGS.vfx).toBe(true);
        expect(DEFAULT_SETTINGS.animations).toBe(true);
    });

    it('round-trip through storage, which is the ticket Done-when for every setting', () => {
        const storage = makeMockStorage();
        const settings: ISettings = {
            ...DEFAULT_SETTINGS, particles: false, vfx: false, animations: true,
        };
        saveSettings(settings, storage);

        const reloaded = loadSettings(makeMockStorage({ ...storage.data }));
        expect(reloaded.particles).toBe(false);
        expect(reloaded.vfx).toBe(false);
        expect(reloaded.animations).toBe(true);
    });

    it('parse a blob written before they existed, into everything-on', () => {
        // The upgrade path. A player on an older build has a settings blob with three fields; it
        // must not fail the parse (which would silently reset their text scale) and it must not
        // turn anything OFF that they never asked to lose.
        const older = JSON.stringify({ reducedMotion: 'off', textScale: 1.15, autoSaveRunLog: true });
        const loaded = loadSettings(makeMockStorage({ [SETTINGS_STORAGE_KEY]: older }));

        expect(loaded.textScale).toBe(1.15);
        expect(loaded.autoSaveRunLog).toBe(true);
        expect(loaded.particles).toBe(true);
        expect(loaded.vfx).toBe(true);
        expect(loaded.animations).toBe(true);
    });
});

describe('146a — reduced motion overrules the switches', () => {
    afterEach(() => setReducedMotionOverride(null));

    it('maps to particles off, animations off, vfx flashes-only', () => {
        // §2a's mapping, exactly. `flashes` rather than `off` because a flash has no motion in it —
        // it keeps the feedback that says WHICH unit was hit while declining all the movement.
        const gates = resolveVfxGates({ ...DEFAULT_SETTINGS }, true);
        expect(gates).toEqual({ particles: false, animations: false, vfx: 'flashes' });
    });

    it('overrules switches that are stored ON, rather than sitting beside them', () => {
        // The asymmetry is the point: a player who asked for less motion has said something about
        // their body, and a stored `animations: true` from before that is not consent.
        const gates = resolveVfxGates(
            { ...DEFAULT_SETTINGS, particles: true, vfx: true, animations: true }, true,
        );
        expect(gates.particles).toBe(false);
        expect(gates.animations).toBe(false);
    });

    it('can only ever turn things further off — a switch off stays off without it', () => {
        const gates = resolveVfxGates({ ...DEFAULT_SETTINGS, particles: false }, false);
        expect(gates).toEqual({ particles: false, animations: true, vfx: 'full' });
    });

    it('reads the player override through prefersReducedMotion when not told', () => {
        setReducedMotionOverride(true);
        expect(resolveVfxGates({ ...DEFAULT_SETTINGS }).particles).toBe(false);
        setReducedMotionOverride(false);
        expect(resolveVfxGates({ ...DEFAULT_SETTINGS }).particles).toBe(true);
    });

    it('stamps the RESOLVED gates on the document, so CSS and the layer agree', () => {
        // Publishing the raw stored booleans here is how a stylesheet asking [data-particles]
        // ends up disagreeing with the layer about the same player.
        const root = document.createElement('div');
        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'on', particles: true }, root);

        expect(root.getAttribute('data-particles')).toBe('off');
        expect(root.getAttribute('data-animations')).toBe('off');
        expect(root.getAttribute('data-vfx')).toBe('flashes');
    });

    it('stamps the switches themselves when motion is not reduced', () => {
        const root = document.createElement('div');
        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'off', particles: false, vfx: false }, root);

        expect(root.getAttribute('data-particles')).toBe('off');
        expect(root.getAttribute('data-animations')).toBe('on');
        expect(root.getAttribute('data-vfx')).toBe('off');
    });
});
