// @vitest-environment jsdom
/**
 * TICKET 190a — the settings reach the battle clock.
 *
 * `applySettings` pushes the tier and catch-up into the clock's speed inputs; the key handler pushes
 * the fast-forward flag; a backlog source supplies "queued". The clock asks for the multiplier every
 * frame, so changing any of them takes effect on the next frame with nothing re-mounted.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, applySettings } from '../../settings/settings';
import { setReducedMotionOverride } from '../../utils/motionPrefs';
import { battleClock, patchBattleSpeedInputs, resetBattleClock, setCatchUpSource } from './battleClockRuntime';
import { INSTANT } from './speedPolicy';

afterEach(() => {
    resetBattleClock();
    setCatchUpSource(null);
    setReducedMotionOverride(null);
});

describe('190a — settings -> clock speed', () => {
    it('Showy runs at 1', () => {
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'showy' }, document.createElement('div'));
        expect(battleClock.multiplier).toBe(1);
    });

    it('Fast runs at 2 and Instant at Infinity', () => {
        const root = document.createElement('div');
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'fast' }, root);
        expect(battleClock.multiplier).toBe(2);
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'instant' }, root);
        expect(battleClock.multiplier).toBe(INSTANT);
    });

    it('x3 while fast-forward is held, back to the tier when it is let go', () => {
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'snappy' }, document.createElement('div'));
        patchBattleSpeedInputs({ fastForward: true });
        expect(battleClock.multiplier).toBe(3);
        patchBattleSpeedInputs({ fastForward: false });
        expect(battleClock.multiplier).toBe(1);
    });

    it('catch-up reads the live backlog every frame, and the catch-up switch', () => {
        const root = document.createElement('div');
        let queued = 0;
        setCatchUpSource(() => queued);
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'showy', catchUp: true }, root);
        expect(battleClock.multiplier).toBe(1);
        queued = 2;
        expect(battleClock.multiplier).toBeCloseTo(1.4);
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'showy', catchUp: false }, root);
        expect(battleClock.multiplier).toBe(1);
    });

    it('reduced motion does not change the clock speed: it removes movement, not time', () => {
        setReducedMotionOverride(true);
        applySettings({ ...DEFAULT_SETTINGS, battleSpeed: 'showy' }, document.createElement('div'));
        expect(battleClock.multiplier).toBe(1);
    });

    it('resetBattleClock lets go of the held key and the backlog', () => {
        patchBattleSpeedInputs({ fastForward: true });
        resetBattleClock();
        expect(battleClock.multiplier).toBe(1);
    });
});
