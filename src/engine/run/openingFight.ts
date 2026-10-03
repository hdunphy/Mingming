import type { IRunState } from '../runTypes';
import { isFightNode } from './encounter';

/**
 * THE RUN OPENS ON ITS FIRST FIGHT — Henry, 2026-10-03.
 *
 * The node a run starts on is a wild underneath (`NODE_KINDS` has no start kind). It used to be
 * marked visited and never fired: the run opened on the map and the first fight was the node after it.
 * Henry tried to report that as a bug ("I start on node one, but never encounter a fight") and the
 * run walker had always fought it, so the walker and the game disagreed by one fight. The game now
 * agrees with the walker: a new run is handed to `startRun` already in the `'encounter'` phase on
 * its entry node, and that fight is the scripted easy opening (`isOpeningFight`, one body), after
 * which the map comes up as usual.
 *
 * A separate function rather than `createRun`'s own phase, so a hand-built run in a test still opens
 * on the map, and so the callers that start a played run (the run-start screen and the text
 * playtester) say so in one word. A run that has already resolved a fight is returned untouched.
 */
export function withOpeningFight(run: IRunState): IRunState {
    const entry = run.nodes.find((node) => node.id === run.currentNodeId);
    if (!entry || !isFightNode(entry.kind) || run.fightsResolved !== 0 || run.phase !== 'map') return run;
    return { ...run, phase: 'encounter' };
}
