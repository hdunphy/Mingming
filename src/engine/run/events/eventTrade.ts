/**
 * TICKET 168e — what a card becomes at the Trader and the Seiðr Cauldron.
 *
 * The Trader gives a random card ONE RARITY HIGHER from the party's reward pool (Common to
 * Uncommon, Uncommon to Rare; a Rare gets a different Rare). The Seiðr Cauldron gives a random card of
 * the SAME element and rarity from the whole rewardable set, never the card itself. Both are seeded
 * from the node and the card given, so the same trade on the same node gives the same card.
 *
 * A `+` card trades as the base card it upgrades: the upgrade is lost with it.
 */

import { ProgramRegistry } from '../../data/programRegistry';
import { baseIdFor } from '../../data/plusRegistry';
import { isRewardable, rewardCardPool } from '../../RewardSystem';
import { SeedStream } from '../../core/SeedStream';
import type { IRunCard } from '../../runTypes';
import { nodeSeed } from '../nodeSeed';
import { partyMembersOf } from './eventContext';
import type { EventContext } from './eventContext';
import { rarityOf } from './eventGive';

/** The rarity a Trader deals for a given rarity. Rare and Epic stay where they are. */
export function tradeUpRarity(rarity: string | undefined): string | undefined {
    if (rarity === 'Common') return 'Uncommon';
    if (rarity === 'Uncommon') return 'Rare';
    return rarity;
}

/** The card a `+` upgrades, or the card itself. */
function baseIdOf(card: Pick<IRunCard, 'dataId'>): string {
    return baseIdFor(card.dataId) ?? card.dataId;
}

function pick(candidates: ReadonlyArray<string>, ctx: EventContext, purpose: string, given: IRunCard): string | null {
    if (candidates.length === 0) return null;
    const stream = new SeedStream(new SeedStream(nodeSeed(ctx.run, ctx.node, purpose)).fork(given.instanceId));
    return candidates[stream.nextInt(0, candidates.length - 1)];
}

/** The card the Trader deals for `given`, or `null` when the pool holds nothing to deal. */
export function tradeUpTarget(ctx: EventContext, given: IRunCard): string | null {
    const baseId = baseIdOf(given);
    const rarity = tradeUpRarity(ProgramRegistry[baseId]?.rarity ?? rarityOf(given));
    const candidates = rewardCardPool(partyMembersOf(ctx))
        .filter((id) => ProgramRegistry[id]?.rarity === rarity && id !== baseId);
    return pick(candidates, ctx, 'event-trade', given);
}

/** The card the Seiðr Cauldron makes of `given`, or `null` when nothing else shares its element and rarity. */
export function recompileTarget(ctx: EventContext, given: IRunCard): string | null {
    const baseId = baseIdOf(given);
    const base = ProgramRegistry[baseId];
    if (!base) return null;
    const candidates = Object.keys(ProgramRegistry)
        .filter((id) => id !== baseId && isRewardable(id)
            && ProgramRegistry[id].element === base.element && ProgramRegistry[id].rarity === base.rarity)
        .sort();
    return pick(candidates, ctx, 'event-recompile', given);
}
