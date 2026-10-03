// @vitest-environment jsdom
/**
 * TICKET 189a — the particle layer steps by the BATTLE CLOCK, not by its own rAF and not by
 * `isHitStopped`.
 *
 * Two properties matter: a freeze holds every particle in place (the stop used to be able to do
 * that and nothing else, and it fired before any particle existed), and the layer parks the one
 * driver loop when the last particle dies.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { emit } from './emit';
import { battleClock, resetBattleClock } from './clock/battleClockRuntime';
import { ParticleField } from './particles';
import ParticleLayer from './ParticleLayer';
import type { StageAnchors } from '../hooks/useStageAnchors';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ANCHORS = { slots: {}, plaques: {}, reveal: { x: 0, y: 0, w: 1, h: 1 }, hand: { x: 0, y: 0 }, discard: { x: 0, y: 0 }, scale: 1 } as unknown as StageAnchors;

let container: HTMLDivElement;
let root: Root;
let frames: Array<(t: number) => void> = [];
let time = 1_000;

/** One animation frame, `ms` after the last. */
const tick = (ms: number): void => {
    time += ms;
    const run = frames;
    frames = [];
    for (const cb of run) cb(time);
};

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    frames = [];
    time = 1_000;
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
    // jsdom has no canvas; a context that accepts every call is all the layer needs.
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<ParticleLayer anchors={ANCHORS} />); });
});

afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    resetBattleClock();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const burst = (): void => emit('spark', { x: 10, y: 10 }, { intensity: 6, rng: () => 0.5 });

describe('189a — the layer rides the clock', () => {
    it('steps the field by the clock delta', () => {
        const step = vi.spyOn(ParticleField.prototype, 'step');
        burst();
        tick(16);
        tick(32);
        expect(step.mock.calls.map((c) => c[0])).toEqual([16, 32]);
    });

    it('steps by ZERO while a hit-stop stands, so every particle holds still', () => {
        const step = vi.spyOn(ParticleField.prototype, 'step');
        burst();
        tick(16);
        battleClock.freeze(60);
        tick(16);
        tick(16);
        tick(16);                           // 48 of the 60 ms eaten, still frozen
        tick(16);                           // the last 12 ms of the freeze, then 4 live
        expect(step.mock.calls.map((c) => c[0])).toEqual([16, 0, 0, 0, 4]);
    });

    it('parks the one loop when the last particle dies', () => {
        burst();
        for (let i = 0; i < 400 && frames.length > 0; i += 1) tick(50);
        expect(frames).toHaveLength(0);
    });

    it('wakes the loop again on the next burst', () => {
        burst();
        for (let i = 0; i < 400 && frames.length > 0; i += 1) tick(50);
        expect(frames).toHaveLength(0);
        burst();
        expect(frames).toHaveLength(1);
    });
});
