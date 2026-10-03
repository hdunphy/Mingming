/**
 * TICKET 189a — the driver: one rAF loop for the whole battle, running only while something is live.
 */
import { describe, expect, it, vi } from 'vitest';

import { BattleClock } from './BattleClock';
import { ClockDriver, type FrameScheduler } from './ClockDriver';
import { HitStop } from './HitStop';

/** A scheduler the test steps by hand: `tick(16)` is one animation frame, 16 ms after the last. */
function fakeScheduler() {
    let id = 0;
    let time = 1_000;
    const queue = new Map<number, (t: number) => void>();
    const scheduler: FrameScheduler = {
        request: (cb) => { id += 1; queue.set(id, cb); return id; },
        cancel: (handle) => { queue.delete(handle); },
    };
    return {
        scheduler,
        get pending() { return queue.size; },
        tick(ms: number) {
            time += ms;
            const callbacks = [...queue.values()];
            queue.clear();
            for (const cb of callbacks) cb(time);
        },
    };
}

function setup(maxDtMs?: number) {
    const hitStop = new HitStop();
    const clock = new BattleClock({ speed: () => 1, hitStop });
    const raf = fakeScheduler();
    const driver = new ClockDriver(clock, raf.scheduler, maxDtMs);
    return { clock, driver, raf };
}

describe('189a — the driver loop', () => {
    it('does not schedule a frame while nothing is live', () => {
        const { raf } = setup();
        expect(raf.pending).toBe(0);
    });

    it('starts when the clock goes live, and advances the clock by the real frame time', () => {
        const { clock, raf } = setup();
        const fn = vi.fn();
        clock.after(100, fn);
        expect(raf.pending).toBe(1);

        raf.tick(16);                       // first frame: no previous frame, so 16 ms is assumed
        expect(clock.now).toBe(16);
        raf.tick(50);
        expect(clock.now).toBe(66);
        raf.tick(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('STOPS when the last thing finishes — no loop spinning on an idle battle', () => {
        const { clock, raf } = setup();
        clock.after(30, () => undefined);
        raf.tick(16);
        raf.tick(16);
        expect(raf.pending).toBe(0);
    });

    it('keeps running through a freeze, because a freeze is live', () => {
        const { clock, raf } = setup();
        clock.freeze(60);
        expect(raf.pending).toBe(1);
        raf.tick(16);
        expect(raf.pending).toBe(1);
        raf.tick(100);
        expect(raf.pending).toBe(0);
    });

    it('restarts cleanly after parking, with a fresh first-frame delta', () => {
        const { clock, raf } = setup();
        clock.after(10, () => undefined);
        raf.tick(16);
        expect(raf.pending).toBe(0);

        clock.after(100, () => undefined);   // time passes while parked: it must not count
        raf.tick(5_000);
        expect(clock.now).toBe(16 + 16);   // 16 from the first run, 16 assumed for the restart
    });

    it('caps a huge frame (a tab that slept) so waits do not all fire at once', () => {
        const { clock, raf } = setup(100);
        clock.after(500, () => undefined);
        raf.tick(16);
        raf.tick(10_000);
        expect(clock.now).toBe(16 + 100);
    });
});

describe('189a — frame consumers', () => {
    it('hands each frame to a consumer, and keeps looping while it says it is live', () => {
        const { driver, raf } = setup();
        let live = true;
        const seen: number[] = [];
        driver.addConsumer((frame) => { seen.push(frame.gameDt); return live; });
        driver.wake();

        raf.tick(16);
        raf.tick(16);
        expect(seen).toEqual([16, 16]);
        expect(raf.pending).toBe(1);

        live = false;
        raf.tick(16);
        expect(raf.pending).toBe(0);
    });

    it('gives a consumer gameDt 0 while frozen — this is how particles hold during a hit-stop', () => {
        const { clock, driver, raf } = setup();
        const seen: number[] = [];
        driver.addConsumer((frame) => { seen.push(frame.gameDt); return true; });
        clock.freeze(40);
        raf.tick(16);
        raf.tick(16);
        raf.tick(16);                       // 8 ms of the freeze left, so 8 ms is live
        expect(seen).toEqual([0, 0, 8]);
    });

    it('removes a consumer', () => {
        const { driver, raf } = setup();
        const fn = vi.fn(() => true);
        const off = driver.addConsumer(fn);
        driver.wake();
        raf.tick(16);
        off();
        raf.tick(16);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(raf.pending).toBe(0);
    });

    it('dispose cancels the pending frame and unhooks the clock', () => {
        const { clock, driver, raf } = setup();
        clock.after(100, () => undefined);
        expect(raf.pending).toBe(1);
        driver.dispose();
        expect(raf.pending).toBe(0);
        clock.after(100, () => undefined);
        expect(raf.pending).toBe(0);
    });
});
