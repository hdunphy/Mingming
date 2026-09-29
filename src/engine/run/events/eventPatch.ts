/**
 * TICKET 168e — the patch the Black-Market Patch fits: each unpatched body's BEST patch
 * (`bestPatchFor`, exactly as the elite offers), so the player's decision is which body to improve.
 */

import { elitePatchOffer } from '../../RewardSystem';
import type { EventContext } from './eventContext';
import { partyMembersOf } from './eventContext';

export function patchOffers(ctx: EventContext): Array<{ memberId: string; patchId: string }> {
    const party = partyMembersOf(ctx).map((member) => ({ id: member.id, definitionId: member.definitionId, activeOS: member.activeOS }));
    return elitePatchOffer(party, ctx.run.patches ?? {});
}
