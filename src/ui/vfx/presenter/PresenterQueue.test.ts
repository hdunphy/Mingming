/**
 * TICKET 189b — the presenter queue: one ordered line for everything the board shows.
 */
import { describe, expect, it, vi } from 'vitest';

import { BattleClock } from '../clock/BattleClock';
import { HitStop } from '../clock/HitStop';
import { INSTANT } from '../clock/speedPolicy';
import type { Beat } from './beat';
import { PresenterQueue } from './PresenterQueue';

const flush = async (): Promise<void> => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); };

function setup(initial = 1) {
    const state = { speed: initial };
    const clock = new BattleClock({ speed: () => state.speed, hitStop: new HitStop() });
    const queue = new PresenterQueue(clock);
    return { clock, queue, state };
}

const beat = (label: string, durationMs: number, actions: Array<[number, () => void]> = []): Beat => ({
    label, durationMs, actions: actions.map(([at, run]) => ({ at, run })),
});

describe('189b — PresenterQueue', () => {
    it('is idle until something is queued', () => {
        const { queue } = setup();
        expect(queue.isIdle()).toBe(true);
    });

    it('starts the first beat at once and runs a 0 ms action synchronously', () => {
        const { queue } = setup();
        const run = vi.fn();
        queue.enqueue(beat('a', 100, [[0, run]]));
        expect(run).toHaveBeenCalledTimes(1);
        expect(queue.isIdle()).toBe(false);
    });

    it('runs actions at their offsets, on game time', () => {
        const { queue, clock } = setup();
        const log: string[] = [];
        queue.enqueue(beat('a', 300, [[100, () => log.push(`x@${clock.now}`)], [250, () => log.push(`y@${clock.now}`)]]));
        clock.advance(99);
        expect(log).toEqual([]);
        clock.advance(200);
        expect(log).toEqual(['x@100', 'y@250']);
    });

    it('plays beats one after another: the next starts when the last one ends', () => {
        const { queue, clock } = setup();
        const log: string[] = [];
        queue.enqueue(beat('a', 200, [[0, () => log.push(`a@${clock.now}`)]]));
        queue.enqueue(beat('b', 200, [[0, () => log.push(`b@${clock.now}`)]]));
        queue.enqueue(beat('c', 200, [[0, () => log.push(`c@${clock.now}`)]]));
        expect(log).toEqual(['a@0']);
        clock.advance(1_000);
        expect(log).toEqual(['a@0', 'b@200', 'c@400']);
    });

    it('SEVEN beats queued in one synchronous burst play in order, never on top of each other', () => {
        const { queue, clock } = setup();
        const starts: number[] = [];
        for (let i = 0; i < 7; i += 1) queue.enqueue(beat(`cast${i}`, 500, [[0, () => starts.push(clock.now)]]));
        clock.advance(10_000);
        expect(starts).toEqual([0, 500, 1_000, 1_500, 2_000, 2_500, 3_000]);
    });

    it('a beat that arrives while one is playing waits its turn', () => {
        const { queue, clock } = setup();
        const log: string[] = [];
        queue.enqueue(beat('cast', 400, [[400, () => log.push('impact')]]));
        clock.advance(100);
        queue.enqueue(beat('tick', 100, [[0, () => log.push('tick')]]));
        expect(log).toEqual([]);
        clock.advance(300);
        expect(log).toEqual(['impact', 'tick']);
    });

    it('is idle again once the last beat ends', () => {
        const { queue, clock } = setup();
        queue.enqueue(beat('a', 100));
        clock.advance(99);
        expect(queue.isIdle()).toBe(false);
        clock.advance(1);
        expect(queue.isIdle()).toBe(true);
    });

    it('whenIdle resolves at once when idle, and after the last beat when busy', async () => {
        const { queue, clock } = setup();
        let idleNow = false;
        void queue.whenIdle().then(() => { idleNow = true; });
        await flush();
        expect(idleNow).toBe(true);

        let done = false;
        queue.enqueue(beat('a', 100));
        queue.enqueue(beat('b', 100));
        void queue.whenIdle().then(() => { done = true; });
        clock.advance(150);
        await flush();
        expect(done).toBe(false);
        clock.advance(60);
        await flush();
        expect(done).toBe(true);
    });

    it('a freeze holds the whole queue', () => {
        const { queue, clock } = setup();
        const run = vi.fn();
        queue.enqueue(beat('a', 100, [[100, run]]));
        clock.freeze(60);
        clock.advance(60);
        expect(run).not.toHaveBeenCalled();
        clock.advance(100);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('Instant plays a whole queue with no waiting', () => {
        const { queue } = setup(INSTANT);
        const log: string[] = [];
        queue.enqueue(beat('a', 500, [[0, () => log.push('a0')], [400, () => log.push('a400')]]));
        queue.enqueue(beat('b', 500, [[0, () => log.push('b0')]]));
        expect(log).toEqual(['a0', 'a400', 'b0']);
        expect(queue.isIdle()).toBe(true);
    });

    it('clear drops everything queued and playing, and goes idle', () => {
        const { queue, clock } = setup();
        const run = vi.fn();
        queue.enqueue(beat('a', 100, [[50, run]]));
        queue.enqueue(beat('b', 100, [[0, run]]));
        queue.clear();
        clock.advance(1_000);
        expect(run).not.toHaveBeenCalled();
        expect(queue.isIdle()).toBe(true);
    });

    it('a throwing action does not stop the queue', () => {
        const { queue, clock } = setup();
        const run = vi.fn();
        queue.enqueue(beat('a', 100, [[0, () => { throw new Error('boom'); }]]));
        queue.enqueue(beat('b', 100, [[0, run]]));
        clock.advance(200);
        expect(run).toHaveBeenCalledTimes(1);
    });
});

describe('190a — queuedCount (what catch-up reads)', () => {
    it('is 0 when idle, and counts only the beats WAITING, not the one playing', () => {
        const { queue } = setup();
        expect(queue.queuedCount()).toBe(0);
        queue.enqueue(beat('first', 500));
        expect(queue.queuedCount()).toBe(0);
        queue.enqueue(beat('second', 500));
        queue.enqueue(beat('third', 500));
        expect(queue.queuedCount()).toBe(2);
    });

    it('falls as beats start', () => {
        const { queue, clock } = setup();
        queue.enqueue(beat('a', 100));
        queue.enqueue(beat('b', 100));
        expect(queue.queuedCount()).toBe(1);
        clock.advance(100);
        expect(queue.queuedCount()).toBe(0);
    });
});
