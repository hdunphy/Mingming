/**
 * TICKET 168a — the cards an event offers: `count` DISTINCT cards from a pool, each one rolled the
 * way a fight reward rolls (`RewardSystem.rollCardFromPool`): a rarity by weight, then a card of
 * that rarity. The difference is that the rarities are RESTRICTED to the ones the event names
 * (Data Fragments offers Common or Uncommon; the Rare Vault only Rare), and the three are distinct.
 *
 * Seeded by the caller's stream, so the same node offers the same three cards on resume.
 */

import { ProgramRegistry } from '../../data/programRegistry';
import { RARITY_WEIGHTS, rewardCardPool } from '../../RewardSystem';
import { SeedStream } from '../../core/SeedStream';
import { nodeSeed } from '../nodeSeed';
import { partyMembersOf } from './eventContext';
import type { EventContext } from './eventContext';
import type { Rarity } from '../../types';

export function rollCardChoices(
    pool: ReadonlyArray<string>,
    rarities: ReadonlyArray<Rarity>,
    count: number,
    stream: SeedStream,
): string[] {
    const allowed = pool.filter((id) => rarities.includes(ProgramRegistry[id]?.rarity as Rarity));
    const chosen: string[] = [];

    for (let slot = 0; slot < count; slot += 1) {
        const remaining = allowed.filter((id) => !chosen.includes(id));
        if (remaining.length === 0) break;

        // Only rarities that still have a card left can be rolled, or the roll could land on an
        // empty cohort and waste the slot.
        const live = rarities.filter((rarity) => remaining.some((id) => ProgramRegistry[id]?.rarity === rarity));
        const total = live.reduce((sum, rarity) => sum + RARITY_WEIGHTS[rarity], 0);
        let roll = stream.next() * total;
        let picked = live[live.length - 1];
        for (const rarity of live) {
            if (roll < RARITY_WEIGHTS[rarity]) { picked = rarity; break; }
            roll -= RARITY_WEIGHTS[rarity];
        }

        const cohort = remaining.filter((id) => ProgramRegistry[id]?.rarity === picked);
        chosen.push(cohort[stream.nextInt(0, cohort.length - 1)]);
    }
    return chosen;
}

/**
 * The three cards a `CARD_PICK` outcome offers on this node: the party's reward pool, restricted to
 * the outcome's rarities. `slot` is the outcome's index in its choice, so a choice with two picks
 * (or two choices with one each) draws from separate streams.
 */
export function offerCards(
    ctx: EventContext,
    outcome: { readonly count: number; readonly rarities: ReadonlyArray<Rarity> },
    slot: string,
): string[] {
    const stream = new SeedStream(new SeedStream(nodeSeed(ctx.run, ctx.node, 'event-offer')).fork(slot));
    return rollCardChoices(rewardCardPool(partyMembersOf(ctx)), outcome.rarities, outcome.count, stream);
}
