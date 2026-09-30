/**
 * TICKET 171b — **A SHOP'S SHELF IS FROZEN AT YOUR FIRST VISIT.**
 *
 * Ticket 142 §7 made the stock static per run by keying its seed on the node and the paid-refresh
 * count. But the card pool is `rewardCardPool(party)`, and the party it was handed was the LIVE one,
 * so the same seed drew a different shelf every time the team changed. Henry, 2026-09-29 playtest:
 * *"The shop changed, the third time I went there"* and *"The shop changed again after I swapped my
 * loadout and dropped skoll from my team."* Both were a recruit and a bench moving the pool.
 *
 * Henry's ruling, 2026-09-30: *"It should be frozen with your first visit."* So the first visit
 * stores the team's species and firmware for that shop (`IRunState.marketParties`), and the shelf is
 * rolled from that snapshot ever after. A paid refresh takes a new snapshot, because a refresh is
 * already a new shelf and the team you have now is the one you are buying for.
 *
 * Only the two fields the pool reads are kept. `rewardCardPool` and `usesV2Pool` ask about species
 * and firmware and nothing else, and a smaller snapshot is a smaller save.
 */

import type { IRewardPartyMember } from '../RewardSystem';
import type { IMarketPartyEntry, IRunState } from '../runTypes';

/** The snapshot of one team, reduced to what the shop's pool reads. */
export function snapshotMarketParty(party: ReadonlyArray<IRewardPartyMember>): IMarketPartyEntry[] {
    return party.map((member) => (
        member.activeOS === undefined
            ? { definitionId: member.definitionId }
            : { definitionId: member.definitionId, activeOS: member.activeOS }
    ));
}

/** The team this shop was frozen with, or undefined if it has not been visited since 171b. */
export function frozenMarketParty(run: IRunState, nodeId: string): ReadonlyArray<IMarketPartyEntry> | undefined {
    return run.marketParties?.[nodeId];
}

/**
 * The team a shop's shelf is rolled for: the frozen one when there is one, otherwise the live team.
 *
 * The fallback is what keeps the balance walker's walks unchanged: it never writes a snapshot, so it
 * keeps rolling every shelf from its live party exactly as before.
 */
export function marketPartyFor(
    run: IRunState,
    nodeId: string,
    live: ReadonlyArray<IRewardPartyMember>,
): ReadonlyArray<IRewardPartyMember> {
    return frozenMarketParty(run, nodeId) ?? live;
}
