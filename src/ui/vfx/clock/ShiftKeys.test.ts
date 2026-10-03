/**
 * TICKET 190a — Right Shift fast-forwards, Left Shift keeps targeting allies (Henry, 2026-10-03).
 *
 * The browser tells the two apart with `KeyboardEvent.code` (`ShiftLeft` / `ShiftRight`); `shiftKey`
 * alone cannot. This class only remembers which of them is down, and answers one question for the
 * battle's key handler: is this Shift an ALLY-targeting Shift?
 */
import { describe, expect, it, vi } from 'vitest';

import { ShiftKeys } from './ShiftKeys';

const key = (code: string, shiftKey = true) => ({ code, shiftKey });

describe('190a — ShiftKeys', () => {
    it('Right Shift down is fast-forward, up is not', () => {
        const changes: boolean[] = [];
        const keys = new ShiftKeys((held) => changes.push(held));
        keys.keyDown(key('ShiftRight'));
        expect(keys.fastForwardHeld).toBe(true);
        keys.keyUp(key('ShiftRight', false));
        expect(keys.fastForwardHeld).toBe(false);
        expect(changes).toEqual([true, false]);
    });

    it('Left Shift never fast-forwards', () => {
        const onChange = vi.fn();
        const keys = new ShiftKeys(onChange);
        keys.keyDown(key('ShiftLeft'));
        expect(keys.fastForwardHeld).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not repeat the callback for key auto-repeat', () => {
        const onChange = vi.fn();
        const keys = new ShiftKeys(onChange);
        keys.keyDown(key('ShiftRight'));
        keys.keyDown(key('ShiftRight'));
        keys.keyDown(key('ShiftRight'));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('treats Shift+W with Left Shift as the ally modifier', () => {
        const keys = new ShiftKeys(() => undefined);
        keys.keyDown(key('ShiftLeft'));
        expect(keys.isAllyModifier({ shiftKey: true })).toBe(true);
    });

    it('does NOT treat Right Shift alone as the ally modifier', () => {
        const keys = new ShiftKeys(() => undefined);
        keys.keyDown(key('ShiftRight'));
        expect(keys.isAllyModifier({ shiftKey: true })).toBe(false);
    });

    it('treats both Shifts together as the ally modifier: the player asked for targeting', () => {
        const keys = new ShiftKeys(() => undefined);
        keys.keyDown(key('ShiftRight'));
        keys.keyDown(key('ShiftLeft'));
        expect(keys.isAllyModifier({ shiftKey: true })).toBe(true);
    });

    it('falls back to the event\'s own shiftKey when it never saw a Shift go down', () => {
        // Focus arrived with Shift already held, or a test sends a bare shiftKey: the old behaviour.
        const keys = new ShiftKeys(() => undefined);
        expect(keys.isAllyModifier({ shiftKey: true })).toBe(true);
        expect(keys.isAllyModifier({ shiftKey: false })).toBe(false);
    });

    it('is no ally modifier once Shift is released, even if a stale shiftKey says otherwise', () => {
        const keys = new ShiftKeys(() => undefined);
        keys.keyDown(key('ShiftLeft'));
        keys.keyUp(key('ShiftLeft', false));
        expect(keys.isAllyModifier({ shiftKey: false })).toBe(false);
    });

    it('lets go of everything when the window loses focus, so fast-forward cannot stick on', () => {
        const changes: boolean[] = [];
        const keys = new ShiftKeys((held) => changes.push(held));
        keys.keyDown(key('ShiftRight'));
        keys.reset();
        expect(keys.fastForwardHeld).toBe(false);
        expect(changes).toEqual([true, false]);
    });

    it('ignores every other key', () => {
        const onChange = vi.fn();
        const keys = new ShiftKeys(onChange);
        keys.keyDown(key('KeyW'));
        keys.keyUp(key('KeyW'));
        expect(onChange).not.toHaveBeenCalled();
    });
});
