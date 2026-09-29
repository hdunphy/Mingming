/**
 * TICKET 168b — Drivers that last for the next fight only.
 *
 * Three pure functions over `IRunState.tempDrivers`: which are active, add one, and count them down
 * after a fight. The reducers in `runSlice` call these; `battleSetup` reads `tempDriverIds`.
 *
 * Engine module: no React, no Redux, no `Math.random()`.
 */

import type { IRunState } from '../runTypes';

type TempDrivers = NonNullable<IRunState['tempDrivers']>;

/** The ids of the temporary Drivers the next fight runs under, in the order they were gained. */
export function tempDriverIds(run: IRunState): string[] {
    return (run.tempDrivers ?? []).map((entry) => entry.driverId);
}

/** Add `fights` fights of a Driver. One already held has its `fightsLeft` added to, not doubled up. */
export function withTempDriver(current: TempDrivers | undefined, driverId: string, fights: number): TempDrivers {
    const held = current ?? [];
    if (!Number.isInteger(fights) || fights < 1) return held;
    if (held.some((entry) => entry.driverId === driverId)) {
        return held.map((entry) => (
            entry.driverId === driverId ? { ...entry, fightsLeft: entry.fightsLeft + fights } : entry
        ));
    }
    return [...held, { driverId, fightsLeft: fights }];
}

/** One fight has been played: every Driver has one fewer left, and a Driver at 0 is dropped. */
export function afterFight(current: TempDrivers | undefined): TempDrivers {
    return (current ?? [])
        .map((entry) => ({ ...entry, fightsLeft: entry.fightsLeft - 1 }))
        .filter((entry) => entry.fightsLeft > 0);
}
