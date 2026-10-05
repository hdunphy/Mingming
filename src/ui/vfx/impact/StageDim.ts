/**
 * TICKET 190g - THE STAGE DIM. The stage darkens for the wind-up of a huge hit and lifts after the
 * knock-back (opacity up to 0.4 x s). Stepped on game time, so a freeze holds it; ends on exactly 0.
 */

import type { CameraFrame } from './CameraShake';
import { Track, type TrackKey } from './Track';

export class StageDim {
    private readonly track = new Track();

    /** 0..0.4: the opacity of the dark layer. */
    get opacity(): number {
        return this.track.value;
    }

    get active(): boolean {
        return this.track.active;
    }

    run(keys: readonly TrackKey[]): void {
        this.track.start(keys);
    }

    step(frame: CameraFrame): number {
        if (!frame.frozen) this.track.step(Number.isFinite(frame.gameDt) ? frame.gameDt : 0);
        return this.opacity;
    }

    reset(): void {
        this.track.reset();
    }
}
