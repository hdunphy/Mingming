/**
 * TICKET 185e — **ONE WEIGHTED DRAW, IN PLACE OF "ROLL A RARITY, THEN PICK EVENLY".**
 *
 * Each candidate's weight is `RARITY_WEIGHTS[its rarity] ÷ (candidates of that rarity) × its
 * multiplier`. With every multiplier at 1 that is EXACTLY the old odds: the old draw picked a
 * rarity by weight and then a card of it evenly, which is the same number written as a product.
 *
 * Two rules for a rarity with no candidates, because the two callers had two behaviours and both
 * are kept exactly:
 *
 *   - `fallToCommon` (a fight reward): an empty tier's weight goes to the Common cohort, or, when
 *     there is no Common either, is spread over every candidate. This is what the old roll did
 *     when it landed on a tier the pool did not have (the Early-Access pool has no Epic, so 5% of
 *     rolls always landed on Common).
 *   - `liveOnly` (an event's restricted pick): an empty tier simply is not rolled, which is what
 *     the event draw did by only rolling rarities that still had a card.
 *
 * Pure: a candidate list and a number in `[0, 1)` in, a card out. The caller owns the random
 * stream, so a fight's seed chain and an event's `SeedStream` both drive the same function.
 */
import type { Rarity } from '../types';

export type EmptyTierRule = 'fallToCommon' | 'liveOnly';

export interface CandidateWeight {
    readonly cardId: string;
    readonly weight: number;
}

const RARITIES: ReadonlyArray<Rarity> = ['Common', 'Uncommon', 'Rare', 'Epic'];

export function weighCandidates(
    candidates: ReadonlyArray<string>,
    rarityOf: (cardId: string) => Rarity | undefined,
    rarityWeights: Readonly<Record<Rarity, number>>,
    multiplierOf: (cardId: string) => number,
    rule: EmptyTierRule,
): CandidateWeight[] {
    const cohortSize = new Map<Rarity, number>();
    for (const id of candidates) {
        const rarity = rarityOf(id);
        if (rarity !== undefined) cohortSize.set(rarity, (cohortSize.get(rarity) ?? 0) + 1);
    }

    // The mass the empty tiers would have rolled. Only a fight reward re-homes it.
    let orphanMass = 0;
    if (rule === 'fallToCommon') {
        for (const rarity of RARITIES) if (!cohortSize.has(rarity)) orphanMass += rarityWeights[rarity];
    }
    const commonSize = cohortSize.get('Common') ?? 0;

    return candidates.map((cardId) => {
        const rarity = rarityOf(cardId);
        const size = rarity === undefined ? 0 : cohortSize.get(rarity) ?? 0;
        // A cohort's mass is shared evenly by its cards: weight ÷ (cards of that rarity).
        let weight = size > 0 && rarity !== undefined ? rarityWeights[rarity] / size : 0;
        if (orphanMass > 0) {
            if (commonSize > 0) {
                // The old roll fell to the Common cohort...
                if (rarity === 'Common') weight += orphanMass / commonSize;
            } else {
                // ...and with no Common either, to the whole pool evenly.
                weight += orphanMass / candidates.length;
            }
        }
        return { cardId, weight: weight * multiplierOf(cardId) };
    });
}

/** Walk the cumulative weights with `u` in `[0, 1)`. A zero total falls back to the first candidate. */
export function pickByWeight(weighted: ReadonlyArray<CandidateWeight>, u: number): string {
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return weighted[0].cardId;
    let roll = u * total;
    for (const entry of weighted) {
        if (roll < entry.weight) return entry.cardId;
        roll -= entry.weight;
    }
    return weighted[weighted.length - 1].cardId;
}
