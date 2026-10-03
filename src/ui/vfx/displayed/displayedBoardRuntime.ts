/**
 * THE DISPLAYED BOARD, ASSEMBLED — ticket 189c. One per screen, module-level for the same reason
 * `battleClock` is: its writers are beats played off the clock, and its readers are components.
 */

import { battleClock } from '../clock/battleClockRuntime';
import { DisplayedBoard } from './DisplayedBoard';

export const displayedBoard = new DisplayedBoard(battleClock);

/*
 * §189c's safety net speaks up in dev builds: a missed beat is a bug to fix, not a number to shrug
 * at. The board has already snapped to real state by the time this runs.
 */
if (import.meta.env.DEV) {
    displayedBoard.onMismatch = (mismatches) => {
        for (const m of mismatches) {
            console.error(
                `[displayedBoard] ${m.id} showed ${m.shownHp} HP with the presenter idle; real state is ${m.realHp}. Snapped. A beat is missing.`,
            );
        }
    };
}
