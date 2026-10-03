/**
 * TICKET 146e — the freeze itself, on the battle clock (189a). How long a freeze is (the curve) and
 * how hard the shakes are moved to `impact/impactMath` in 189d and are tested there; the rule that
 * only an attack earns one is `useImpactFeedback.test`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { battleClock, resetBattleClock } from './clock/battleClockRuntime';

import {
    afterHitStop, hitStopRemaining, isHitStopped, requestHitStop, resetHitStop,
} from './hitStop';

afterEach(() => resetBattleClock());

describe('146e — the clock (189a: now the battle clock)', () => {
    it('reports stopped for the duration and running after', () => {
        requestHitStop(100);
        expect(isHitStopped()).toBe(true);
        expect(hitStopRemaining()).toBe(100);
        battleClock.advance(50);
        expect(hitStopRemaining()).toBe(50);
        battleClock.advance(50);
        expect(isHitStopped()).toBe(false);
    });

    it('EXTENDS rather than restacks when hits overlap', () => {
        /*
         * A Side card landing on three targets emits three DAMAGE_TAKEN in the same frame. Three
         * stops in a row would total a third of a second of frozen game for one card; the player
         * should feel one heavier impact. Taking the longer one also means a big hit is never
         * cut short by a small one arriving behind it.
         */
        requestHitStop(100);
        requestHitStop(40);
        expect(hitStopRemaining()).toBe(100);

        requestHitStop(150);
        expect(hitStopRemaining()).toBe(150);
    });

    it('ignores a zero or negative request', () => {
        requestHitStop(0);
        expect(isHitStopped()).toBe(false);
    });

    it('runs a deferred callback immediately when nothing is stopped', () => {
        const run = vi.fn();
        afterHitStop(run);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('defers a callback until the stop lifts — the shake must not play through it', () => {
        const run = vi.fn();
        requestHitStop(80);
        afterHitStop(run);
        expect(run).not.toHaveBeenCalled();

        battleClock.advance(79);
        expect(run).not.toHaveBeenCalled();

        // The freeze ends 1 ms into this frame; game time moves for the rest of it.
        battleClock.advance(17);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('stops GAME time, not just particles: a wait made before the stop holds through it', () => {
        // 189a's whole point. The old stop only paused the particle loop, and none existed yet.
        const run = vi.fn();
        battleClock.after(50, run);
        requestHitStop(100);
        battleClock.advance(100);          // frozen: nothing moves
        expect(run).not.toHaveBeenCalled();
        expect(battleClock.now).toBe(0);
        battleClock.advance(50);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('resetHitStop clears the freeze, so leaving a fight mid-stop strands nothing', () => {
        requestHitStop(80);
        resetHitStop();
        expect(isHitStopped()).toBe(false);
        expect(hitStopRemaining()).toBe(0);
    });
});
