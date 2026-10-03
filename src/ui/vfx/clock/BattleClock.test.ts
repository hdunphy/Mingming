/**
 * TICKET 189a — the battle clock.
 *
 * The clock is driven by hand here (`advance`), never by a timer: that is the point of it. Game
 * time moves only when the driver says a frame happened, so a test can place a wait at an exact
 * millisecond, and a freeze can hold every wait and every play in one place.
 */
import { describe, expect, it, vi } from 'vitest';

import { BattleClock, easeOut, linear } from './BattleClock';
import { HitStop } from './HitStop';
import { INSTANT } from './speedPolicy';

const flush = async (): Promise<void> => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); };

function makeClock(initial = 1) {
    const state = { speed: initial };
    const hitStop = new HitStop();
    const clock = new BattleClock({ speed: () => state.speed, hitStop });
    return { clock, hitStop, state };
}

describe('189a — game time and waits', () => {
    it('wait(300) resolves at 300 ms of game time, not before', async () => {
        const { clock } = makeClock();
        let done = false;
        void clock.wait(300).then(() => { done = true; });

        clock.advance(299);
        await flush();
        expect(done).toBe(false);

        clock.advance(1);
        await flush();
        expect(done).toBe(true);
        expect(clock.now).toBe(300);
    });

    it('at speed 2 a 300 ms wait resolves after 150 ms of REAL time', async () => {
        const { clock } = makeClock(2);
        let done = false;
        void clock.wait(300).then(() => { done = true; });

        clock.advance(149);
        await flush();
        expect(done).toBe(false);
        clock.advance(1);
        await flush();
        expect(done).toBe(true);
    });

    it('a speed change mid-wait takes effect from the next frame', async () => {
        const { clock, state } = makeClock(1);
        let done = false;
        void clock.wait(200).then(() => { done = true; });
        clock.advance(100);                 // 100 of 200 elapsed
        state.speed = 4;
        clock.advance(25);                  // +100 game ms
        await flush();
        expect(done).toBe(true);
    });

    it('resolves a batch of waits in the order they fall due', async () => {
        const { clock } = makeClock();
        const order: string[] = [];
        void clock.wait(200).then(() => order.push('b'));
        void clock.wait(100).then(() => order.push('a'));
        void clock.wait(300).then(() => order.push('c'));
        clock.advance(1_000);
        await flush();
        expect(order).toEqual(['a', 'b', 'c']);
    });

    it('after() runs its callback synchronously inside advance, at the exact game time', () => {
        const { clock } = makeClock();
        const seen: number[] = [];
        clock.after(120, () => seen.push(clock.now));
        clock.advance(100);
        expect(seen).toEqual([]);
        clock.advance(100);
        expect(seen).toEqual([120]);
    });

    it('a callback that schedules the next step lands on the exact due time, with no drift', () => {
        const { clock } = makeClock();
        const seen: number[] = [];
        clock.after(100, () => {
            seen.push(clock.now);
            clock.after(100, () => seen.push(clock.now));
        });
        // One long frame: both steps are due inside it and must both fire, at 100 and 200.
        clock.advance(250);
        expect(seen).toEqual([100, 200]);
    });

    it('after() returns a cancel that stops it', () => {
        const { clock } = makeClock();
        const fn = vi.fn();
        const cancel = clock.after(50, fn);
        cancel();
        clock.advance(100);
        expect(fn).not.toHaveBeenCalled();
        expect(clock.pendingCount).toBe(0);
    });
});

describe('189a — play', () => {
    it('calls fn(p) every frame from 0 to 1 and resolves at the end', async () => {
        const { clock } = makeClock();
        const ps: number[] = [];
        let done = false;
        void clock.play(100, (p) => ps.push(p)).then(() => { done = true; });

        clock.advance(25);
        clock.advance(25);
        expect(ps).toEqual([0.25, 0.5]);
        clock.advance(100);
        await flush();
        expect(ps[ps.length - 1]).toBe(1);
        expect(done).toBe(true);
    });

    it('applies the easing to p', () => {
        const { clock } = makeClock();
        const ps: number[] = [];
        void clock.play(100, (p) => ps.push(p), easeOut);
        clock.advance(50);
        expect(ps[0]).toBeCloseTo(easeOut(0.5), 8);
        expect(ps[0]).toBeGreaterThan(0.5);
        expect(linear(0.3)).toBe(0.3);
    });
});

describe('189a — the freeze', () => {
    it('holds every wait and play for its length, then resumes them', async () => {
        const { clock, hitStop } = makeClock();
        let done = false;
        const ps: number[] = [];
        void clock.wait(100).then(() => { done = true; });
        void clock.play(100, (p) => ps.push(p));

        clock.advance(50);
        expect(ps).toEqual([0.5]);

        clock.freeze(80);
        expect(hitStop.active).toBe(true);
        expect(clock.frozen).toBe(true);

        clock.advance(40);                  // all frozen
        clock.advance(40);                  // exactly consumes the freeze
        await flush();
        expect(done).toBe(false);
        expect(ps).toEqual([0.5]);          // fn is NOT called during a freeze
        expect(clock.now).toBe(50);

        clock.advance(50);                  // resumes: 100 ms reached
        await flush();
        expect(done).toBe(true);
        expect(ps[ps.length - 1]).toBe(1);
    });

    it('the part of a frame after the freeze ends is live', () => {
        const { clock } = makeClock();
        clock.freeze(30);
        const frame = clock.advance(50);
        expect(frame.gameDt).toBe(20);
        expect(clock.now).toBe(20);
    });

    it('the freeze shrinks at high speed (max(30, ms / sqrt(speed)))', () => {
        const { clock, hitStop } = makeClock(4);
        clock.freeze(160);
        expect(hitStop.remainingMs).toBeCloseTo(80, 5);
    });
});

describe('189a — Instant', () => {
    it('resolves a wait at once, with no advance', async () => {
        const { clock } = makeClock(INSTANT);
        let done = false;
        void clock.wait(5_000).then(() => { done = true; });
        await flush();
        expect(done).toBe(true);
        expect(clock.pendingCount).toBe(0);
    });

    it('runs a play to its end synchronously: fn(1) before the call returns', () => {
        const { clock } = makeClock(INSTANT);
        const fn = vi.fn();
        void clock.play(2_000, fn);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(1);
    });

    it('runs after() synchronously', () => {
        const { clock } = makeClock(INSTANT);
        const fn = vi.fn();
        clock.after(5_000, fn);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('flushes everything already pending the moment the clock turns Instant', async () => {
        const { clock, state } = makeClock(1);
        const fn = vi.fn();
        const after = vi.fn();
        let done = false;
        void clock.wait(5_000).then(() => { done = true; });
        void clock.play(5_000, fn);
        clock.after(5_000, after);

        state.speed = INSTANT;
        clock.advance(16);
        await flush();

        expect(done).toBe(true);
        expect(after).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenLastCalledWith(1);
        expect(clock.pendingCount).toBe(0);
    });

    it('does not freeze: a freeze request at Instant is dropped', () => {
        const { clock, hitStop } = makeClock(INSTANT);
        clock.freeze(170);
        expect(hitStop.active).toBe(false);
    });

    it('reports a finite game delta even at Instant, so particles do not explode', () => {
        const { clock } = makeClock(INSTANT);
        expect(Number.isFinite(clock.advance(16).gameDt)).toBe(true);
    });
});

describe('189a — cancelAll and live', () => {
    it('cancelAll leaves nothing pending and drops the freeze', async () => {
        const { clock, hitStop } = makeClock();
        let done = false;
        void clock.wait(100).then(() => { done = true; });
        void clock.play(100, () => undefined);
        clock.after(100, () => undefined);
        clock.freeze(100);
        expect(clock.pendingCount).toBe(3);

        clock.cancelAll();
        expect(clock.pendingCount).toBe(0);
        expect(hitStop.active).toBe(false);
        expect(clock.live).toBe(false);

        clock.advance(1_000);
        await flush();
        expect(done).toBe(false);           // a cancelled wait never resumes its awaiter
    });

    it('reset is cancelAll plus game time back to zero', () => {
        const { clock } = makeClock();
        clock.after(100, () => undefined);
        clock.advance(40);
        clock.reset();
        expect(clock.now).toBe(0);
        expect(clock.pendingCount).toBe(0);
    });

    it('is live only while something is pending or frozen', () => {
        const { clock } = makeClock();
        expect(clock.live).toBe(false);
        clock.after(10, () => undefined);
        expect(clock.live).toBe(true);
        clock.advance(10);
        expect(clock.live).toBe(false);
        clock.freeze(30);
        expect(clock.live).toBe(true);
        clock.advance(30);
        expect(clock.live).toBe(false);
    });

    it('wakes its listener when it goes from idle to live, once', () => {
        const { clock } = makeClock();
        const wake = vi.fn();
        const off = clock.onWake(wake);
        clock.after(10, () => undefined);
        clock.after(20, () => undefined);   // already live: no second wake
        expect(wake).toHaveBeenCalledTimes(1);
        clock.advance(100);
        clock.freeze(30);                   // idle -> live again
        expect(wake).toHaveBeenCalledTimes(2);
        off();
        clock.advance(100);
        clock.after(10, () => undefined);
        expect(wake).toHaveBeenCalledTimes(2);
    });
});


describe('189d — a freeze requested from inside a frame', () => {
    it('stops game time where the callback ran: the rest of that frame is not game time', () => {
        const { clock } = makeClock();
        const ran: Array<[string, number]> = [];
        clock.after(400, () => { ran.push(['impact', clock.now]); clock.freeze(50); });
        clock.after(410, () => { ran.push(['after', clock.now]); });

        // One long frame that would carry game time past both.
        const frame = clock.advance(500);
        expect(ran).toEqual([['impact', 400]]);
        expect(clock.now).toBe(400);
        expect(frame.gameDt).toBe(400);

        // The freeze (50 ms, floor 30) eats 50 ms, then time moves and the second step lands.
        clock.advance(50);
        expect(clock.now).toBe(400);
        clock.advance(10);
        expect(ran).toEqual([['impact', 400], ['after', 410]]);
    });

    it('a play in flight stops at the freeze point, not at the end of the frame', () => {
        const { clock } = makeClock();
        const seen: number[] = [];
        void clock.play(1000, (p) => { seen.push(p); });
        clock.after(100, () => clock.freeze(40));
        clock.advance(300);
        expect(clock.now).toBe(100);
        expect(seen[seen.length - 1]).toBeCloseTo(0.1, 5);
    });
});
