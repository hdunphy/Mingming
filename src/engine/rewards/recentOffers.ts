/**
 * TICKET 185e — **NO REPEATS FROM THE LAST TWO PICKS' SHOWN CARDS.**
 *
 * A card shown on either of the last two card picks (taken or not) is left out of the next offer.
 * If leaving them out would starve the offer (fewer candidates than the offer has slots), they are
 * let back in, the one shown LONGEST AGO first, until there are enough.
 *
 * `recent` is the run's `recentOffers`: one array of card ids per pick, oldest pick first.
 *
 * One job: a pool, the recent offers and a slot count in, the candidates out. Pool order is kept,
 * because the order a draw walks is part of what makes it deterministic.
 */

/** How many past picks are remembered. */
export const RECENT_OFFER_MEMORY = 2;

/** Every recently shown card, the least recently shown first. A card shown twice counts from its latest showing. */
export function recentlyShownOldestFirst(recent: ReadonlyArray<ReadonlyArray<string>>): string[] {
    const lastShown = new Map<string, number>();
    recent.forEach((offer, pickIndex) => offer.forEach((id) => lastShown.set(id, pickIndex)));
    // A stable sort on the pick index keeps first-seen order within a pick.
    return [...lastShown.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

export function candidatesAfterRecent(
    pool: ReadonlyArray<string>,
    recent: ReadonlyArray<ReadonlyArray<string>>,
    slots: number,
): string[] {
    const barred = new Set(recentlyShownOldestFirst(recent));
    let candidates = pool.filter((id) => !barred.has(id));

    // Let them back in, oldest first, until the offer can be filled with distinct cards.
    for (const id of recentlyShownOldestFirst(recent)) {
        if (candidates.length >= slots) break;
        if (!pool.includes(id)) continue;
        barred.delete(id);
        candidates = pool.filter((poolId) => !barred.has(poolId));
    }
    return candidates;
}

/** The memory after one more pick: the new offer appended, only the last `RECENT_OFFER_MEMORY` kept. */
export function rememberOffer(
    recent: ReadonlyArray<ReadonlyArray<string>>,
    offer: ReadonlyArray<string>,
): string[][] {
    return [...recent, offer].slice(-RECENT_OFFER_MEMORY).map((entry) => [...entry]);
}
