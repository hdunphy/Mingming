import { describe, it, expect } from 'vitest';
import { MingmingRegistry, PLAYABLE_SPECIES, LAUNCH_SPECIES, GENERIC_HIT, getDeckForOS } from './mingmingRegistry';
import { GetProgramData, ProgramRegistry } from './programRegistry';

/**
 * startKit invariants (ticket 09, rule from ticket 08).
 *
 * A run does not start with a species' whole tuned deck: a member brings 5 startKit cards
 * plus 3 generics, a recruit 3 plus 1. The tuned deck is still the design target the run
 * builds back toward, so a startKit is a SUBSET of it - a tag saying which five survive the
 * cut, never a separate list. That is the invariant these tests exist to hold: the day a
 * deck pass drops a card, the kit that still names it must fail here rather than silently
 * dealing a card the player's deck no longer contains.
 *
 * Scope is the six launch species only (ticket 05). The other ten are asserted UNTAGGED so
 * the narrow scope is a stated decision rather than an accident of which ids happen to have
 * data today - when a species is tagged, that assertion fails and someone has to widen the
 * scope on purpose.
 */
describe('start kits', () => {
    it('LAUNCH_SPECIES is the ticket-05 roster: 6 species, all playable', () => {
        expect(LAUNCH_SPECIES).toHaveLength(6);
        for (const id of LAUNCH_SPECIES) {
            expect(MingmingRegistry[id], `unknown launch species '${id}'`).toBeDefined();
            // A launch species that is also a measuring instrument would ship the balance
            // control to players - ticket 42's whole point.
            expect(PLAYABLE_SPECIES).toContain(id);
        }
    });

    describe.each([...LAUNCH_SPECIES])('%s', id => {
        const def = MingmingRegistry[id];

        it('is tagged for every one of its availableOS ids', () => {
            // A partially tagged species is worse than an untagged one: the missing OS would
            // fall back to whatever the caller does with `undefined`, silently, per firmware.
            expect(def.startKits, `${id} has no startKits`).toBeDefined();
            expect(Object.keys(def.startKits!).sort()).toEqual([...def.availableOS].sort());
        });

        it.each(def.availableOS)('%s kit: exactly 5 cards', osId => {
            // 5 is the member number from ticket 08. Recruits take 3 from the same tag set,
            // so the tag itself is always the full five and the recruit trim happens on draw.
            expect(def.startKits?.[osId], `${id}: no kit for ${osId}`).toBeDefined();
            expect(def.startKits![osId]).toHaveLength(5);
        });

        it.each(def.availableOS)('%s kit: is a subset of that OS deck, copy counts respected', osId => {
            const deck = getDeckForOS(id, osId);
            const deckCounts: Record<string, number> = {};
            for (const cardId of deck) deckCounts[cardId] = (deckCounts[cardId] ?? 0) + 1;

            // Counting rather than membership-testing is the point: a kit naming a card twice
            // is asking for two physical copies, and a deck holding only one cannot supply it.
            const kitCounts: Record<string, number> = {};
            for (const cardId of def.startKits![osId]) kitCounts[cardId] = (kitCounts[cardId] ?? 0) + 1;

            for (const [cardId, wanted] of Object.entries(kitCounts)) {
                expect(
                    deckCounts[cardId] ?? 0,
                    `${osId}: kit wants ${wanted}x '${cardId}', deck has ${deckCounts[cardId] ?? 0}`,
                ).toBeGreaterThanOrEqual(wanted);
            }
        });

        it.each(def.availableOS)('%s kit: never tags the generic', osId => {
            // GENERIC_HIT is what the other 3 slots are FILLED with (ticket 08). Tagging it
            // would spend one of the five identity slots on a card the run gets for free.
            expect(def.startKits![osId], `${osId}: tags GENERIC_HIT`).not.toContain(GENERIC_HIT);
        });
    });

    it('GENERIC_HIT resolves to a real, element-neutral program', () => {
        expect(ProgramRegistry[GENERIC_HIT], `GENERIC_HIT '${GENERIC_HIT}' is not in ProgramRegistry`).toBeDefined();
        const program = GetProgramData(GENERIC_HIT);
        expect(program.id).toBe(GENERIC_HIT);
        // Neutrality is the requirement, not a property of this particular card: a generic
        // handed to all six launch species must give none of them STAB.
        expect(program.element).toBe('None');
    });

    it('non-launch species are untagged, so the scope above is deliberate', () => {
        for (const id of Object.keys(MingmingRegistry)) {
            if (LAUNCH_SPECIES.includes(id)) continue;
            expect(
                MingmingRegistry[id].startKits,
                `'${id}' is tagged but is not a launch species - widen LAUNCH_SPECIES or drop the tags`,
            ).toBeUndefined();
        }
    });
});
