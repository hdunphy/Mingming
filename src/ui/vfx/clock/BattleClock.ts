/**
 * THE BATTLE CLOCK — ticket 189a.
 *
 * The engine resolves a whole card in one synchronous burst, and the screen needs its own clock to
 * show it a beat at a time. This is that clock. Game time moves ONLY when the driver says a frame
 * happened (`advance`), scaled by the speed policy and stopped completely by a hit-stop freeze, so:
 *
 * - `wait(ms)` is a promise on GAME time, and `after(ms, fn)` is the same thing as a synchronous
 *   callback (no microtask between "due" and "run", so a chain of steps cannot drift);
 * - `play(ms, fn, ease)` calls `fn(p)` every frame and resolves at the end;
 * - a freeze holds every wait and every play at once, and `fn` is not called while it stands;
 * - at Instant (speed = Infinity) every wait, play and callback resolves at once — skipping the
 *   animation must skip the pauses too;
 * - `cancelAll()` for unmount: a cancelled wait NEVER resumes its awaiter, so nothing keeps
 *   running into a screen that is gone.
 *
 * It holds no timer and no rAF. `ClockDriver` owns the one rAF loop; tests call `advance` by hand.
 */

import type { HitStop } from './HitStop';
import { type SpeedPolicy, isInstantSpeed } from './speedPolicy';

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeOut: Ease = (t) => 1 - (1 - t) * (1 - t);

/** What the driver gets back from one `advance`, and what frame consumers are handed. */
export interface ClockFrame {
    /** Real milliseconds the frame took. */
    readonly realDt: number;
    /** Game milliseconds that passed: 0 while frozen. Finite even at Instant. */
    readonly gameDt: number;
    /** True when the whole frame was swallowed by a freeze. */
    readonly frozen: boolean;
    /** The clock multiplier this frame ran at (Infinity at Instant). */
    readonly multiplier: number;
}

export interface BattleClockDeps {
    readonly speed: SpeedPolicy;
    readonly hitStop: HitStop;
}

interface Entry {
    readonly start: number;
    readonly ms: number;
    readonly ease: Ease;
    /** Called with the eased progress every frame; absent for a pure wait. */
    readonly step?: (p: number) => void;
    /** Called once, when the entry's time is up. */
    readonly done: () => void;
}

export class BattleClock {
    private nowMs = 0;
    private entries: Entry[] = [];
    private wakeListeners = new Set<() => void>();
    private lastMultiplier = 1;
    private flushing = false;

    constructor(private readonly deps: BattleClockDeps) {}

    /** Game time in ms. */
    get now(): number {
        return this.nowMs;
    }

    get multiplier(): number {
        return this.deps.speed();
    }

    get frozen(): boolean {
        return this.deps.hitStop.active;
    }

    get pendingCount(): number {
        return this.entries.length;
    }

    /** True while something needs frames: a pending wait or play, or a freeze standing. */
    get live(): boolean {
        return this.entries.length > 0 || this.deps.hitStop.active;
    }

    /** Fires when the clock goes from idle to live. The driver uses it to start its loop. */
    onWake(listener: () => void): () => void {
        this.wakeListeners.add(listener);
        return () => { this.wakeListeners.delete(listener); };
    }

    /**
     * Run `fn` after `ms` of game time, synchronously inside `advance`. Returns a cancel.
     * At Instant it runs before this call returns.
     */
    after(ms: number, fn: () => void): () => void {
        return this.schedule(ms, linear, undefined, fn);
    }

    /** A promise that resolves after `ms` of game time. */
    wait(ms: number): Promise<void> {
        return new Promise<void>((resolve) => { this.after(ms, resolve); });
    }

    /** Call `fn(ease(p))` every frame for `ms` of game time; resolves after the last call. */
    play(ms: number, fn: (p: number) => void, ease: Ease = linear): Promise<void> {
        return new Promise<void>((resolve) => { this.schedule(ms, ease, fn, resolve); });
    }

    /** Freeze game time for `ms` (a Showy-tier length; speed shrinks it). */
    freeze(ms: number): void {
        const wasLive = this.live;
        this.deps.hitStop.request(ms, this.deps.speed());
        if (!wasLive && this.live) this.wake();
    }

    /**
     * One frame. The freeze eats its share of the real delta first; what is left moves game time
     * at the policy's multiplier. Everything that falls due inside the step runs, in due order.
     */
    advance(realDt: number): ClockFrame {
        const multiplier = this.deps.speed();
        this.lastMultiplier = multiplier;

        if (isInstantSpeed(multiplier)) {
            this.deps.hitStop.reset();
            this.flush();
            return { realDt, gameDt: realDt, frozen: false, multiplier };
        }

        const live = this.deps.hitStop.consume(realDt);
        const wanted = live * multiplier;
        const gameDt = wanted > 0 ? this.moveTo(this.nowMs + wanted) : 0;
        return { realDt, gameDt, frozen: live === 0 && realDt > 0, multiplier };
    }

    /** Resolve every pending wait, play and callback now (Instant, or leaving the screen). */
    flush(): void {
        if (this.flushing) return;
        this.flushing = true;
        try {
            // Callbacks may schedule more; at Instant those run at once, so loop until dry.
            for (let guard = 0; this.entries.length > 0 && guard < 10_000; guard += 1) {
                const batch = this.entries;
                this.entries = [];
                for (const entry of batch) this.finish(entry);
            }
        } finally {
            this.flushing = false;
        }
    }

    /** Drop everything pending and any freeze. Cancelled awaiters never resume. */
    cancelAll(): void {
        this.entries = [];
        this.deps.hitStop.reset();
    }

    /** `cancelAll`, and game time back to 0: a fresh battle starts on a fresh clock. */
    reset(): void {
        this.cancelAll();
        this.nowMs = 0;
    }

    private schedule(ms: number, ease: Ease, step: ((p: number) => void) | undefined, done: () => void): () => void {
        const entry: Entry = { start: this.nowMs, ms: Math.max(0, Number.isFinite(ms) ? ms : 0), ease, step, done };
        if (isInstantSpeed(this.deps.speed())) {
            this.finish(entry);
            return () => undefined;
        }
        const wasLive = this.live;
        this.entries.push(entry);
        if (!wasLive) this.wake();
        return () => { this.entries = this.entries.filter((e) => e !== entry); };
    }

    private finish(entry: Entry): void {
        entry.step?.(entry.ease(1));
        entry.done();
    }

    /**
     * Move game time to `target`, running whatever falls due on the way in due order, with `now`
     * reading each entry's own due time while its callback runs. That is what lets a callback that
     * schedules the next step land exactly on time even inside one long frame.
     *
     * TICKET 189d: a callback may request a freeze (the impact does: that is the hit-stop). The rest
     * of that frame is then NOT game time, so the step stops where the callback ran and returns how
     * far game time really moved.
     *
     * TICKET 194k-7: but only game time stops, not the instant. Whatever else is due at that SAME
     * game instant still runs before the frame ends. The first version broke out at the freeze, so a
     * card that hits one body three times (three ops due together, each asking for a freeze) ran its
     * second hit after the first hit's freeze and its third after the second's: three stops in a row
     * instead of the one merged stop `HitStop.request` is written to give. Henry: *"VFX sometimes lag
     * like on a multihit with a kill."* Entries due LATER than the freezing callback still wait.
     */
    private moveTo(target: number): number {
        const startedAt = this.nowMs;
        let stoppedAt: number | null = null;
        let errors: unknown[] = [];
        for (let guard = 0; guard < 10_000; guard += 1) {
            let next: Entry | undefined;
            let nextDue = Infinity;
            for (const entry of this.entries) {
                const due = entry.start + entry.ms;
                if (due > target || due >= nextDue) continue;
                // After a freeze, only what is due at the instant it began.
                if (stoppedAt !== null && due > stoppedAt) continue;
                next = entry;
                nextDue = due;
            }
            if (!next) break;
            this.entries = this.entries.filter((e) => e !== next);
            this.nowMs = Math.max(this.nowMs, nextDue);
            const wasFrozen = this.deps.hitStop.active;
            try { this.finish(next); } catch (error) { errors.push(error); }
            if (stoppedAt === null && !wasFrozen && this.deps.hitStop.active) stoppedAt = this.nowMs;
        }
        const reached = stoppedAt ?? target;
        this.nowMs = reached;
        for (const entry of [...this.entries]) {
            if (!entry.step) continue;
            try { entry.step(entry.ease((reached - entry.start) / entry.ms)); } catch (error) { errors.push(error); }
        }
        if (errors.length > 0) {
            const first = errors[0];
            errors = [];
            throw first;
        }
        return reached - startedAt;
    }

    private wake(): void {
        for (const listener of [...this.wakeListeners]) listener();
    }

    /** The multiplier of the last frame, for consumers that sync to it. */
    get lastFrameMultiplier(): number {
        return this.lastMultiplier;
    }
}
