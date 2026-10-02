/**
 * TICKET 168a — what an event's eligibility check and the draw are allowed to look at.
 *
 * The run, the node being entered, and a thin VIEW of the ranch (the roster's species and the
 * blueprint counts). It is structural rather than `IRanchState` so the balance walker, which holds
 * no ranch slice, can pass what it does hold.
 */

import { withEffectiveOS } from '../effectiveOS';
import type { IRegionNode, IRunState } from '../../runTypes';

export interface EventRanchView {
    /** `activeOS` is optional: the duplicate clause (species + firmware) reads it when it is there. */
    readonly roster: ReadonlyArray<{ readonly id: string; readonly definitionId: string; readonly activeOS?: string }>;
    readonly blueprints: Readonly<Record<string, number>>;
}

export interface EventContext {
    readonly run: IRunState;
    readonly node: IRegionNode;
    readonly ranch: EventRanchView;
}

/** The party's members, in party order, as the reward pool wants them (`{ definitionId }`). */
export function partyMembersOf(ctx: EventContext): Array<{ id: string; definitionId: string; activeOS?: string }> {
    // TICKET 168f: a body the run has reflashed is on its new OS here, as everywhere in a run.
    return ctx.run.partyIds
        .map((id) => ctx.ranch.roster.find((member) => member.id === id))
        .filter((member): member is { id: string; definitionId: string; activeOS?: string } => member !== undefined)
        .map((member) => withEffectiveOS(ctx.run, member));
}
