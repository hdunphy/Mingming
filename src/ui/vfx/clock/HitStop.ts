/**
 * THE CLOCK'S HIT-STOP — ticket 189a. Replaces the module-level `stoppedUntil` in `../hitStop.ts`.
 *
 * A freeze is in REAL milliseconds: it has to hold even when game time is running fast, and it has
 * to stop game time COMPLETELY (the old stop only paused particles, and none existed yet when it
 * fired, so nobody could see it).
 *
 * The class owns one number, the real milliseconds of freeze left. The clock hands it each frame's
 * real delta through `consume`, and gets back only the part of that frame that is not frozen.
 */

import { isInstantSpeed } from './speedPolicy';

/** No freeze is shorter than this: below it nobody can see the pause. */
export const HIT_STOP_FLOOR_MS = 30;

/**
 * How long a requested freeze really lasts at a clock speed: `max(30, ms / sqrt(speed))`.
 * It shrinks at high speed, but never below the floor, and it is 0 at Instant.
 */
export function freezeLengthMs(ms: number, speed: number): number {
    if (isInstantSpeed(speed)) return 0;
    const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
    return Math.max(HIT_STOP_FLOOR_MS, safeMs / Math.sqrt(safeSpeed));
}

export class HitStop {
    private remaining = 0;

    /** Real milliseconds of freeze left; 0 when running. */
    get remainingMs(): number {
        return this.remaining;
    }

    get active(): boolean {
        return this.remaining > 0;
    }

    /**
     * Freeze for `ms` (a Showy-tier length; the speed shrinks it). Overlapping requests EXTEND
     * rather than restack: two hits in the same frame should feel like one heavier impact, and a
     * big hit is never shortened by a small one arriving behind it.
     */
    request(ms: number, speed = 1): void {
        if (!(ms > 0) || isInstantSpeed(speed)) return;
        this.remaining = Math.max(this.remaining, freezeLengthMs(ms, speed));
    }

    /** Feed one frame's real delta; get back the part of it that is NOT frozen. */
    consume(realDt: number): number {
        if (this.remaining <= 0) return realDt;
        const eaten = Math.min(this.remaining, realDt);
        this.remaining -= eaten;
        if (this.remaining < 1e-9) this.remaining = 0;
        return realDt - eaten;
    }

    reset(): void {
        this.remaining = 0;
    }
}
