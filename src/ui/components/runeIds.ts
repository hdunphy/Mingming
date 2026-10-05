/**
 * Which runes a body holds in this run (ticket 194p). Every screen that draws a `RuneTag` asks this, so
 * the answer is read from one place: `IRunState.patches`, keyed by the roster id.
 */
import type { IRunState } from '../../engine/runTypes';

const NONE: ReadonlyArray<string> = Object.freeze([]);

export function runeIdsOf(run: Pick<IRunState, 'patches'> | null | undefined, memberId: string): ReadonlyArray<string> {
    return run?.patches?.[memberId] ?? NONE;
}
