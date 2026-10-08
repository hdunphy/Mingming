/**
 * TICKET 202c — WHICH RUN THIS IS, for the status line: "run 1 of 2", "run 2 of 2".
 *
 * Only a session that allows two runs says so (`new` marks it; `again` marks run 2). A session written before
 * 202c has no mark and prints exactly what it always printed.
 */
import { RUNS_A_SESSION } from './secondRun';
import type { World } from './types';

export function runLabel(world: World): string | null {
    return world.header.twoRuns === true ? `run ${world.runNumber} of ${RUNS_A_SESSION}` : null;
}
