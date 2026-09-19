// @vitest-environment jsdom
/**
 * TICKET 155a — the cast sequence survives the render that a play causes.
 *
 * This is the test that should have existed when 146c shipped. Without it, every row of 146 was
 * dead in the real game and the entire suite was green, because nothing anywhere re-rendered a
 * battle component between a `PROGRAM_PLAYED` and the frame that was supposed to act on it.
 *
 * The shape of the bug, for whoever reads this next:
 *
 *   dispatch → reducer emits PROGRAM_PLAYED synchronously → the handler opens a cast window and
 *   arms setTimeout(…, 0) → dispatch returns a NEW state object → React re-renders → the effect's
 *   dependency changed, so CLEANUP RUNS FIRST and nulls the window → the 0ms closure finds nothing.
 *
 * So the re-render between the emit and the timer is not decoration in these tests. It IS the test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import { globalBattleEventBus } from '../../engine/events';
import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { setParticleSink, setStageAnchors } from './emit';
import { useCastSequence } from './useCastSequence';
import type { ParticleSeed } from './particles';
import type { IBattleState } from '../../engine/types';
import type { StageAnchors } from '../hooks/useStageAnchors';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STATE = {
    playerParty: [{ id: 'ally', name: 'Ally', maxHp: 100, currentHp: 100, primaryElement: 'Fire', secondaryElement: 'None', statusEffects: [], daemons: [] }],
    enemyParty: [{ id: 'foe', name: 'Foe', maxHp: 100, currentHp: 100, primaryElement: 'Nature', secondaryElement: 'None', statusEffects: [], daemons: [] }],
} as unknown as IBattleState;

const rect = (x: number) => ({ x, y: 100, w: 190, h: 190 });
const ANCHORS = {
    slots: { ally: rect(100), foe: rect(900) },
    plaques: { ally: rect(20), foe: rect(1100) },
    reveal: rect(500), hand: rect(500), discard: rect(800), scale: 1,
} as unknown as StageAnchors;

const Harness: React.FC<{ nonce?: number }> = ({ nonce = 0 }) => {
    // A fresh object per render, exactly as the reducer produces.
    useCastSequence({ ...STATE, __nonce: nonce } as unknown as IBattleState);
    return null;
};

let container: HTMLDivElement;
let root: Root;
let spawned: ParticleSeed[][] = [];

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    spawned = [];
    setStageAnchors(ANCHORS);
    setParticleSink({ spawn: (seeds) => spawned.push([...seeds]), wake: () => undefined });
    vi.useFakeTimers();
    container = document.createElement('div');
    root = createRoot(container);
    act(() => { root.render(<Harness />); });
});

afterEach(() => {
    act(() => { root.unmount(); });
    vi.useRealTimers();
    setParticleSink(null);
    setStageAnchors(null);
    localStorage.clear();
});

/** One cast, as the reducer emits it: everything in a single synchronous burst. */
const cast = () => {
    act(() => {
        globalBattleEventBus.emit({
            type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe',
            programId: 'cinder_slash', timestamp: Date.now(),
        });
        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN', targetId: 'foe', amount: 20, element: 'Fire', cause: 'attack',
            damage: { raw: 20, absorbed: 0, applied: 20 } as never, timestamp: Date.now(),
        });
    });
};

describe('155a — a cast survives the re-render it causes', () => {
    it('still fires a trail after the state object is replaced mid-cast', () => {
        cast();
        // The render the dispatch causes, landing between the emit and the 0ms window close.
        act(() => { root.render(<Harness nonce={1} />); });

        act(() => { vi.advanceTimersByTime(600); });

        expect(spawned.length).toBeGreaterThan(0);
    });

    it('fires the trail even with several renders stacked on top of the cast', () => {
        // A 3v3 turn re-renders more than once per play — the AI's own dispatches, the turn banner,
        // the hand refill. One survived render is not proof; several is.
        cast();
        for (let i = 1; i <= 4; i += 1) {
            act(() => { root.render(<Harness nonce={i} />); });
        }

        act(() => { vi.advanceTimersByTime(600); });
        expect(spawned.length).toBeGreaterThan(0);
    });

    it('still knows who was hit, which is read through the ref', () => {
        // `findEntity` used to close over the render's `battleState`. Reading it through the ref is
        // what keeps the effectiveness decomposition (and therefore the ring) correct after a
        // re-render — a cast that survived but could no longer find its target would be a quieter
        // version of the same bug.
        cast();
        act(() => { root.render(<Harness nonce={9} />); });
        act(() => { vi.advanceTimersByTime(600); });

        const all = spawned.flat();
        expect(all.length).toBeGreaterThan(0);
        // The trail head leaves the caster's slot and heads for the target's.
        expect(all.some((seed) => seed.path !== undefined)).toBe(true);
    });

    it('is silent with vfx switched off, re-render or not', () => {
        act(() => { root.unmount(); });
        saveSettings({ ...DEFAULT_SETTINGS, vfx: false });
        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Harness />); });

        cast();
        act(() => { root.render(<Harness nonce={1} />); });
        act(() => { vi.advanceTimersByTime(600); });

        expect(spawned).toHaveLength(0);
    });
});
