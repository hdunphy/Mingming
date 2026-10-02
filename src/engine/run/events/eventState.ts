/**
 * TICKET 168a — what the run remembers about events, read out of `run.eventHistory`.
 *
 * One place answers "has this node played its event?", "has this event been seen?" and "has the
 * power cap been spent?", so the draw, the screen and the walker cannot disagree about them.
 */

import type { IRunState } from '../../runTypes';
import { EMPTY_RELAY_ID } from './emptyRelay';
import type { EventGrant } from './eventSchema';

type History = NonNullable<IRunState['eventHistory']>;
export type EventHistoryEntry = History[number];

/** The event this node already resolved, if any. The first-visit rule is "this returns something". */
export function eventResolvedAt(run: IRunState, nodeId: string): EventHistoryEntry | undefined {
    return (run.eventHistory ?? []).find((entry) => entry.nodeId === nodeId);
}

/**
 * Ids of every event resolved this run — each event appears at most once (rule 3). The Empty Relay
 * is not an event and is left out: it must not count as one seen.
 */
export function seenEventIds(run: IRunState): ReadonlySet<string> {
    return new Set((run.eventHistory ?? []).map((entry) => entry.eventId).filter((id) => id !== EMPTY_RELAY_ID));
}

/** Whether an event has already granted a Driver / a patch this run (rule 5, the power cap). */
export function grantSpent(run: IRunState, grant: EventGrant): boolean {
    return (run.eventHistory ?? []).some((entry) => entry.grants.includes(grant));
}
