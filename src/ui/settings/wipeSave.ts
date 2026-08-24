/**
 * THE PLAYER-FACING WIPE — ticket 36, inheriting an orphan from ticket 11.
 *
 * # WHERE THIS CAME FROM
 *
 * `HubScreen` had a "RESTART RUN (WIPE DATA)" button. Ticket 11 deleted the Hub, and ticket 20's
 * resolution recorded the consequence out loud: *"a player-facing wipe is currently unreachable.
 * Ticket 36 (settings screen) owns save management and should carry it."* What actually survived
 * the deletion was `SaveSystem.deleteSave()` — with **zero callers**, its docblock still describing
 * a hub and a defeat path that no longer exist. This module is its new home, and the reason it can
 * stop being dead code.
 *
 * # WHY IT IS NOT JUST `deleteSave()`
 *
 * Because storage is only half of what a wipe has to clear. The store is still holding the ranch
 * and the run, and the autosave subscription writes `state.game` on the very next change — so a
 * wipe that only removed the keys would be undone by the first click after it. The three steps have
 * to happen together and in this order:
 *
 *   1. **the run first** — `clearRun`, so nothing can be mid-fight when the ranch under it vanishes;
 *   2. **the ranch** — `resetSave`, which is what the autosave then persists as an empty ranch;
 *   3. **the bytes** — `deleteSave`, removing both keys of the active slot.
 *
 * Steps 1-2 are what makes step 3 stick. Doing 3 alone is the bug; doing 1-2 alone leaves the old
 * bytes readable by a slot switch.
 *
 * Run telemetry (`mingming_run_telemetry`) goes too, and since ticket 59 so do the run logs
 * (`mingming_run_log`): both are a per-player history of runs, and a player wiping their save does
 * not expect their run clock or a transcript of their last three runs to survive it. Settings and
 * audio do **not** — those are properties of the person, not the save (see `settings.ts`).
 *
 * # WHY IT IS A FUNCTION AND NOT A BUTTON
 *
 * `saveSlots.ts` set the precedent and the argument holds here: dispatch is a parameter, so the
 * whole destructive path is testable headlessly. With no `@testing-library/react` in this repo, a
 * wipe that lived inside an `onClick` would be a wipe no test could ever run.
 */

import { deleteSave } from '../../engine/SaveSystem';
import { clearRunTelemetry } from '../../engine/run/runTelemetry';
import { clearRunLogs } from '../../engine/run/runLog';
import { resetSave } from '../store/gameSlice';
import { clearRun } from '../store/runSlice';

/** Anything that takes the two actions below. `store.dispatch` satisfies it. */
export type WipeDispatch = (action: { type: string; payload?: unknown }) => void;

export interface WipeResult {
    /** What was cleared, in the order it happened — for the screen to report and a test to assert. */
    readonly steps: ReadonlyArray<string>;
}

/**
 * Wipe the active slot and everything the store is holding from it.
 *
 * Deliberately has no failure mode: `deleteSave` already swallows storage errors (there is nothing
 * to remove if storage is unavailable) and the two dispatches cannot fail. A wipe that reported
 * "partially failed" would leave the player with no next action anyway.
 */
export function wipeSave(dispatch: WipeDispatch): WipeResult {
    dispatch(clearRun());
    dispatch(resetSave());
    deleteSave();
    clearRunTelemetry();
    clearRunLogs();
    return { steps: ['run', 'ranch', 'stored save', 'run history', 'run logs'] };
}
