/**
 * TICKET 185e — **NO REPEATS FROM THE LAST TWO PICKS' SHOWN CARDS** (the pure part).
 *
 * Left out of the next offer: every card shown on either of the last two picks. If that would leave
 * fewer candidates than slots, they come back OLDEST FIRST until there are enough.
 */
import { describe, it, expect } from 'vitest';
import { candidatesAfterRecent, recentlyShownOldestFirst, rememberOffer, RECENT_OFFER_MEMORY } from './recentOffers';

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('ticket 185e — recently shown cards', () => {
    it('remembers the last two picks', () => {
        expect(RECENT_OFFER_MEMORY).toBe(2);
        let memory: string[][] = [];
        memory = rememberOffer(memory, ['a', 'b', 'c']);
        memory = rememberOffer(memory, ['d', 'e', 'f']);
        expect(memory).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']]);
        memory = rememberOffer(memory, ['g', 'h', 'a']);
        expect(memory).toEqual([['d', 'e', 'f'], ['g', 'h', 'a']]);
    });

    it('leaves out every card either of the last two picks showed, and keeps pool order', () => {
        expect(candidatesAfterRecent(POOL, [['a', 'b'], ['c', 'd']], 3)).toEqual(['e', 'f', 'g', 'h']);
    });

    it('is the whole pool when nothing was shown', () => {
        expect(candidatesAfterRecent(POOL, [], 3)).toEqual(POOL);
    });

    it('lets cards back in, oldest first, only as many as it takes', () => {
        // 8 cards, 6 recently shown: 2 candidates left, 3 slots. One card must come back, and it is the
        // card shown LONGEST AGO: 'a' (first pick, first position).
        const recent = [['a', 'b', 'c'], ['d', 'e', 'f']];
        expect(candidatesAfterRecent(POOL, recent, 3)).toEqual(['a', 'g', 'h']);
    });

    it('lets back in two when it takes two, the oldest pick\'s cards first', () => {
        const recent = [['a', 'b', 'c'], ['d', 'e', 'f']];
        expect(candidatesAfterRecent(POOL.slice(0, 7), recent, 3)).toEqual(['a', 'b', 'g']);
    });

    it('counts a card shown on both picks from its LATEST showing', () => {
        // 'a' was shown on both picks, so it was shown most recently on the second; 'b' only on the
        // first, so 'b' is the one shown longest ago and comes back first.
        expect(recentlyShownOldestFirst([['a', 'b'], ['a', 'c']])).toEqual(['b', 'a', 'c']);
        expect(candidatesAfterRecent(['a', 'b', 'c', 'x'], [['a', 'b'], ['a', 'c']], 2)).toEqual(['b', 'x']);
    });

    it('returns the whole pool when even that cannot fill the slots, so the caller can pad', () => {
        expect(candidatesAfterRecent(['a', 'b'], [['a'], ['b']], 3)).toEqual(['a', 'b']);
    });

    it('ignores recently shown cards that are not in this pool', () => {
        expect(candidatesAfterRecent(['a', 'b', 'c', 'd'], [['zzz', 'a']], 3)).toEqual(['b', 'c', 'd']);
        expect(candidatesAfterRecent(['a', 'b'], [['zzz', 'yyy']], 2)).toEqual(['a', 'b']);
    });
});
