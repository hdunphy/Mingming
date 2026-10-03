/**
 * TICKET 146e — the hit-stop curve, and the one line that matters most in it.
 *
 * Ruling 2's formula is written down in the ticket, so the arithmetic tests are cheap and worth
 * having: a curve that silently goes flat, or inverts, still "works" and just stops being felt.
 *
 * The load-bearing test is the last one in the first block — never on a status tick. A Poison deck
 * that froze the game and shook the screen every turn would be unplayable, and nothing else in the
 * codebase would notice.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { battleClock, resetBattleClock } from './clock/battleClockRuntime';

import {
    HIT_STOP_MAX_MS, HIT_STOP_MIN_MS, SHAKE_KILL_PX, SHAKE_MAX_PX, SHAKE_MIN_PX,
    afterHitStop, damageScale, hitStopMsFor, hitStopRemaining, isHitStopped, requestHitStop,
    resetHitStop, shakeAmplitudeFor, shakeKeyframes,
} from './hitStop';

afterEach(() => resetBattleClock());

describe('146e — the curve', () => {
    it('gives every hit the floor, because ruling 2 says everything gets one', () => {
        // *"Everything gets a hit stop but it scales with damage."* A 1-damage poke on a 1000 HP
        // frame still stops — briefly. The floor is what makes the scaling read as scaling rather
        // than as "big hits do something and small ones do nothing".
        expect(hitStopMsFor(1, 1000)).toBe(HIT_STOP_MIN_MS);
        expect(hitStopMsFor(0, 100)).toBe(HIT_STOP_MIN_MS);
    });

    it('reaches the ceiling at 35% of max HP and does not go past it', () => {
        expect(hitStopMsFor(35, 100)).toBe(HIT_STOP_MAX_MS);
        expect(hitStopMsFor(90, 100)).toBe(HIT_STOP_MAX_MS);
    });

    it('matches ruling 2 in the middle of the curve', () => {
        // 30 + 80 × clamp((0.20 − 0.05) / 0.30, 0, 1) = 30 + 80 × 0.5 = 70.
        expect(hitStopMsFor(20, 100)).toBeCloseTo(70, 5);
    });

    it('is monotonic, so a bigger hit never feels lighter', () => {
        let last = -1;
        for (let applied = 0; applied <= 100; applied += 5) {
            const ms = hitStopMsFor(applied, 100);
            expect(ms).toBeGreaterThanOrEqual(last);
            last = ms;
        }
    });

    it('takes the ceiling on a kill whatever the number was', () => {
        // A killing blow for 2 damage on a unit at 1 HP is still a death.
        expect(hitStopMsFor(2, 100, true)).toBe(HIT_STOP_MAX_MS);
    });

    it('survives a zero maxHp instead of returning NaN', () => {
        // A hand-built fixture, or a unit the UI has not resolved yet. NaN here would propagate
        // into `setTimeout` and freeze the stage permanently.
        expect(Number.isFinite(hitStopMsFor(5, 0))).toBe(true);
        expect(damageScale(5, 0)).toBe(0);
    });
});

describe('146e — the shake rides the same scale', () => {
    it('runs 2px to 8px across the curve', () => {
        expect(shakeAmplitudeFor(1, 1000)).toBeCloseTo(SHAKE_MIN_PX, 5);
        expect(shakeAmplitudeFor(35, 100)).toBeCloseTo(SHAKE_MAX_PX, 5);
    });

    it('shakes harder on a kill than any survivable hit can', () => {
        expect(shakeAmplitudeFor(99, 100, true)).toBe(SHAKE_KILL_PX);
        expect(SHAKE_KILL_PX).toBeGreaterThan(SHAKE_MAX_PX);
    });

    it('ENDS AT ZERO, or the board walks', () => {
        /*
         * Each shake starts from wherever the last one left the stage. A keyframe list that ends
         * off-centre would translate the whole board a little further every hit, and after a long
         * fight the composition would be visibly off — a bug that takes twenty minutes of play to
         * appear and one assertion to prevent.
         */
        const frames = shakeKeyframes(8);
        expect(frames[0]).toBe(0);
        expect(frames[frames.length - 1]).toBe(0);
    });

    it('decays, so the shake settles rather than buzzing', () => {
        const peaks = shakeKeyframes(8).map(Math.abs);
        expect(Math.max(...peaks)).toBeCloseTo(8, 5);
        expect(peaks[1]).toBeGreaterThan(peaks[peaks.length - 2]);
    });
});

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
