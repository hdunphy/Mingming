import { describe, expect, it } from 'vitest';

import { TrailingFlush, type FlushScheduler } from './TrailingFlush';

/** A scheduler the test turns by hand: nothing runs until `runDue`. */
class ManualScheduler implements FlushScheduler {
    private tasks = new Map<number, () => void>();
    private next = 1;
    scheduled = 0;
    cancelled = 0;

    schedule(run: () => void): () => void {
        const id = this.next++;
        this.scheduled += 1;
        this.tasks.set(id, run);
        return () => { if (this.tasks.delete(id)) this.cancelled += 1; };
    }

    get waiting(): number { return this.tasks.size; }

    runDue(): void {
        const due = [...this.tasks.values()];
        this.tasks.clear();
        for (const run of due) run();
    }
}

const make = () => {
    const scheduler = new ManualScheduler();
    let runs = 0;
    const flush = new TrailingFlush(() => { runs += 1; }, scheduler);
    return { scheduler, flush, runs: () => runs };
};

describe('TrailingFlush', () => {
    it('does nothing until it is asked, and then does nothing until the scheduler fires', () => {
        const { scheduler, flush, runs } = make();
        expect(flush.pending).toBe(false);
        flush.request();
        expect(flush.pending).toBe(true);
        expect(runs()).toBe(0);
        scheduler.runDue();
        expect(runs()).toBe(1);
        expect(flush.pending).toBe(false);
    });

    it('folds a hundred requests inside one window into ONE run and ONE scheduled task', () => {
        const { scheduler, flush, runs } = make();
        for (let i = 0; i < 100; i += 1) flush.request();
        expect(scheduler.scheduled).toBe(1);
        scheduler.runDue();
        expect(runs()).toBe(1);
    });

    it('schedules a new window for a request that arrives after the last one ran', () => {
        const { scheduler, flush, runs } = make();
        flush.request();
        scheduler.runDue();
        flush.request();
        scheduler.runDue();
        expect(runs()).toBe(2);
        expect(scheduler.scheduled).toBe(2);
    });

    it('flushNow runs a pending request at once and cancels its timer', () => {
        const { scheduler, flush, runs } = make();
        flush.request();
        flush.flushNow();
        expect(runs()).toBe(1);
        expect(flush.pending).toBe(false);
        expect(scheduler.waiting).toBe(0);
        // The cancelled timer must not run it a second time.
        scheduler.runDue();
        expect(runs()).toBe(1);
    });

    it('flushNow with nothing pending does nothing (a page-leave must not write for no reason)', () => {
        const { flush, runs } = make();
        flush.flushNow();
        expect(runs()).toBe(0);
    });

    it('cancel drops a pending request without running it', () => {
        const { scheduler, flush, runs } = make();
        flush.request();
        flush.cancel();
        expect(flush.pending).toBe(false);
        scheduler.runDue();
        expect(runs()).toBe(0);
    });

    it('still works if the scheduler runs the task synchronously', () => {
        let runs = 0;
        const flush = new TrailingFlush(() => { runs += 1; }, { schedule: (run) => { run(); return () => undefined; } });
        flush.request();
        flush.request();
        expect(runs).toBe(2);
        expect(flush.pending).toBe(false);
    });
});
