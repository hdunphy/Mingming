/**
 * THE BRIDGE TO FRAMER-MOTION — ticket 189a ("useClockedControls", minus the hook).
 *
 * framer-motion's imperative `animate()` returns playback controls with `.speed`, `.pause()`,
 * `.play()` and `.complete()`. This class tracks the live ones and holds them to the battle clock:
 *
 * - `.speed` follows the clock multiplier (190 changes the multiplier; nothing here changes again);
 * - a hit-stop freeze pauses them, and the end of the freeze resumes them — a sprite that is
 *   mid-lunge when the hit lands holds still with the particles instead of sliding through the pause;
 * - at Instant they are completed, so skipping animation skips the lunge and the card flight too.
 *
 * It is a plain class so it tests without React; `useClockedControls` is the hook that scopes one
 * component's tracked controls to its lifetime.
 */

import type { ClockFrame } from './BattleClock';
import { isInstantSpeed } from './speedPolicy';

/** The part of framer-motion's playback controls this bridge touches. */
export interface PlaybackLike {
    speed: number;
    pause(): void;
    play(): void;
    complete?(): void;
    /** framer's controls are thenable: this fires when the animation ends by itself. */
    then?(onResolve: () => void, onReject?: () => void): unknown;
}

export class ClockedControls {
    private readonly live = new Set<PlaybackLike>();
    private readonly paused = new Set<PlaybackLike>();
    private frozen = false;
    private instant = false;
    private speed = 1;

    get size(): number {
        return this.live.size;
    }

    /** Hold `controls` to the clock until it finishes, or the returned release is called. */
    track(controls: PlaybackLike): () => void {
        if (this.instant) {
            this.safely(() => controls.complete?.());
            return () => undefined;
        }
        this.live.add(controls);
        this.safely(() => { controls.speed = this.speed; });
        if (this.frozen) this.pauseOne(controls);
        const release = () => {
            this.live.delete(controls);
            this.paused.delete(controls);
        };
        controls.then?.(release, release);
        return release;
    }

    /** Apply one clock frame. Returns true while anything is still tracked (the driver keeps looping). */
    sync(frame: ClockFrame): boolean {
        this.instant = isInstantSpeed(frame.multiplier);
        if (this.instant) {
            for (const controls of [...this.live]) this.safely(() => controls.complete?.());
            this.live.clear();
            this.paused.clear();
            this.frozen = false;
            return false;
        }

        if (frame.multiplier !== this.speed) {
            this.speed = frame.multiplier;
            for (const controls of this.live) this.safely(() => { controls.speed = this.speed; });
        }

        if (frame.frozen && !this.frozen) {
            this.frozen = true;
            for (const controls of this.live) this.pauseOne(controls);
        } else if (!frame.frozen && this.frozen) {
            this.frozen = false;
            for (const controls of [...this.paused]) {
                this.safely(() => controls.play());
                this.paused.delete(controls);
            }
        }
        return this.live.size > 0;
    }

    private pauseOne(controls: PlaybackLike): void {
        if (this.paused.has(controls)) return;
        this.paused.add(controls);
        this.safely(() => controls.pause());
    }

    /** A control cancelled underneath us must never take the frame loop down with it. */
    private safely(fn: () => void): void {
        try { fn(); } catch { /* the animation is already gone */ }
    }
}
