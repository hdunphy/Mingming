import { describe, it, expect } from 'vitest';
import { MingmingRegistry, PLAYABLE_SPECIES, LAUNCH_SPECIES, GENERIC_HIT, getDeckForOS } from './mingmingRegistry';
import { GetProgramData, ProgramRegistry } from './programRegistry';
import { START_KIT_SIZE } from '../run/createRun';

/**
 * The payoff each ratified kit must lead with — ticket 60's table, transcribed.
 *
 * Deliberately a SECOND copy of the table's first column rather than a read of `startKits[os][0]`,
 * which would assert that the data equals itself. This is the ticket's ruling written down where a
 * test can hold the registry to it; changing a kit's payoff means changing the ruling and this line
 * together, on purpose, which is the point.
 */
const KIT_PAYOFF: Readonly<Record<string, string>> = {
    fenrir_v1: 'ragnarok_edge',
    fenrir_v2: 'pyre_sacrifice',
    skoll_v1: 'sun_devourer',
    skoll_v2: 'overdrive',
    kraken_v1: 'ink_stream',
    kraken_v2: 'hydro_blast',
    jormungandr_v1: 'ink_stream',
    jormungandr_v2: 'contagion',
    ratatoskr_v1: 'seed_bomb_v2',
    ratatoskr_v2: 'crippling_vine',
    huldra_v1: 'hexbloom',
    huldra_v2: 'blightbloom',
};

/**
 * startKit invariants — **ticket 60's mini-engine table** (supersedes ticket 09's).
 *
 * A run does not start with a species' whole tuned deck: every member brings 4 startKit cards, and
 * the RUN adds 2 generics on top of the first mingming's four (Henry, 2026-08-25 - they used to be
 * 2 per member). A recruit brings the same four any member that is not the first one brings. The
 * tuned deck is still the design target the run builds back toward, so a startKit is a SUBSET of it
 * - a tag saying which four survive the cut, never a separate list. That is the invariant these tests exist to hold: the day a deck pass
 * drops a card, the kit that still names it must fail here rather than silently dealing a card the
 * player's deck no longer contains.
 *
 * **What ticket 60 added to that, and why it is the assertion with teeth.** The old table tagged
 * five cards and deliberately left each deck's PAYOFF out, so the run could build back toward it.
 * Playtest round 5: *"ratatoskr's startKit carried none of his engine, making him pure feed."* The
 * shape is now payoff + 3 enablers, and the shape is checkable - `KIT_PAYOFF` below names the card
 * every kit must lead with, taken from the ratified table, and a deck pass that renames or re-roles
 * that card fails here rather than in someone's playtest three weeks later. That is the exact ask
 * sent to the deck-archetypes wayfinder on 2026-08-25.
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

        it.each(def.availableOS)(`%s kit: exactly ${START_KIT_SIZE} cards`, osId => {
            // Ticket 60: four, and the same four for a starter and a recruit. Read from the
            // constant rather than a literal, because the day these disagree is the day one
            // species silently opens differently from every other.
            expect(def.startKits?.[osId], `${id}: no kit for ${osId}`).toBeDefined();
            expect(def.startKits![osId]).toHaveLength(START_KIT_SIZE);
        });

        it.each(def.availableOS)('%s kit: LEADS with the ratified payoff', osId => {
            /*
             * The whole of ticket 60 in one assertion. A kit is a mini-engine - one payoff and the
             * three cards that make it happen - and the payoff being present is what round 5 found
             * missing. First position is not decoration: `startKitIdsFor` transcribes the list in
             * order, so leading with the payoff is what makes the tag list readable as the design
             * rather than as a set.
             */
            const payoff = KIT_PAYOFF[osId];
            expect(payoff, `${osId} has no ratified payoff in this test's table`).toBeDefined();
            expect(def.startKits![osId][0]).toBe(payoff);
        });

        it.each(def.availableOS)('%s kit: brings 3 enablers behind the payoff', osId => {
            // Stated separately from the length so a failure says WHICH half of the shape broke.
            expect(def.startKits![osId].slice(1)).toHaveLength(START_KIT_SIZE - 1);
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
            // GENERIC_HIT is the RUN's filler, dealt on top of the tagged four and only to the
            // first mingming. Tagging it would spend one of the four identity slots on a card the
            // run may hand out for free anyway.
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
