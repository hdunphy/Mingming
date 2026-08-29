/**
 * RUN TEARDOWN — ticket 19. **The single path all three endings take.**
 *
 * # WHY THIS IS ONE FUNCTION AND NOT THREE HANDLERS
 *
 * A run can end three ways: the gym falls (`BattleArena`'s last gauntlet fight), the party falls
 * (`BattleArena.handleDefeat`), or the player walks out (`RunScreen`'s abandon). The ticket's
 * standing warning is that if those three each do their own unwinding they will drift, and the drift
 * is invisible until it is a bug report — "my gym clear didn't count", "abandoning wiped my roster".
 * So all three end the same way, in two steps:
 *
 *  1. `endRun(outcome)` — marks the run ended and **keeps it**. Ticket 11 split this from `clearRun`
 *     deliberately, because the summary has to read the corpse. That step happens at the three call
 *     sites, because only they know which outcome it was.
 *  2. `teardownRun` — this. One implementation, called from one place (the summary's way out), so
 *     the three endings cannot diverge in what they do to the ranch.
 *
 * # WHAT TEARDOWN IS ALLOWED TO TOUCH
 *
 * **The ranch survives every ending.** Ticket 11 found the bug this rule exists to prevent — the
 * defeat path called `deleteSave()`, which deleted the *ranch*: assembled individuals with
 * unrepeatable stat rolls, blueprint counts, the codex. Nothing here removes anything from the
 * ranch, in any branch, and `runTeardown.test.ts` asserts it explicitly for the defeat case rather
 * than trusting the reading.
 *
 * What teardown writes to the ranch is exactly two things, and both are additive:
 *
 *  - **The codex merge**, on every outcome. A run that ended badly still saw its cards.
 *  - **The gym and tier unlock, on victory only.** A defeat or an abandon dispatches neither — you
 *    do not unlock a tier by walking away from it.
 *
 * Then `clearRun`, which throws the run away; `store.ts`'s autosave arm sees `state.run.run` become
 * null and `saveRun(null)` REMOVES the run key rather than writing a null envelope. So an ended run
 * leaves no bytes behind and the next load takes the "no run" branch by absence.
 *
 * # THE ORDERING IS THE CRASH-SAFETY ARGUMENT
 *
 * Ranch writes first, `clearRun` last — the same reasoning `runSlice.recruitIntoParty` spells out
 * for its own two-slice write. Work out what a crash in the middle leaves behind:
 *
 *  - **Ranch first.** The unlock and the codex entries are committed and the run is still sitting at
 *    `phase: 'ended'`. The player comes back to the summary screen and presses the button again;
 *    every ranch reducer teardown uses is idempotent (`markGymCleared` ignores a gym it already
 *    holds, `recordTierCleared` is monotonic, `recordCodexSeen` dedupes), so the second run of
 *    teardown is a no-op that finally clears the run. Nothing is lost and nothing doubles.
 *  - **`clearRun` first.** The run is gone and the gym clear never happened. The player beat the
 *    leader and the game has no record of it, with nothing left to recover it from — the corpse that
 *    knew which gym it was has been thrown away.
 *
 * One of those is recoverable by pressing a button again and the other is not, so the ordering is
 * not a preference.
 *
 * # WHY THE VICTORY UNLOCK IS DISPATCHED IN TWO PLACES, ON PURPOSE
 *
 * `BattleArena` already dispatches `markGymCleared` + `recordTierCleared` the moment the last
 * gauntlet fight is won, and it should keep doing so: that is ticket 12's "bank it when it happens"
 * argument applied to the clear itself. A player who beats the leader and then loses the app to a
 * crash on the summary screen has beaten the leader.
 *
 * Teardown dispatches them **again**, and both reducers are idempotent by construction, so the
 * second dispatch changes nothing. What it buys is that this function is the *complete* description
 * of what each ending does to the ranch — which is the only way the "defeat and abandon unlock
 * nothing" law can be checked in one place instead of being re-derived from three call sites.
 */

import type { Dispatch } from '@reduxjs/toolkit';

import { codexSeenFrom } from '../../engine/run/runSummary';
import type { IRunState } from '../../engine/runTypes';
import { markGymCleared, recordCodexSeen, recordTierCleared } from './gameSlice';
import { clearRun } from './runSlice';

export interface TeardownRunInput {
    /** The ended run, as `endRun` left it. Its `outcome` is what decides the unlock branch. */
    readonly run: IRunState;
    readonly dispatch: Dispatch;
}

/**
 * Land the run on the ranch and throw it away. Safe to call twice — see the ordering note above.
 *
 * Takes a bare `Dispatch` rather than the store's typed dispatch so that a test can pass a spy and
 * assert the exact action list, which is how "defeat dispatches no unlock" is pinned.
 */
export function teardownRun({ run, dispatch }: TeardownRunInput): void {
    // Every outcome. A lost run still saw its cards, and the codex is an achievement log with zero
    // power attached (`economy-session.md`) — there is nothing to withhold from a loser.
    dispatch(recordCodexSeen(codexSeenFrom(run.deck)));

    if (run.outcome === 'victory') {
        dispatch(markGymCleared(run.gymId));
        dispatch(recordTierCleared(run.tier));
    }

    // Last. The autosave arm removes the run key when this lands.
    dispatch(clearRun());
}
