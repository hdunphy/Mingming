/**
 * HIT-STOP — ticket 146e.
 *
 * Ruling 2: *"Everything gets a hit stop but it scales with damage."* The pause on impact is the
 * cheapest weight in games: a hit that lands and immediately gets on with the turn reads as a
 * number changing, and the same hit with 60ms of stillness in front of it reads as a hit.
 *
 * # WHY IT IS A MODULE AND NOT A HOOK
 *
 * Two very different consumers need the same answer in the same frame: the particle layer's rAF
 * loop (not a React component, and reading refs rather than state) and the stage's framer-motion
 * controls. A hook would give each its own copy and they would drift by a frame, which is exactly
 * the frame the effect lives in. One module, one clock.
 *
 * # WHAT IT ACTUALLY FREEZES, AND WHAT IT DOES NOT
 *
 * - The particle clock: `ParticleField.step` is handed a delta of 0 while stopped, so every
 *   particle holds position AND keeps its remaining life. That is the real thing.
 * - Anything queued through `afterHitStop`: the shake, and 146c's sequence steps. They start when
 *   the stop lifts rather than during it.
 *
 * It does NOT freeze a framer-motion transition already in flight. There is no public API for that
 * — `MotionConfig` sets the transition for animations that START under it, not ones already
 * running — and the honest options were a fake one (re-targeting every control mid-animation, which
 * fights the spring and looks worse than no stop) or this. What is actually moving at the instant
 * of impact is the particles and whatever the impact itself is about to start, and both are
 * covered. The sprite's own hit-shake is a 60ms flash-and-nudge that reads as part of the impact
 * rather than as motion the stop should hold.
 */

/** Floor, in ms: every attack gets at least this. Ruling 2's *"everything gets a hit stop"*. */
export const HIT_STOP_MIN_MS = 30;
/** Ceiling, in ms. A kill takes it outright. */
export const HIT_STOP_MAX_MS = 110;
/** Below this fraction of max HP, a hit is a scratch and takes the floor. */
export const HIT_STOP_FLOOR_FRACTION = 0.05;
/** At and above this fraction, the ceiling. */
export const HIT_STOP_CEILING_FRACTION = 0.35;

/** Stage shake, in px, across the same scale. */
export const SHAKE_MIN_PX = 2;
export const SHAKE_MAX_PX = 8;
/** A kill shakes harder than any survivable hit, because it is not one. */
export const SHAKE_KILL_PX = 10;
export const SHAKE_DURATION_MS = 120;
export const SHAKE_CYCLES = 3;

/**
 * Ruling 2's formula, exactly: `30 + 80 × clamp((applied/maxHp − 0.05) / 0.30, 0, 1)`.
 *
 * Expressed in terms of the four constants above rather than as the literals, so that the ceiling
 * and the floor can be retuned from one place and the shake stays on the same curve by
 * construction — `shakeAmplitudeFor` takes the same normalised `t`.
 */
export function hitStopMsFor(applied: number, maxHp: number, isKill = false): number {
    if (isKill) return HIT_STOP_MAX_MS;
    return HIT_STOP_MIN_MS + (HIT_STOP_MAX_MS - HIT_STOP_MIN_MS) * damageScale(applied, maxHp);
}

/** The same 0..1 the stop uses, so the two can never disagree about how big a hit was. */
export function damageScale(applied: number, maxHp: number): number {
    if (!(maxHp > 0)) return 0;
    const frac = applied / maxHp;
    const span = HIT_STOP_CEILING_FRACTION - HIT_STOP_FLOOR_FRACTION;
    return Math.max(0, Math.min(1, (frac - HIT_STOP_FLOOR_FRACTION) / span));
}

export function shakeAmplitudeFor(applied: number, maxHp: number, isKill = false): number {
    if (isKill) return SHAKE_KILL_PX;
    return SHAKE_MIN_PX + (SHAKE_MAX_PX - SHAKE_MIN_PX) * damageScale(applied, maxHp);
}

/**
 * The shake keyframes: `3` cycles out and back, decaying, ending exactly at 0.
 *
 * Ending at 0 is not a detail — a keyframe list that ends off-centre leaves the whole stage
 * translated for the rest of the fight, and because each shake starts from wherever the last one
 * left it, the board would walk.
 */
export function shakeKeyframes(amplitude: number): number[] {
    const frames: number[] = [0];
    for (let i = 0; i < SHAKE_CYCLES; i += 1) {
        const decay = 1 - i / SHAKE_CYCLES;
        frames.push(-amplitude * decay, amplitude * decay);
    }
    frames.push(0);
    return frames;
}

let stoppedUntil = 0;
const waiting: Array<{ at: number; run: () => void }> = [];

/** Milliseconds of stop remaining, 0 when running. */
export function hitStopRemaining(now: number = performance.now()): number {
    return Math.max(0, stoppedUntil - now);
}

export const isHitStopped = (now: number = performance.now()): boolean => hitStopRemaining(now) > 0;

/**
 * Hold everything for `ms`.
 *
 * Overlapping requests EXTEND rather than restack: two hits in the same frame (a Side card landing
 * on three targets) should feel like one heavier impact, not three stops in a row totalling a third
 * of a second. Taking the later of the two deadlines does that, and it means a big hit is never
 * shortened by a small one arriving behind it.
 */
export function requestHitStop(ms: number, now: number = performance.now()): void {
    if (ms <= 0) return;
    stoppedUntil = Math.max(stoppedUntil, now + ms);
}

/**
 * Run `fn` when the stop lifts — immediately if nothing is stopped.
 *
 * This is how the shake and 146c's sequence steps land AFTER the pause rather than through it. A
 * shake that plays during the stop is the one mistake that makes hit-stop read as a stutter.
 */
export function afterHitStop(fn: () => void, now: number = performance.now()): void {
    const remaining = hitStopRemaining(now);
    if (remaining <= 0) { fn(); return; }
    const at = now + remaining;
    waiting.push({ at, run: fn });
    setTimeout(() => {
        const index = waiting.findIndex((w) => w.run === fn);
        if (index >= 0) waiting.splice(index, 1);
        fn();
    }, remaining);
}

/** Drop the stop and every pending callback. For tests, and for leaving a battle mid-stop. */
export function resetHitStop(): void {
    stoppedUntil = 0;
    waiting.length = 0;
}
