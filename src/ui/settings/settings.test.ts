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
    BATTLE_SPEEDS,
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


describe('190a — the battle switches (the old Effects and Animations are retired)', () => {
    it('default as ruled: Showy, shake 60, hit-stop on, flashes on, catch-up on, particles on', () => {
        expect(DEFAULT_SETTINGS.battleSpeed).toBe('showy');
        expect(DEFAULT_SETTINGS.screenShake).toBe(60);
        expect(DEFAULT_SETTINGS.hitStop).toBe(true);
        expect(DEFAULT_SETTINGS.flashes).toBe(true);
        expect(DEFAULT_SETTINGS.catchUp).toBe(true);
        expect(DEFAULT_SETTINGS.particles).toBe(true);
    });

    it('has no vfx or animations field any more', () => {
        expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('vfx');
        expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('animations');
    });

    it('offers exactly the five tiers, slowest first', () => {
        expect([...BATTLE_SPEEDS]).toEqual(['slow', 'showy', 'snappy', 'fast', 'instant']);
    });

    it('round-trip through storage, which is the ticket Done-when for every setting', () => {
        const storage = makeMockStorage();
        const settings: ISettings = {
            ...DEFAULT_SETTINGS, battleSpeed: 'fast', screenShake: 25, hitStop: false, flashes: false,
            catchUp: false, particles: false,
        };
        saveSettings(settings, storage);

        const reloaded = loadSettings(makeMockStorage({ ...storage.data }));
        expect(reloaded).toEqual(settings);
    });

    it('rejects a shake outside 0-100 instead of clamping it, like every other bounded field', () => {
        const storage = makeMockStorage({
            [SETTINGS_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, screenShake: 250 }),
        });
        expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    });

    it('parses a blob written before they existed into Showy and everything on', () => {
        const older = JSON.stringify({ reducedMotion: 'off', textScale: 1.15, autoSaveRunLog: true });
        const loaded = loadSettings(makeMockStorage({ [SETTINGS_STORAGE_KEY]: older }));

        expect(loaded.textScale).toBe(1.15);
        expect(loaded.autoSaveRunLog).toBe(true);
        expect(loaded.battleSpeed).toBe('showy');
        expect(loaded.flashes).toBe(true);
        expect(loaded.particles).toBe(true);
    });
});

describe('190a — the migration from the retired switches (ruled D1, and the 2026-10-03 follow-up)', () => {
    const load = (old: object) =>
        loadSettings(makeMockStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ reducedMotion: 'off', textScale: 1, ...old }) }));

    it('animations: false becomes Instant', () => {
        expect(load({ animations: false }).battleSpeed).toBe('instant');
    });

    it('effects (vfx): false becomes flashes off', () => {
        expect(load({ vfx: false }).flashes).toBe(false);
    });

    it('both off becomes Instant AND flashes off', () => {
        const loaded = load({ animations: false, vfx: false });
        expect(loaded.battleSpeed).toBe('instant');
        expect(loaded.flashes).toBe(false);
    });

    it('both on (the old defaults) changes nothing', () => {
        const loaded = load({ animations: true, vfx: true });
        expect(loaded.battleSpeed).toBe('showy');
        expect(loaded.flashes).toBe(true);
    });

    it('never overrides a tier the player already chose on the new build', () => {
        expect(load({ animations: false, battleSpeed: 'slow' }).battleSpeed).toBe('slow');
        expect(load({ vfx: false, flashes: true }).flashes).toBe(true);
    });

    it('keeps the unrelated settings in the same blob', () => {
        const loaded = load({ animations: false, particles: false, textScale: 1.3 });
        expect(loaded.particles).toBe(false);
        expect(loaded.textScale).toBe(1.3);
    });
});

describe('146a — reduced motion overrules the switches', () => {
    afterEach(() => setReducedMotionOverride(null));

    it('maps to particles off, animations off, hit-stop off, no shake, vfx flashes-only', () => {
        // §2a's mapping, exactly. `flashes` rather than `off` because a flash has no motion in it —
        // it keeps the feedback that says WHICH unit was hit while declining all the movement.
        const gates = resolveVfxGates({ ...DEFAULT_SETTINGS }, true);
        expect(gates).toEqual({
            particles: false, animations: false, vfx: 'flashes', hitStop: false, shake: 0, flashes: true,
        });
    });

    it('overrules switches that are stored ON, rather than sitting beside them', () => {
        const gates = resolveVfxGates(
            { ...DEFAULT_SETTINGS, particles: true, hitStop: true, screenShake: 100 }, true,
        );
        expect(gates.particles).toBe(false);
        expect(gates.animations).toBe(false);
        expect(gates.hitStop).toBe(false);
        expect(gates.shake).toBe(0);
    });

    it('can only ever turn things further off — a switch off stays off without it', () => {
        const gates = resolveVfxGates({ ...DEFAULT_SETTINGS, particles: false }, false);
        expect(gates).toEqual({
            particles: false, animations: true, vfx: 'full', hitStop: true, shake: 0.6, flashes: true,
        });
    });

    it('turns the flashes switch off even under reduced motion, because it is the player\'s own', () => {
        expect(resolveVfxGates({ ...DEFAULT_SETTINGS, flashes: false }, true).flashes).toBe(false);
    });

    it('Instant runs nothing: no particles, no animation, no effects, no freeze, no shake, no flash', () => {
        const gates = resolveVfxGates({ ...DEFAULT_SETTINGS, battleSpeed: 'instant' }, false);
        expect(gates).toEqual({
            particles: false, animations: false, vfx: 'off', hitStop: false, shake: 0, flashes: false,
        });
    });

    it('turns the hit-stop and the shake off on their own switches', () => {
        const gates = resolveVfxGates({ ...DEFAULT_SETTINGS, hitStop: false, screenShake: 0 }, false);
        expect(gates.hitStop).toBe(false);
        expect(gates.shake).toBe(0);
    });

    it('turns the shake slider into a 0-1 strength', () => {
        expect(resolveVfxGates({ ...DEFAULT_SETTINGS, screenShake: 100 }, false).shake).toBe(1);
        expect(resolveVfxGates({ ...DEFAULT_SETTINGS, screenShake: 30 }, false).shake).toBeCloseTo(0.3);
    });

    it('reads the player override through prefersReducedMotion when not told', () => {
        setReducedMotionOverride(true);
        expect(resolveVfxGates({ ...DEFAULT_SETTINGS }).particles).toBe(false);
        setReducedMotionOverride(false);
        expect(resolveVfxGates({ ...DEFAULT_SETTINGS }).particles).toBe(true);
    });

    it('stamps the resolved particles gate on the document, and no data-vfx or data-animations at all', () => {
        const root = document.createElement('div');
        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'on', particles: true }, root);

        expect(root.getAttribute('data-particles')).toBe('off');
        expect(root.hasAttribute('data-animations')).toBe(false);
        expect(root.hasAttribute('data-vfx')).toBe(false);
    });

    it('stamps the switch itself when motion is not reduced', () => {
        const root = document.createElement('div');
        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'off', particles: false }, root);

        expect(root.getAttribute('data-particles')).toBe('off');
    });
});

describe('159c \u2014 the enemy hand switch', () => {
    it('defaults ON, and an older settings blob parses into ON rather than OFF', () => {
        /*
         * 159 exists to close a visibility gap, and a telegraph nobody can see closes nothing \u2014 so
         * a player who stored their settings before this field existed keeps the behaviour 159b
         * shipped, not the opposite of it.
         */
        expect(DEFAULT_SETTINGS.showEnemyHand).toBe(true);

        const storage = makeMockStorage({
            [SETTINGS_STORAGE_KEY]: JSON.stringify({ reducedMotion: 'system', textScale: 1 }),
        });
        expect(loadSettings(storage).showEnemyHand).toBe(true);
    });

    it('stamps the document, so flipping it reaches the fight already on screen', () => {
        /*
         * The settings screen is an OVERLAY on the battle, not a route away from it \u2014 the fight
         * stays mounted underneath. A read-once-per-mount component would leave the tab on screen
         * until the next fight, and watching the switch do nothing is the one failure a player is
         * guaranteed to notice, because watching it work is why they flipped it.
         */
        const root = document.createElement('div');

        applySettings({ ...DEFAULT_SETTINGS, showEnemyHand: false }, root);
        expect(root.getAttribute('data-enemy-hand')).toBe('off');

        applySettings({ ...DEFAULT_SETTINGS, showEnemyHand: true }, root);
        expect(root.getAttribute('data-enemy-hand')).toBe('on');
    });

    it('is NOT overruled by reduced motion, unlike the three beside it', () => {
        /*
         * The 146a switches are overruled on purpose: a player who asked their OS for less motion
         * has said something about their body. This one is not movement \u2014 it is information, and
         * taking it away on the same signal would be a different decision made on their behalf.
         */
        const root = document.createElement('div');
        applySettings({ ...DEFAULT_SETTINGS, reducedMotion: 'on', showEnemyHand: true }, root);

        expect(root.getAttribute('data-particles')).toBe('off');
        expect(root.getAttribute('data-enemy-hand')).toBe('on');
    });

    it('round-trips through a restart like every other setting', () => {
        const storage = makeMockStorage();
        saveSettings({ ...DEFAULT_SETTINGS, showEnemyHand: false }, storage);
        expect(loadSettings(makeMockStorage(storage.data)).showEnemyHand).toBe(false);
    });
});
