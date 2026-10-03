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
import { battleClock, resetBattleClock } from './clock/battleClockRuntime';
import { useCastSequence } from './useCastSequence';
import * as statusTellsModule from './statusTells';
import * as osTellsModule from './osTells';
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

/**
 * TICKET 189b: the sequence plays on the BATTLE CLOCK now, not on setTimeout. `advance(ms)` closes
 * the collector's burst window (the one real 0 ms timer left) and then moves game time.
 */
const advance = (ms: number): void => {
    act(() => {
        vi.advanceTimersByTime(0);
        battleClock.advance(ms);
    });
};

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
    resetBattleClock();
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

        advance(600);

        expect(spawned.length).toBeGreaterThan(0);
    });

    it('fires the trail even with several renders stacked on top of the cast', () => {
        // A 3v3 turn re-renders more than once per play — the AI's own dispatches, the turn banner,
        // the hand refill. One survived render is not proof; several is.
        cast();
        for (let i = 1; i <= 4; i += 1) {
            act(() => { root.render(<Harness nonce={i} />); });
        }

        advance(600);
        expect(spawned.length).toBeGreaterThan(0);
    });

    it('still knows who was hit, which is read through the ref', () => {
        // `findEntity` used to close over the render's `battleState`. Reading it through the ref is
        // what keeps the effectiveness decomposition (and therefore the ring) correct after a
        // re-render — a cast that survived but could no longer find its target would be a quieter
        // version of the same bug.
        cast();
        act(() => { root.render(<Harness nonce={9} />); });
        advance(600);

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
        advance(600);

        expect(spawned).toHaveLength(0);
    });
});

describe('155 deep dive 9 — a death plays at the slot', () => {
    /**
     * `BattleStage.test` has asserted since 145 that a dead unit KEEPS its anchor, *"because 146
     * plays the death FX at the slot"*. 146 shipped with no death branch and no recipe: the
     * scaffold was tested and the thing was never built, which is the same shape as the two
     * dead-on-arrival defects 155a fixed.
     */
    const lethalHit = (applied: number) => {
        act(() => {
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'foe', amount: applied, element: 'Fire',
                cause: 'attack',
                damage: { raw: applied, absorbed: 0, applied } as never, timestamp: Date.now(),
            });
        });
    };

    it('fires when the hit is at or past the target\'s remaining HP', () => {
        // STATE's foe is at 100/100, so 100 is exactly lethal — the boundary, because `>=` versus
        // `>` here is the difference between a kill with no death FX and one with.
        lethalHit(100);
        advance(0);                         // 189b: a death with no card is a beat, queued at the burst's end
        expect(spawned.flat().length).toBeGreaterThan(0);
    });

    it('stays quiet on a hit the unit survives', () => {
        // Otherwise every scratch would play a death, which is worse than none: the tell would stop
        // meaning a body has left the board.
        lethalHit(30);
        advance(0);
        expect(spawned.flat()).toHaveLength(0);
    });

    it('fires all status tells for one status at the same moment across mingmings', () => {
        const spy = vi.spyOn(statusTellsModule, 'emitStatusApplied').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({
                type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe',
                programId: 'cinder_slash', timestamp: Date.now(),
            });
            // 6 STATUS_APPLIED: Sharp on three ally ids (repeated twice)
            const allies = ['ally', 'ally2', 'ally3'];
            for (let i = 0; i < 6; i++) {
                globalBattleEventBus.emit({
                    type: 'STATUS_APPLIED', targetId: allies[i % 3], status: 'Sharp',
                    stacks: 2, timestamp: Date.now(),
                });
            }
        });
        // Close the window at 0ms
        advance(0);

        // Advance to last impact + 60ms (180 flight + 240 trail + 60 stagger = 480ms)
        advance(480);
        expect(spy).toHaveBeenCalledTimes(3);
        expect(spy).toHaveBeenCalledWith('Sharp', 'ally');
        expect(spy).toHaveBeenCalledWith('Sharp', 'ally2');
        expect(spy).toHaveBeenCalledWith('Sharp', 'ally3');

        // Nothing fires at +120ms (another 60ms)
        advance(60);
        expect(spy).toHaveBeenCalledTimes(3);
        spy.mockRestore();
    });
});

describe('171f — a hook\'s status is its own beat, after the card', () => {
    // Henry, 2026-09-30: "Its own animation that shows the status being added after the card."
    // EMBER_FUSE's Burn used to merge into Ember Jab's own Burn tell; its OS tell played at arrival,
    // during the card's flight, before anything had landed.
    it('plays the card\'s Burn with the card, then the fuse tell and its Burn one beat later', () => {
        const statusSpy = vi.spyOn(statusTellsModule, 'emitStatusApplied').mockImplementation(() => undefined);
        const hookSpy = vi.spyOn(osTellsModule, 'emitHookTell').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({
                type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe', programId: 'ember_jab', timestamp: Date.now(),
            });
            // The engine's order: the swing, the fuse's Burn, the fuse's HOOK_FIRED, the card's Burn.
            globalBattleEventBus.emit({
                type: 'STATUS_APPLIED', targetId: 'foe', status: 'Burn', stacks: 1, timestamp: Date.now(),
                source: { kind: 'os', id: 'skoll_v2', ownerId: 'ally', hookId: 'skoll_v2_ember_fuse' },
            });
            globalBattleEventBus.emit({
                type: 'HOOK_FIRED', osId: 'skoll_v2', hookId: 'skoll_v2_ember_fuse', ownerId: 'ally',
                trigger: 'onPostDamage', timestamp: Date.now(),
            });
            globalBattleEventBus.emit({
                type: 'STATUS_APPLIED', targetId: 'foe', status: 'Burn', stacks: 1, timestamp: Date.now(),
                source: { kind: 'card', id: 'ember_jab', ownerId: 'ally' },
            });
        });
        // Not at arrival.
        expect(hookSpy).not.toHaveBeenCalled();

        advance(0);
        // The card: flight 180 + trail 220 + one status 60 = 460.
        advance(460);
        expect(statusSpy).toHaveBeenCalledTimes(1);
        expect(statusSpy).toHaveBeenLastCalledWith('Burn', 'foe');
        expect(hookSpy).not.toHaveBeenCalled();

        // The fuse, 200 ms later: its tell, then its Burn as a stack added.
        advance(200);
        expect(hookSpy).toHaveBeenCalledTimes(1);
        expect(hookSpy.mock.calls[0][1]).toBe('skoll_v2');
        expect(statusSpy).toHaveBeenCalledTimes(2);
        expect(statusSpy).toHaveBeenLastCalledWith('Burn', 'foe', true);

        statusSpy.mockRestore();
        hookSpy.mockRestore();
    });

    it('plays a hook that applied no status as the card starts (189b: no longer at arrival)', () => {
        const hookSpy = vi.spyOn(osTellsModule, 'emitHookTell').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({
                type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe', programId: 'ember_jab', timestamp: Date.now(),
            });
            globalBattleEventBus.emit({
                type: 'HOOK_FIRED', osId: 'kraken_v2', hookId: 'some_damage_hook', ownerId: 'ally',
                trigger: 'onPowerCalculated', timestamp: Date.now(),
            });
        });
        // 146g wanted it linked to its cause. It is: it plays with the card that fired it, which for
        // the first cast of a burst is the moment the burst closes, and for the fifth is when the
        // fifth begins (see presenter.test).
        advance(0);
        expect(hookSpy).toHaveBeenCalledTimes(1);
        hookSpy.mockRestore();
    });
});
