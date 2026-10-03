// @vitest-environment jsdom
/**
 * TICKET 146e — what the subscriber does with each `cause`.
 *
 * `hitStop.test.ts` covers the curve. This covers the gate, which is where the row can actually
 * hurt the game: a Poison deck whose every tick froze the screen and shook the board would be
 * unplayable, and no other test in the repo would notice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useAnimation } from 'framer-motion';

import { globalBattleEventBus, type DamageCause } from '../../engine/events';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, saveSettings } from '../settings/settings';
import { battleClock, resetBattleClock } from './clock/battleClockRuntime';
import { isHitStopped } from './hitStop';
import { useImpactFeedback } from './useImpactFeedback';
import type { IBattleState } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
// React only accepts `act` from a runner that says it is one. Same declaration `ErrorBoundary.test`
// uses; without it every `act` here logs a warning and the assertions still pass, which is worse.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** One 100 HP ally, unhurt. Enough for `maxHp` and the lethal check; nothing else is read. */
const STATE = {
    playerParty: [{ id: 'ally', maxHp: 100, currentHp: 100 }],
    enemyParty: [{ id: 'foe', maxHp: 100, currentHp: 100 }],
} as unknown as IBattleState;

/**
 * A fresh state object per render, which is what the reducer actually hands back.
 *
 * TICKET 155a: the version of this harness that shipped passed `STATE` — one constant object — and
 * never re-rendered. That is why the suite was green while 146e had never once produced a hit-stop
 * in a real fight: `[battleState]` tore the subscription down on the re-render the dispatch caused,
 * and its cleanup cancelled the stop that the same dispatch had just requested.
 *
 * `nonce` exists to force a new object identity, exactly as a play does.
 */
const Harness: React.FC<{ nonce?: number }> = ({ nonce = 0 }) => {
    const state = { ...STATE, __nonce: nonce } as unknown as IBattleState;
    useImpactFeedback(state, useAnimation());
    return null;
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    resetBattleClock();
    container = document.createElement('div');
    root = createRoot(container);
    act(() => { root.render(<Harness />); });
});

afterEach(() => {
    act(() => { root.unmount(); });
    resetBattleClock();
    localStorage.clear();
});

const hit = (cause: DamageCause | undefined, applied: number, targetId = 'ally') => {
    act(() => {
        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN', targetId, amount: applied, element: 'None', cause,
            damage: { raw: applied, absorbed: 0, applied } as never, timestamp: Date.now(),
        });
    });
};

describe('146e — which damage earns a stop', () => {
    it('stops on an attack', () => {
        hit('attack', 20);
        expect(isHitStopped()).toBe(true);
    });

    it('NEVER stops on a status tick', () => {
        // 146e, in as many words: *"Never on `cause: 'status'`."* This is the line that keeps a
        // damage-over-time deck playable.
        hit('status', 40);
        expect(isHitStopped()).toBe(false);
    });

    it('never stops on a recoil or a toll', () => {
        // Prices the caster pays, not hits it took. 146f draws both as a red pulse on the caster.
        hit('recoil', 30);
        expect(isHitStopped()).toBe(false);
        hit('toll', 30);
        expect(isHitStopped()).toBe(false);
    });

    it('treats an absent cause as an attack, which is what it was before 146b', () => {
        hit(undefined, 20);
        expect(isHitStopped()).toBe(true);
    });

    it('does not stop on a fully absorbed hit', () => {
        // Nothing reached HP, so there was no impact to weight — the shield float is the feedback.
        act(() => {
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'ally', amount: 0, element: 'None', cause: 'attack',
                damage: { raw: 12, absorbed: 12, applied: 0 } as never, timestamp: Date.now(),
            });
        });
        expect(isHitStopped()).toBe(false);
    });

    it('ignores everything that is not damage', () => {
        act(() => {
            globalBattleEventBus.emit({ type: 'TURN_START', turnNumber: 2, activeSide: 'PLAYER', timestamp: 0 });
        });
        expect(isHitStopped()).toBe(false);
    });
});

describe('155a — the subscription survives the render a play causes', () => {
    it('still stops on a hit AFTER the state object has been replaced', () => {
        /*
         * THE REGRESSION TEST FOR THE BUG THAT MADE 146 DEAD ON ARRIVAL.
         *
         * A play dispatches, the reducer emits synchronously, and React re-renders with a new state
         * object. If this hook is keyed on that object, the effect's cleanup runs between the
         * request and the next frame and undoes it. Re-rendering BEFORE the assertion is the whole
         * test — without it, a keyed effect passes.
         */
        act(() => { root.render(<Harness nonce={1} />); });
        act(() => { root.render(<Harness nonce={2} />); });

        hit('attack', 30);
        expect(isHitStopped()).toBe(true);
    });

    it('does not cancel a stop that a re-render lands on top of', () => {
        // The exact ordering that failed: request, then re-render, then look. The stop must still
        // be standing — a cleanup that fires here is a cleanup that cancels its own request.
        hit('attack', 30);
        act(() => { root.render(<Harness nonce={3} />); });
        expect(isHitStopped()).toBe(true);
    });
});

describe('146e — the animations switch', () => {
    it('turns the stop off entirely, while the flash (which is vfx) stays', () => {
        // §2a: *"`animations` off → no stop, no shake; the flash stays (it is `vfx`)."* The flash
        // lives in `useBattleVfx` and is untouched by this hook, which is the separation working.
        act(() => { root.unmount(); });
        saveSettings({ ...DEFAULT_SETTINGS, animations: false });

        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Harness />); });

        hit('attack', 40);
        expect(isHitStopped()).toBe(false);
    });

    it('reads the setting once per fight rather than per hit', () => {
        // A JSON parse on the impact path of every hit is the kind of cost that only shows up in a
        // 3v3 with a Side card. Changing storage mid-fight must NOT take effect.
        const spy = vi.spyOn(Storage.prototype, 'getItem');
        spy.mockClear();
        hit('attack', 10);
        hit('attack', 10);
        expect(spy.mock.calls.filter((c) => c[0] === SETTINGS_STORAGE_KEY)).toHaveLength(0);
        spy.mockRestore();
    });
});

describe('155a — the deferred shake does not outlive the component', () => {
    it('does not call framer-motion after unmount', () => {
        /*
         * The shake is deferred past the hit-stop, so up to 110ms separates the hit from
         * `controls.start()`. A fight ending on the killing blow — when the stop is LONGEST — used
         * to unmount inside that window and framer-motion threw
         * "controls.start() should only be called after a component has mounted".
         *
         * An unhandled exception on the most dramatic hit in a run. It only surfaced once this file
         * started unmounting while a stop was standing.
         */
        hit('attack', 60);
        expect(isHitStopped()).toBe(true);

        act(() => { root.unmount(); });
        // Re-created in afterEach's expectation; make the teardown a no-op.
        root = createRoot(document.createElement('div'));

        // 189a: the deferred shake now runs on the battle clock, so this is what lets it fire.
        expect(() => battleClock.advance(300)).not.toThrow();
    });
});
