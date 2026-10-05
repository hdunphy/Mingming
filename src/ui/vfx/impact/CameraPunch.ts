/**
 * TICKET 190g - THE CAMERA PUNCH. A brief zoom on a big hit: in over 50 ms, back out over 260 ms
 * (Showy 3% x s, Slow 4.5% x s). It rides the same frame loop as the shake and is stepped on game
 * time, so the freeze at the impact holds the zoomed frame, and it ends on a scale of exactly 1.
 */

import type { CameraFrame } from './CameraShake';
import { Track } from './Track';

export const PUNCH_IN_MS = 50;
export const PUNCH_OUT_MS = 260;

export class CameraPunch {
    private readonly track = new Track();

    /** 1 at rest; 1.03 at the top of a Showy punch of a full-strength hit. */
    get scale(): number {
        return 1 + this.track.value;
    }

    get active(): boolean {
        return this.track.active;
    }

    /** `fraction` is how much bigger the picture gets: 0.03 is 3%. A smaller punch never cuts a bigger one short. */
    punch(fraction: number): void {
        if (!(fraction > 0)) return;
        if (this.track.active && this.track.value >= fraction) return;
        const from = this.track.active ? this.track.value : 0;
        this.track.start([
            { atMs: 0, value: from },
            { atMs: PUNCH_IN_MS, value: fraction, ease: 'easeOut' },
            { atMs: PUNCH_IN_MS + PUNCH_OUT_MS, value: 0, ease: 'easeOut' },
        ]);
    }

    step(frame: CameraFrame): number {
        if (!frame.frozen) this.track.step(Number.isFinite(frame.gameDt) ? frame.gameDt : 0);
        return this.scale;
    }

    reset(): void {
        this.track.reset();
    }
}
