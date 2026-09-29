/**
 * TICKET 167f — at most one call per animation frame, keeping the latest value.
 *
 * `mousemove` fires far faster than a screen can show, and each one would be a React `setState`.
 * This holds the newest value and hands it over once per frame. `cancel()` drops a pending value,
 * which matters: a frame that lands AFTER the pointer has left the row must not re-open the tile.
 *
 * Deliberately not a hook: it owns no React state, so the hook that uses it can stay small.
 */
export class FrameCoalescer<T> {
    private pending: { readonly value: T } | null = null;
    private frame: number | null = null;

    constructor(private readonly deliver: (value: T) => void) {}

    push(value: T): void {
        this.pending = { value };
        if (this.frame !== null) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            const next = this.pending;
            this.pending = null;
            if (next) this.deliver(next.value);
        });
    }

    cancel(): void {
        this.pending = null;
        if (this.frame !== null) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }
    }
}
