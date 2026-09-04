/**
 * THE WAY OUT, AND THE BUILD THAT HAS ONE — the 2026-08-30 playtest.
 *
 * Henry: *"Only way to exit is the window X button."* Two things have to hold for the fix, and they
 * pull in opposite directions:
 *
 *  1. the desktop build quits when asked, and
 *  2. the web build never renders a button that cannot do anything.
 *
 * (2) is the one worth a test. `SettingsScreen` reads `canQuit()` once at mount and omits the whole
 * section on false, so a wrong answer here is not a broken button — it is a button that swallows a
 * click and leaves the player thinking the game ignored them, which is the bug being fixed.
 *
 * The bridge is stubbed rather than mocked: `desktopBridge()` reads `window.mingmingDesktop` and
 * checks `isDesktop`, and stubbing the global is what a preload actually does.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canQuit, quitGame } from './quitGame';

/** The preload's surface, as much of it as `desktopBridge()` looks at. */
const bridge = (extra: Record<string, unknown> = {}) => ({
    mingmingDesktop: { isDesktop: true, ...extra },
});

afterEach(() => vi.unstubAllGlobals());

describe('quitting', () => {
    it('is not offered when there is no desktop bridge — the web build', () => {
        vi.stubGlobal('window', {});
        expect(canQuit()).toBe(false);
        expect(quitGame()).toBe(false);
    });

    it('is not offered by a desktop build whose preload predates it', () => {
        // A packaged app ships its own preload, so renderer-newer-than-app is a real state and the
        // bridge member is optional for exactly this reason. It must degrade to "no button".
        vi.stubGlobal('window', bridge());
        expect(canQuit()).toBe(false);
        expect(quitGame()).toBe(false);
    });

    it('is offered, and fires exactly once, when the bridge carries it', () => {
        const quit = vi.fn();
        vi.stubGlobal('window', bridge({ quit }));

        expect(canQuit()).toBe(true);
        expect(quitGame()).toBe(true);
        expect(quit).toHaveBeenCalledTimes(1);
    });
});
