// @vitest-environment jsdom
/**
 * TICKET 198 follow-up — THE LAYER DRAWS STRAIGHT ONTO ITS OWN CANVAS.
 *
 * 198b-1 drew every frame onto an offscreen canvas and then copied the whole stage-sized bitmap onto
 * the layer's canvas (`FxCompositor`). The copy was pixel-for-pixel what drawing additively onto the
 * layer's own transparent canvas gives (the browser lays that canvas over the stage in ordinary
 * blending anyway), and it cost a stage-sized `drawImage` every frame the effects were alive: about
 * 900 ms of a 3.5 s big hit in a profile, against about 90 ms for every particle sprite together,
 * and four times worse at a device pixel ratio of 2. That is the stutter on big hits.
 *
 * The seam is the draw calls themselves: with a stage-sized box, the only bitmaps the layer may
 * stamp are the glow sprites (64 px). A stage-sized source is the bug.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { emitEffect } from './emit';
import { resetBattleClock } from './clock/battleClockRuntime';
import ParticleLayer from './ParticleLayer';
import type { StageAnchors } from '../hooks/useStageAnchors';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ANCHORS = { slots: {}, plaques: {}, reveal: { x: 0, y: 0, w: 1, h: 1 }, hand: { x: 0, y: 0 }, discard: { x: 0, y: 0 }, scale: 1 } as unknown as StageAnchors;

/** The glow sprite's edge (`SIZE` in `glowTexture.ts`). */
const SPRITE_PX = 64;
const STAGE = { width: 800, height: 450 };

let container: HTMLDivElement;
let root: Root;
let frames: Array<(t: number) => void> = [];
let time = 1_000;
/** The width of the source of every `drawImage` the layer made. */
let sourceWidths: number[] = [];

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    frames = [];
    time = 1_000;
    sourceWidths = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...STAGE, x: 0, y: 0, top: 0, left: 0, right: STAGE.width, bottom: STAGE.height, toJSON: () => ({}) });
    const ctx = new Proxy({}, {
        get: (_target, name) => {
            if (name === 'drawImage') return (source: { width: number }) => { sourceWidths.push(source.width); };
            if (name === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
            return () => undefined;
        },
        set: () => true,
    });
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

const tick = (ms: number): void => {
    time += ms;
    const run = frames;
    frames = [];
    for (const cb of run) cb(time);
};

describe('198 — no stage-sized copy per frame', () => {
    it('stamps glow sprites and nothing as big as the stage while an effect is alive', () => {
        emitEffect({
            durationMs: 200,
            step: (_age, _dt, spawn) => { spawn([{ x: 100, y: 100, vx: 0, vy: 0, life: 400, size: 12, r: 255, g: 120, b: 40, shape: 'glow' }]); },
            draw: () => undefined,
        });
        tick(16);
        tick(16);
        tick(16);

        // Not vacuous: the sprites really were stamped.
        expect(sourceWidths.length).toBeGreaterThan(0);
        // A canvas the size of the stage is the offscreen copy; the layer's canvas is the one thing
        // sized to it, and it is drawn on, never drawn from.
        expect(Math.max(...sourceWidths)).toBeLessThanOrEqual(SPRITE_PX);
    });
});
