/**
 * `useBattleSpeedControls` — ticket 190a. Plugs the player's hands into the battle clock for the life
 * of a fight.
 *
 * - **Right Shift held** fast-forwards (x3). Listened for on the window, NOT inside the battle's key
 *   handler: that handler stands down on the enemy's turn, and the enemy's turn is exactly when a
 *   player wants to skip ahead.
 * - **Catch-up**: the clock reads "how many are queued" every frame from a `CatchUpBacklog` (the
 *   presenter's waiting beats plus the enemy's cards already played this turn).
 *
 * It returns the two objects the screen needs: `shiftKeys.isAllyModifier(e)` for the ally-targeting
 * keys (Left Shift only), and `backlog` so the enemy loop can say when a turn starts and a card is played.
 * Everything is let go of on unmount, so a held key or a stale backlog cannot carry into the next fight.
 */

import { useEffect, useMemo } from 'react';

import { CatchUpBacklog } from './CatchUpBacklog';
import { patchBattleSpeedInputs, setCatchUpSource } from './battleClockRuntime';
import { ShiftKeys } from './ShiftKeys';

export interface BattleSpeedControls {
    readonly shiftKeys: ShiftKeys;
    readonly backlog: CatchUpBacklog;
}

export function useBattleSpeedControls(queued: () => number): BattleSpeedControls {
    const controls = useMemo<BattleSpeedControls>(() => ({
        shiftKeys: new ShiftKeys((held) => patchBattleSpeedInputs({ fastForward: held })),
        backlog: new CatchUpBacklog(queued),
    // `queued` is the presenter's method, stable for the life of the fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    useEffect(() => {
        const { shiftKeys, backlog } = controls;
        const down = (event: KeyboardEvent): void => shiftKeys.keyDown(event);
        const up = (event: KeyboardEvent): void => shiftKeys.keyUp(event);
        const blur = (): void => shiftKeys.reset();

        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', blur);
        setCatchUpSource(() => backlog.count());

        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', blur);
            shiftKeys.reset();
            setCatchUpSource(null);
        };
    }, [controls]);

    return controls;
}
