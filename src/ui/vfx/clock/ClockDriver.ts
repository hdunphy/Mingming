/**
 * THE CLOCK DRIVER — ticket 189a. One `requestAnimationFrame` loop for the whole battle.
 *
 * It runs only while something is live — a pending wait or play, a hit-stop freeze, or a frame
 * consumer (the particle layer, the clocked framer-motion controls) that says it still needs
 * frames. That is the rule `ParticleLayer` already followed on its own; the layer is now a consumer
 * of this loop, so there is exactly one rAF in the battle and exactly one place that knows how to
 * stop it.
 *
 * A frame is `realDt` since the previous frame. The first frame after a park assumes 16 ms (time
 * spent parked is not battle time), and a frame is capped at `maxDtMs` so a tab that slept does not
 * fire every wait at once on the way back.
 */

import type { BattleClock, ClockFrame } from './BattleClock';

export interface FrameScheduler {
    request(cb: (time: number) => void): number;
    cancel(handle: number): void;
}

/** The browser's rAF, or a 16 ms timeout where there is none (a headless run). */
export const browserScheduler: FrameScheduler = {
    request: (cb) => (typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(cb)
        : (setTimeout(() => cb(performance.now()), 16) as unknown as number)),
    cancel: (handle) => (typeof cancelAnimationFrame === 'function'
        ? cancelAnimationFrame(handle)
        : clearTimeout(handle)),
};

/** A frame consumer returns true while it still needs frames. */
export type FrameConsumer = (frame: ClockFrame) => boolean;

export const DEFAULT_MAX_FRAME_MS = 100;
const FIRST_FRAME_MS = 16;

export class ClockDriver {
    private handle: number | null = null;
    private lastTime = 0;
    private consumers = new Set<FrameConsumer>();
    private readonly unhook: () => void;

    constructor(
        private readonly clock: BattleClock,
        private readonly scheduler: FrameScheduler = browserScheduler,
        private readonly maxDtMs: number = DEFAULT_MAX_FRAME_MS,
    ) {
        this.unhook = clock.onWake(() => this.wake());
    }

    /** Start the loop if it is parked. Safe to call every time something new appears. */
    wake(): void {
        if (this.handle !== null) return;
        this.lastTime = 0;
        this.handle = this.scheduler.request(this.tick);
    }

    addConsumer(consumer: FrameConsumer): () => void {
        this.consumers.add(consumer);
        return () => { this.consumers.delete(consumer); };
    }

    /** Stop for good: cancel the pending frame and stop listening to the clock. */
    dispose(): void {
        if (this.handle !== null) this.scheduler.cancel(this.handle);
        this.handle = null;
        this.consumers.clear();
        this.unhook();
    }

    /** Park the loop without disposing it (leaving a battle). */
    park(): void {
        if (this.handle !== null) this.scheduler.cancel(this.handle);
        this.handle = null;
        this.lastTime = 0;
    }

    private readonly tick = (time: number): void => {
        const raw = this.lastTime === 0 ? FIRST_FRAME_MS : time - this.lastTime;
        const realDt = Math.min(Math.max(raw, 0), this.maxDtMs);
        this.lastTime = time;
        this.handle = null;

        let keep = false;
        try {
            const frame = this.clock.advance(realDt);
            for (const consumer of [...this.consumers]) {
                if (consumer(frame)) keep = true;
            }
        } finally {
            if (keep || this.clock.live) {
                this.handle = this.scheduler.request(this.tick);
            } else {
                this.lastTime = 0;
            }
        }
    };
}
