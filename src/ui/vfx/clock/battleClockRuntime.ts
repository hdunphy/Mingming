/**
 * THE BATTLE CLOCK, ASSEMBLED — ticket 189a.
 *
 * The clock, the hit-stop, the speed policy, the one rAF driver and the framer-motion bridge, wired
 * together once. Module-level for the same reason `emit.ts` and the old `hitStop.ts` were: the
 * callers are bus handlers and a particle loop, not components, and a hook would hand each of them
 * its own copy of "now".
 *
 * Every piece is its own small module and tested alone; this file only composes them.
 */

import { BattleClock } from './BattleClock';
import { ClockDriver } from './ClockDriver';
import { ClockedControls } from './ClockedControls';
import { HitStop } from './HitStop';
import { type SpeedInputs, speedMultiplier } from './speedPolicy';

let speedInputs: SpeedInputs = {};

export const battleHitStop = new HitStop();
export const battleClock = new BattleClock({
    speed: () => speedMultiplier(speedInputs),
    hitStop: battleHitStop,
});
export const battleDriver = new ClockDriver(battleClock);
export const battleControls = new ClockedControls();

// The bridge is a frame consumer: it keeps the loop alive only while it is tracking something.
battleDriver.addConsumer((frame) => battleControls.sync(frame));

/** Ticket 190a feeds the speed tier, hold-to-fast-forward and catch-up through this. */
export function setBattleSpeedInputs(inputs: SpeedInputs): void {
    speedInputs = inputs;
}

/**
 * Leave a battle: drop everything pending, any freeze and game time, plus the speed inputs, and park
 * the loop.
 * Awaiters of a cancelled wait never resume, so nothing keeps playing into a screen that is gone.
 */
export function resetBattleClock(): void {
    battleClock.reset();
    battleDriver.park();
    speedInputs = {};
}
