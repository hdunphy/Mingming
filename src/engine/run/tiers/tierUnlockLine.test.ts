/**
 * TICKET 185f — the summary names the tier a clear UNLOCKED, read from `unlockedTiers`, and a clear
 * at the top tier names none.
 */
import { describe, expect, it } from 'vitest';
import { MAX_TIER } from './tierRegistry';
import { unlockedTiers } from './tierUnlocks';
import { clearLine, tierUnlockedBy } from './tierUnlockLine';

/** A ranch that has cleared `gym` at the given tiers. */
const ranchWith = (...tiers: number[]) => ({ gymsCleared: ['rootfall'], tierClears: { rootfall: tiers } });

describe('ticket 185f — the line a clear prints', () => {
    it('a tier-0 clear reads "tier 1 unlocked"', () => {
        expect(clearLine('Rootfall', 0, unlockedTiers(ranchWith(0)))).toBe('Rootfall cleared · tier 1 unlocked');
    });

    it('a tier-1 clear reads "tier 2 unlocked"', () => {
        expect(clearLine('Rootfall', 1, unlockedTiers(ranchWith(0, 1)))).toBe('Rootfall cleared · tier 2 unlocked');
    });

    it('a clear at the top tier says "top tier" and names no higher tier', () => {
        const line = clearLine('Rootfall', MAX_TIER, unlockedTiers(ranchWith(0, 1, 2, MAX_TIER)));
        expect(line).toBe('Rootfall cleared · top tier');
        expect(line).not.toContain('unlocked');
        expect(line).not.toContain(`tier ${MAX_TIER + 1}`);
    });

    it('names the tier the clear opened even when a higher one was already open', () => {
        // Tier 3 was unlocked by an earlier clear on another gym; this tier-0 clear still opens tier 1
        // as far as the player is concerned, and the line must not jump to the top of the list.
        expect(tierUnlockedBy(0, [0, 1, 2, 3])).toBe(1);
    });

    it('says only "cleared" when the ranch shows nothing above the cleared tier (the clear is not recorded yet)', () => {
        expect(clearLine('Rootfall', 0, [0])).toBe('Rootfall cleared');
    });

    it('is the cleared tier plus one for every tier below the top, so the screen never needs the arithmetic', () => {
        for (let tier = 0; tier < MAX_TIER; tier += 1) {
            const cleared = Array.from({ length: tier + 1 }, (_, t) => t);
            expect(tierUnlockedBy(tier, unlockedTiers(ranchWith(...cleared)))).toBe(tier + 1);
        }
    });
});
