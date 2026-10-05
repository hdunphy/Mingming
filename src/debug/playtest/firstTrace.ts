/**
 * TICKET 195b — the first-Trace line, for the tool.
 *
 * The sentence and the "has this save shown it" rule are the game's own (`ui/hints/firstTraceHint.ts`).
 * The tool is not a screen with an effect to run, so it settles the question where a Trace is gained,
 * inside the move that gains it: ask once, and the save is marked. A replay rebuilds the same answer,
 * because it is made by the same moves in the same order.
 */
import { FIRST_TRACE_LINE, traceHintDue } from '../../ui/hints/firstTraceHint';
import { markTraceHintShown } from '../../ui/store/gameSlice';
import type { World } from './types';

export { FIRST_TRACE_LINE };

/** A Trace has just been gained: is this the save's first (so the line is due)? Marks the save when it is. */
export function noteTraceGained(world: World): boolean {
    if (!traceHintDue(world.store.getState().game)) return false;
    world.store.dispatch(markTraceHintShown());
    return true;
}
