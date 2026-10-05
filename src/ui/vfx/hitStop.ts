/**
 * HIT-STOP — ticket 146e, rebuilt on the battle clock by ticket 189a and fed by the impact by 189d.
 *
 * Ruling 2: *"Everything gets a hit stop but it scales with damage."* The pause on impact is the
 * cheapest weight in games: a hit that lands and immediately gets on with the turn reads as a
 * number changing, and the same hit with 60ms of stillness in front of it reads as a hit.
 *
 * How long (`60 + 80 s`, 170 on a kill, and so on) is `impact/impactMath.ts`. This module is only the
 * freeze itself: a stop freezes GAME time, which every wait, play, particle and (through
 * `ClockedControls`) framer-motion animation runs on, so particles and sprite motion both hold. It
 * is a module and not a hook because its callers are a bus handler and a particle loop, and a hook
 * would hand each of them its own copy of "now".
 *
 * Overlapping requests EXTEND rather than restack (`HitStop.request`): two hits in the same frame
 * should feel like one heavier impact, not three stops in a row.
 */

import { battleClock, battleHitStop } from './clock/battleClockRuntime';

/** Real milliseconds of freeze remaining, 0 when running. */
export function hitStopRemaining(): number {
    return battleHitStop.remainingMs;
}

export const isHitStopped = (): boolean => battleClock.frozen;

/** Freeze game time for `ms` (a Showy-tier length; battle speed shrinks it, Instant removes it). */
export function requestHitStop(ms: number): void {
    battleClock.freeze(ms);
}

/**
 * Run `fn` when the freeze lifts — immediately if nothing is frozen. A shake that plays during the
 * stop is the one mistake that makes hit-stop read as a stutter.
 */
export function afterHitStop(fn: () => void): void {
    if (!battleClock.frozen) { fn(); return; }
    // `after(0)` is due the moment game time moves again, which is exactly when the freeze ends.
    battleClock.after(0, fn);
}

/** Drop the freeze. For tests, and for leaving a battle mid-stop. */
export function resetHitStop(): void {
    battleHitStop.reset();
}
