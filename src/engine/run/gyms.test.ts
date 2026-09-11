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
     * RULE 3 IS RETIRED — ticket 142 §7, Henry 2026-09-11, off the 09-10 playtest (*"the current
     * road is not fun"*). A region no longer walks the triangle: it is [counter, gym, approach],
     * and the approach is built from the leader's comp rather than from an element.
     *
     * The cost is the thing to keep visible, so it is asserted rather than described. Rootfall
     * never stands in a Water biome, so kraken and jormungandr cannot be recruited on that route -
     * Henry accepted that in the same breath: *"It's fine if there are no Water mingmings in
     * there."* If that is ever revisited, this test is the one that has to be argued with.
     */
    it('walks [counter, gym, approach] — not the triangle', () => {
        const expected: Readonly<Record<string, string[]>> = {
            Water: ['Nature', 'Water'],
            Fire: ['Water', 'Fire'],
            Nature: ['Fire', 'Nature'],
        };
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                expect(offer.biomes).toHaveLength(3);
                const walked = offer.biomes.slice(0, 2).map((b) => b.elements[0]);
                expect(walked).toEqual(expected[offer.gym.element]);
            }
        }
    });

    it('leaves one launch element off every route — the accepted cost', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                const walked = new Set(offer.biomes.slice(0, 2).map((b) => b.elements[0]));
                const missing = LAUNCH_ELEMENTS.filter((e) => !walked.has(e));
                // Exactly one, and it is the element the GYM beats — the leg that used to be
                // biome 3 before the approach replaced it.
                expect(missing).toHaveLength(1);
                expect(missing[0]).not.toBe(offer.gym.element);
            }
        }
    });

    /*
     * THE LEADER NOW STANDS ON ITS OWN GROUND. This inverts the old rule-4 pin, which existed to
     * stop a "fix" quietly reverting Henry's 2026-08-30 ordering. That ordering is what 09-11
     * replaced, and the thematic complaint it knowingly accepted (Tidewrack's Water leader fought
     * at the end of a Fire biome) is the complaint the new road exists to answer.
     */
    it('ends on the gym\'s own ground, and opens on what beats it', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                expect(openingElement(offer)).toBe(COUNTERED_BY[offer.gym.element]);
                expect(offer.biomes[1].elements[0]).toBe(offer.gym.element);
                expect(lastElement(offer)).toBe(offer.gym.element);
            }
        }
    });

    /*
     * The approach is the FIRST two-element biome the generator has ever emitted - `IBiome.elements`
     * admitted two so friendly pairs could ship without a save migration (ticket 05), and §7 is the
     * first caller to spend that headroom. The first two legs stay mono-element.
     */
    it('emits legal biomes: two mono-element, then the comp\'s elements', () => {
        for (const seed of SWEEP) {
            for (const offer of offerGyms(seed)) {
                for (const [i, biome] of offer.biomes.entries()) {
                    expect(biome.elements.length).toBe(i === 2 ? 2 : 1);
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
         * Ticket 142 §7 (2026-09-11) changed WHICH single ordering, not that there is one: the
         * road is [counter, gym, approach], and the approach leads with the gym's element, so
         * Emberfall reads Water > Fire > Fire. The doubled Fire is the approach standing on the
         * leader's own ground - the whole point of the new road - and not a repeated biome:
         * `never repeats a biome within one offer` pins the ids apart.
         */
        const orderings = new Set(
            SWEEP.map((seed) => {
                const emberfall = offerGyms(seed).find((o) => o.gym.id === 'gym_emberfall')!;
                return emberfall.biomes.map((b) => b.elements[0]).join('>');
            }),
        );
        expect(orderings).toEqual(new Set(['Water>Fire>Fire']));
    });
});
