/**
 * THE CAMERA — ticket 189d. A trauma meter and the smooth-noise offset it produces.
 *
 * Big hits and kills add trauma (0..1); the picture shakes by `trauma² * 14 px * setting`, and by up
 * to 1.2 degrees of rotation, along smooth noise rather than random jitter. Trauma drains at 1.6 per
 * second of GAME time. Squaring it is why a few small hits in a row are a tremble and one kill is a
 * jolt.
 *
 * It never plays during a freeze: while game time is stopped the offset is zero and the trauma holds
 * where it was, so the shake picks up the moment the freeze lifts (the hit-stop is the pause in front
 * of the shake, not a stutter inside it).
 */

import { SHAKE_SETTING } from './impactMath';

export const TRAUMA_DECAY_PER_SECOND = 1.6;
export const MAX_SHAKE_PX = 14;
export const MAX_SHAKE_DEGREES = 1.2;

export interface CameraOffset {
    readonly x: number;
    readonly y: number;
    readonly degrees: number;
}

export const ZERO_OFFSET: CameraOffset = { x: 0, y: 0, degrees: 0 };

/** The slice of a clock frame the camera reads. */
export interface CameraFrame {
    readonly gameDt: number;
    readonly frozen: boolean;
}

/** Smooth noise in [-1, 1]: two sines that never line up, a different phase per axis. */
export function smoothNoise(timeMs: number, axis: number): number {
    return 0.62 * Math.sin(timeMs * 0.02 + axis * 11.3) + 0.38 * Math.sin(timeMs * 0.047 + axis * 5.1 + 1.7);
}

export class CameraShake {
    private trauma = 0;
    private timeMs = 0;
    private current: CameraOffset = ZERO_OFFSET;

    constructor(private readonly setting: () => number = () => SHAKE_SETTING) {}

    get level(): number {
        return this.trauma;
    }

    /** True while there is anything left to shake, so the driver knows to keep asking for frames. */
    get active(): boolean {
        return this.trauma > 0;
    }

    get offset(): CameraOffset {
        return this.current;
    }

    add(amount: number): void {
        if (!(amount > 0)) return;
        this.trauma = Math.min(1, this.trauma + amount);
    }

    step(frame: CameraFrame): CameraOffset {
        if (frame.frozen) {
            this.current = ZERO_OFFSET;
            return this.current;
        }
        const dt = Number.isFinite(frame.gameDt) && frame.gameDt > 0 ? frame.gameDt : 0;
        this.timeMs += dt;
        this.trauma = Math.max(0, this.trauma - (TRAUMA_DECAY_PER_SECOND * dt) / 1000);
        if (this.trauma <= 0) {
            this.current = ZERO_OFFSET;
            return this.current;
        }
        const shake = this.trauma * this.trauma * Math.max(0, this.setting());
        this.current = {
            x: shake * MAX_SHAKE_PX * smoothNoise(this.timeMs, 0) + 0,
            y: shake * MAX_SHAKE_PX * smoothNoise(this.timeMs, 1) + 0,
            degrees: shake * MAX_SHAKE_DEGREES * smoothNoise(this.timeMs, 2) + 0,
        };
        return this.current;
    }

    reset(): void {
        this.trauma = 0;
        this.timeMs = 0;
        this.current = ZERO_OFFSET;
    }
}
