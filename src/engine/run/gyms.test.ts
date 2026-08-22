/**
 * Tests for ticket 09's run-start offer generator.
 *
 * The interesting checks here are the ones that cannot be proved by looking at one seed. Rule 2
 * ("three different opening elements") is a *guarantee*, not a tendency — a generator that gets it
 * right 90% of the time is a generator that hands ~1 player in 10 an offer screen with no safe
 * opening — so every structural rule below is asserted across a wide seed sweep rather than a
 * single example.
 */

import { describe, expect, it } from 'vitest';

import { BiomeSchema } from '../runTypes';
import { GYM_REGISTRY, LAUNCH_ELEMENTS, offerGyms } from './gyms';
import type { IGymOffer } from './gyms';

/** Wide enough that a per-offer coin flip on the ordering could not survive it. */
const SWEEP = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

function openingElement(offer: IGymOffer): string {
    return offer.biomes[0].elements[0];
}

function lastElement(offer: IGymOffer): string {
    return offer.biomes[2].elements[0];
}

describe('GYM_REGISTRY', () => {
    it('holds ticket 05\'s three launch leaders, one per launch element, all tier 0', () => {
        const gyms = Object.values(GYM_REGISTRY);
        expect(gyms).toHaveLength(3);
        expect(gyms.map((g) => g.id).sort()).toEqual(['gym_emberfall', 'gym_rootfall', 'gym_tidewrack']);
        expect([...gyms.map((g) => g.element)].sort()).toEqual([...LAUNCH_ELEMENTS].sort());
        for (const gym of gyms) expect(gym.tier).toBe(0);
    });

    it('keys every entry by its own id, so a lookup by gymId cannot return a different gym', () => {
        for (const [key, gym] of Object.entries(GYM_REGISTRY)) expect(gym.id).toBe(key);
    });
});

describe('offerGyms', () => {
    it('returns exactly three offers', () => {
        for (const seed of SWEEP) expect(offerGyms(seed)).toHaveLength(3);
    });

    it('offers all three leaders on every screen', () => {
        for (const seed of SWEEP) {
            const ids = offerGyms(seed).map((o) => o.gym.id).sort();
            expect(ids).toEqual(['gym_emberfall', 'gym_rootfall', 'gym_tidewrack']);
        }
    });

    // Rule 2 — the one generator guarantee ticket 07's resolution adds. The party is picked after
    // the gym, so three different openings is what lets the player always answer the first biome.
    it('opens the three offers on three DIFFERENT elements, on every seed', () => {
        for (const seed of SWEEP) {
            const openings = offerGyms(seed).map(openingElement);
            expect(new Set(openings).size).toBe(3);
        }
    });

    // Rule 3 — a run walks the whole triangle, so a region is a permutation of the launch set.
    it('walks all three launch elements in every offer', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                expect(offer.biomes).toHaveLength(3);
                const elements = offer.biomes.map((b) => b.elements[0]);
                expect([...elements].sort()).toEqual([...LAUNCH_ELEMENTS].sort());
            }
        }
    });

    // Rule 4 — the reading this module took: you fight the leader at the end of its own region.
    it('puts the gym\'s own element last, and never first', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                expect(lastElement(offer)).toBe(offer.gym.element);
                expect(openingElement(offer)).not.toBe(offer.gym.element);
            }
        }
    });

    // Ticket 05's mono-element amendment. `IBiome.elements` admits two so friendly pairs can ship
    // later without a save migration; nothing this generator emits may use that headroom yet.
    it('emits mono-element biomes that satisfy BiomeSchema', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                for (const biome of offer.biomes) {
                    expect(biome.elements).toHaveLength(1);
                    expect(LAUNCH_ELEMENTS).toContain(biome.elements[0]);
                    expect(biome.id).not.toBe('');
                    expect(biome.name).not.toBe('');
                    expect(BiomeSchema.safeParse(biome).success).toBe(true);
                }
            }
        }
    });

    it('never repeats a biome within one offer', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                expect(new Set(offer.biomes.map((b) => b.id)).size).toBe(3);
            }
        }
    });

    it('is deterministic in the seed', () => {
        for (const seed of SWEEP.slice(0, 20)) {
            expect(offerGyms(seed)).toEqual(offerGyms(seed));
        }
    });

    it('produces different screens for different seeds', () => {
        const distinct = new Set(SWEEP.map((seed) => JSON.stringify(offerGyms(seed))));
        // Not "all 200 differ": the screen is a small finite object (which leader sits leftmost,
        // which of the two orderings is in play, and which of three named biomes stands in for
        // each element), so collisions across 200 seeds are expected and correct. What would be a
        // bug is a generator that ignores its seed.
        expect(distinct.size).toBeGreaterThan(10);
    });

    it('uses both biome orderings across the seed space', () => {
        // There are exactly two derangements of three elements, so a generator that never rolled
        // the second one would still pass every rule above while quietly offering one fixed screen
        // shape forever. Pin the offer to one leader to read the ordering cleanly.
        const orderings = new Set(
            SWEEP.map((seed) => {
                const emberfall = offerGyms(seed).find((o) => o.gym.id === 'gym_emberfall')!;
                return emberfall.biomes.map((b) => b.elements[0]).join('>');
            }),
        );
        expect(orderings).toEqual(new Set(['Nature>Water>Fire', 'Water>Nature>Fire']));
    });
});
