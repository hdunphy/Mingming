// @vitest-environment jsdom
/**
 * TICKET 190g - the camera zoom and the stage dim are WRITTEN to their elements from the battle clock,
 * and put back exactly when they are done.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetBattleClock } from '../clock/battleClockRuntime';
import { dimKeys } from '../choreo/bigHit';
import { attachCamera, attachDim, cameraPunch, resetImpactFx, stageDim, wakeImpactFx } from './impactRuntime';

let frames: Array<(t: number) => void> = [];
let time = 1_000;
const tick = (ms: number): void => {
    time += ms;
    const run = frames;
    frames = [];
    for (const cb of run) cb(time);
};
const tickFor = (ms: number): void => { for (let left = ms; left > 0; left -= 16) tick(16); };

beforeEach(() => {
    frames = [];
    time = 1_000;
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
});
afterEach(() => {
    resetImpactFx();
    resetBattleClock();
    vi.unstubAllGlobals();
});

describe('190g - the camera zoom is written to the stage and cleared at 1', () => {
    it('sets the scale while it zooms, and clears the property when it is done', () => {
        const camera = { style: { translate: '', rotate: '', scale: '' } };
        const detach = attachCamera(camera);
        cameraPunch.punch(0.03);
        wakeImpactFx();
        tick(16);
        tick(16);
        expect(Number(camera.style.scale)).toBeGreaterThan(1);
        expect(Number(camera.style.scale)).toBeLessThanOrEqual(1.03);
        tickFor(600);
        expect(camera.style.scale).toBe('');
        expect(cameraPunch.active).toBe(false);
        detach();
    });

    it('detaching puts the picture back', () => {
        const camera = { style: { translate: '', rotate: '', scale: '' } };
        const detach = attachCamera(camera);
        cameraPunch.punch(0.03);
        wakeImpactFx();
        tick(16);
        tick(16);
        detach();
        expect(camera.style.scale).toBe('');
    });
});

describe('190g - the stage dim is written to its layer', () => {
    const game = { windupEndMs: 100, impactMs: 300, knockbackEndMs: 400 };

    it('darkens across the wind-up and is back to 0 after the knock-back', () => {
        const layer = { style: { opacity: '0' } };
        const detach = attachDim(layer);
        stageDim.run(dimKeys(game, 1));
        wakeImpactFx();
        tickFor(120);
        expect(Number(layer.style.opacity)).toBeGreaterThan(0.3);
        expect(Number(layer.style.opacity)).toBeLessThanOrEqual(0.4);
        tickFor(600);
        expect(layer.style.opacity).toBe('0');
        detach();
    });

    it('a reset (leaving the fight) clears it at once', () => {
        const layer = { style: { opacity: '0' } };
        const detach = attachDim(layer);
        stageDim.run(dimKeys(game, 1));
        wakeImpactFx();
        tickFor(80);
        expect(Number(layer.style.opacity)).toBeGreaterThan(0);
        resetImpactFx();
        expect(layer.style.opacity).toBe('0');
        expect(stageDim.active).toBe(false);
        detach();
    });
});
