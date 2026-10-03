/**
 * THE PRESENTER QUEUE — ticket 189b. One ordered line for everything the board shows.
 *
 * Casts, hook beats, DoT ticks and expiries at a turn boundary, recoil and toll, and deaths all
 * become `Beat`s and play here, one after another, on the battle clock. That is the whole fix for
 * "a Burn tick can play in front of the impact that is still on its way": nothing reaches the
 * screen except through this line, so nothing can overtake anything.
 *
 * - A beat starts when the previous one ends (game time, so a hit-stop freeze holds the line).
 * - `isIdle()` is true when nothing is playing and nothing is waiting; `whenIdle()` is a promise of
 *   that moment. The enemy loop and the battle-end banner wait on it (189e).
 * - At Instant every action and every beat end runs synchronously, so a whole queue plays out
 *   before `enqueue` returns.
 * - An action that throws is swallowed: a missing effect must never stall the fight behind it.
 */

import type { BattleClock } from '../clock/BattleClock';
import type { Beat } from './beat';

export class PresenterQueue {
    private readonly waiting: Beat[] = [];
    private playing: Beat | null = null;
    private idleWaiters: Array<() => void> = [];
    /** Bumped by `clear`, so a stale end-of-beat callback from before it does nothing. */
    private epoch = 0;
    private cancels: Array<() => void> = [];

    constructor(private readonly clock: BattleClock) {}

    isIdle(): boolean {
        return this.playing === null && this.waiting.length === 0;
    }

    /** Resolves when nothing is playing and nothing is waiting. Already idle: resolves at once. */
    whenIdle(): Promise<void> {
        if (this.isIdle()) return Promise.resolve();
        return new Promise<void>((resolve) => { this.idleWaiters.push(resolve); });
    }

    enqueue(beat: Beat): void {
        this.waiting.push(beat);
        if (this.playing === null) this.startNext();
    }

    /** Drop everything (unmount). Waiters of `whenIdle` never resume, like a cancelled wait. */
    clear(): void {
        this.epoch += 1;
        for (const cancel of this.cancels) cancel();
        this.cancels = [];
        this.waiting.length = 0;
        this.playing = null;
        this.idleWaiters = [];
    }

    private startNext(): void {
        const beat = this.waiting.shift();
        if (!beat) {
            this.playing = null;
            const waiters = this.idleWaiters;
            this.idleWaiters = [];
            for (const resolve of waiters) resolve();
            return;
        }
        this.playing = beat;
        const epoch = this.epoch;

        for (const action of beat.actions) {
            if (action.at <= 0) {
                this.run(action.run);
            } else {
                this.cancels.push(this.clock.after(action.at, () => {
                    if (epoch === this.epoch) this.run(action.run);
                }));
            }
        }
        // Scheduled after the actions, so an action due exactly at the end still runs first.
        this.cancels.push(this.clock.after(Math.max(beat.durationMs, 0), () => {
            if (epoch !== this.epoch) return;
            this.cancels = [];
            this.playing = null;
            this.startNext();
        }));
    }

    private run(fn: () => void): void {
        try { fn(); } catch { /* an effect that failed must not stall the line */ }
    }
}
