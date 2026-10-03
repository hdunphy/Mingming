/**
 * TICKET 190g - A NUMBER THAT FOLLOWS KEYS OVER GAME TIME. The small piece the stage dim and the camera
 * punch share: give it keys (a value at each millisecond), feed it the frame's game delta, and it
 * returns where the number is. It is stepped on GAME time, so a hit-stop (which stops game time)
 * holds it where it is; and it ends exactly on its last key, so a zoom comes back to exactly 1.
 */

export type TrackEase = 'linear' | 'easeOut' | 'easeIn';

export interface TrackKey {
    readonly atMs: number;
    readonly value: number;
    /** How the value gets here from the key before. */
    readonly ease?: TrackEase;
}

const EASES: Readonly<Record<TrackEase, (u: number) => number>> = {
    linear: (u) => u,
    easeOut: (u) => 1 - (1 - u) * (1 - u),
    easeIn: (u) => u * u,
};

export class Track {
    private keys: readonly TrackKey[] = [];
    private time = 0;
    private running = false;
    private current = 0;

    get value(): number {
        return this.current;
    }

    /** True while there is still a key to reach, so the driver keeps asking for frames. */
    get active(): boolean {
        return this.running;
    }

    start(keys: readonly TrackKey[]): void {
        if (keys.length < 2) {
            this.reset();
            return;
        }
        this.keys = keys;
        this.time = 0;
        this.current = keys[0].value;
        this.running = true;
    }

    step(dtMs: number): number {
        if (!this.running || !(dtMs > 0)) return this.current;
        this.time += dtMs;
        const last = this.keys[this.keys.length - 1];
        if (this.time >= last.atMs) {
            this.current = last.value;
            this.running = false;
            return this.current;
        }
        let i = 0;
        while (i < this.keys.length - 2 && this.time >= this.keys[i + 1].atMs) i += 1;
        const from = this.keys[i];
        const to = this.keys[i + 1];
        const span = to.atMs - from.atMs;
        const u = span > 0 ? Math.min(1, Math.max(0, (this.time - from.atMs) / span)) : 1;
        this.current = from.value + (to.value - from.value) * EASES[to.ease ?? 'linear'](u);
        return this.current;
    }

    reset(): void {
        this.keys = [];
        this.time = 0;
        this.running = false;
        this.current = 0;
    }
}
