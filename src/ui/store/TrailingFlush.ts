/**
 * RUN SOMETHING ONCE, LATER, HOWEVER OFTEN IT IS ASKED FOR.
 *
 * `request()` marks work as owed and asks the scheduler for a turn; every further `request()` while
 * the work is owed is free. `flushNow()` pays the debt immediately (and cancels the turn), for the
 * moments that cannot wait: the page is closing, somebody is about to read what was owed.
 *
 * It exists for the run log. That log used to be re-serialised and written on a microtask after
 * EVERY dispatch, and in the desktop build the write is a synchronous IPC round trip to the main
 * process that blocks the renderer while the whole file is rewritten. The cost grows with the run,
 * which is why the game slowed down the longer it was played and was worst on the big hits (many
 * dispatches in a few frames).
 *
 * The scheduler is injected so a test turns time by hand instead of waiting for it.
 */
export interface FlushScheduler {
    /** Run `run` later, once. Returns a function that cancels it. */
    schedule(run: () => void): () => void;
}

export class TrailingFlush {
    private pendingFlag = false;
    private cancelScheduled: (() => void) | null = null;

    constructor(
        private readonly action: () => void,
        private readonly scheduler: FlushScheduler,
    ) {}

    /** Is there work owed that has not run yet? */
    get pending(): boolean {
        return this.pendingFlag;
    }

    request(): void {
        if (this.pendingFlag) return;
        this.pendingFlag = true;
        const cancel = this.scheduler.schedule(() => this.fire());
        // A synchronous scheduler has already fired by now; do not keep a stale canceller.
        if (this.pendingFlag) this.cancelScheduled = cancel;
    }

    /** Run the owed work now, if any, and stand down the scheduled turn. */
    flushNow(): void {
        if (!this.pendingFlag) return;
        this.cancelScheduled?.();
        this.fire();
    }

    /** Forget the owed work without running it. */
    cancel(): void {
        this.cancelScheduled?.();
        this.cancelScheduled = null;
        this.pendingFlag = false;
    }

    private fire(): void {
        if (!this.pendingFlag) return;
        this.pendingFlag = false;
        this.cancelScheduled = null;
        this.action();
    }
}

/**
 * The production scheduler: wait `delayMs` (so a burst of dispatches collapses into one write), then
 * take an idle moment if the browser offers them, so the write lands between frames and not in one.
 */
export function idleFlushScheduler(delayMs = 2000): FlushScheduler {
    return {
        schedule(run) {
            let idleHandle: number | null = null;
            let cancelled = false;
            const timer = setTimeout(() => {
                if (cancelled) return;
                if (typeof requestIdleCallback === 'function') {
                    idleHandle = requestIdleCallback(() => { idleHandle = null; if (!cancelled) run(); }, { timeout: 1000 });
                } else {
                    run();
                }
            }, delayMs);
            return () => {
                cancelled = true;
                clearTimeout(timer);
                if (idleHandle !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleHandle);
            };
        },
    };
}
