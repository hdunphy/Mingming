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
import { COUNTERED_BY, GYM_REGISTRY, gymCompElementPlan, LAUNCH_ELEMENTS, offerGyms } from './gyms';
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

    /*
     * THE ROAD — ticket 206 (Henry, 2026-10-08): *"I think the biome order makes the most sense.
     * Just make this the default but gate closing the ticket on a play test."* It replaces 142 §7's
     * [counter, gym, approach], which opened on the starter's own element (mirror fights).
     *
     * [gym], [counter + gym], approach. The starter the offer invites (the counter) wins biome 1,
     * meets its own element alongside the gym's in biome 2, and the approach is the leader's comp.
     */
    it('walks [gym], [counter + gym], approach', () => {
        const expected: Readonly<Record<string, string[][]>> = {
            Water: [['Water'], ['Nature', 'Water']],
            Fire: [['Fire'], ['Water', 'Fire']],
            Nature: [['Nature'], ['Fire', 'Nature']],
        };
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                expect(offer.biomes).toHaveLength(3);
                const walked = offer.biomes.slice(0, 2).map((b) => [...b.elements]);
                expect(walked).toEqual(expected[offer.gym.element]);
            }
        }
    });

    it('shows all three launch elements on every road', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                const seen = new Set(offer.biomes.flatMap((b) => [...b.elements]));
                expect([...seen].sort()).toEqual([...LAUNCH_ELEMENTS].sort());
            }
        }
    });

    /*
     * The starter the offer invites wins its first biome: the opening is the GYM's element, which
     * the counter beats. The 2026-10-07 run gate measured what this buys (wild 89.3% → 99.5%).
     */
    it('opens on the gym\'s own element, and ends on the gym\'s ground', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                expect(openingElement(offer)).toBe(offer.gym.element);
                expect(offer.biomes[1].elements[0]).toBe(COUNTERED_BY[offer.gym.element]);
                expect(lastElement(offer)).toBe(offer.gym.element);
            }
        }
    });

    /*
     * Biome 1 is mono-element; biome 2 (ticket 206) and the approach (142 §7) are the two-element
     * biomes `IBiome.elements` was left open for (ticket 05).
     */
    it('emits legal biomes: one mono-element, then two pairs', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                for (const [i, biome] of offer.biomes.entries()) {
                    expect(biome.elements.length).toBe(i === 0 ? 1 : 2);
                    for (const element of biome.elements) expect(LAUNCH_ELEMENTS).toContain(element);
                    expect(biome.id).not.toBe('');
                    expect(biome.name).not.toBe('');
                    expect(BiomeSchema.safeParse(biome).success).toBe(true);
                }
                // The approach advertises exactly what its bodies are dealt from.
                const plan = gymCompElementPlan(offer.gym);
                expect(offer.biomes[2].elements).toEqual([...new Set(plan)]);
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

    it('gives a leader ONE ordering across the whole seed space — the roll is gone', () => {
        /*
         * This test used to assert the opposite: two orderings had to appear, because there are
         * exactly two derangements of three elements and a generator that never rolled the second
         * would quietly offer one fixed screen shape forever.
         *
         * Henry's 2026-08-30 ruling deleted that roll. The ordering is now a function of the leader
         * alone, so the seed space must produce exactly ONE ordering per gym — and the assertion
         * has to flip with it rather than being deleted, because "the ordering varies" and "the
         * ordering is fixed" are both bugs under the other rule. What still varies across seeds is
         * which of three NAMED biomes stands in for each element; that is covered by
         * `produces different screens for different seeds`.
         *
         * Ticket 206 (2026-10-08) changed WHICH single ordering, not that there is one: the road
         * is [gym], [counter + gym], approach, read here by each biome's first element, so
         * Emberfall reads Fire > Water > Fire. The doubled Fire is biome 1 and the approach both
         * standing on the leader's element, not a repeated biome: `never repeats a biome within
         * one offer` pins the ids apart.
         */
        const orderings = new Set(
            SWEEP.map((seed) => {
                const emberfall = offerGyms(seed).find((o) => o.gym.id === 'gym_emberfall')!;
                return emberfall.biomes.map((b) => b.elements[0]).join('>');
            }),
        );
        expect(orderings).toEqual(new Set(['Fire>Water>Fire']));
    });
});
