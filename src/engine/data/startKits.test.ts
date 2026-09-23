import { describe, it, expect } from 'vitest';
import { MingmingRegistry, PLAYABLE_SPECIES, LAUNCH_SPECIES, GENERIC_HIT, getDeckForOS } from './mingmingRegistry';
import { GetProgramData, ProgramRegistry } from './programRegistry';
import { START_KIT_SIZE } from '../run/createRun';

/**
 * THE GLUE each collection-v2 kit carries — ticket 162a, replacing ticket 61's payoff table.
 *
 * # WHY THE PAYOFF TABLE IS GONE, AND WHAT REPLACED IT
 *
 * Ticket 61 ruled a kit to be "the signature payoff plus four enablers", payoff first, and this
 * file held the registry to a transcribed list of the twelve payoffs. Ticket 161 §2 — applied by
 * collection v2 and ruled by Henry on 2026-09-23 — rules the opposite for the same slot: a start
 * kit **holds no consume**, because *"the consume and the second lane are found in the run"*.
 *
 * Those are the same card for most decks. `sun_devourer` (consume all your Strength) was skoll_v1's
 * ratified payoff and is now in her POOL, not her kit; `unbound_fang` and `bark_smash` sit at
 * `startCopies: 0` for exactly this reason. So "lead with the payoff" is not a rule the v2 kits
 * break by accident — it is a rule the newer ruling replaces, and restoring it here would put this
 * file in opposition to the collection rather than in support of it.
 *
 * What is asserted instead is what 161 and 162 actually promise, and each of these can fail:
 * the kit is five cards, it is a sub-multiset of the deck, it carries the deck's GLUE (the one
 * neutral card every v2 kit holds — `forage` or `tackle`), and it holds no consume.
 *
 * This table is still a SECOND copy of a column rather than a read of the data, for the reason the
 * old one was: a test that reads the registry to check the registry asserts that the data equals
 * itself.
 */
const KIT_GLUE: Readonly<Record<string, string>> = {
    fenrir_v1: 'forage',
    fenrir_v2: 'forage',
    skoll_v1: 'forage',
    skoll_v2: 'forage',
    kraken_v1: 'undertow',
    kraken_v2: 'tackle',
    jormungandr_v1: 'undertow',
    jormungandr_v2: 'tackle',
    ratatoskr_v1: 'forage',
    ratatoskr_v2: 'forage',
    huldra_v1: 'soothe',
    huldra_v2: 'tackle',
};

/**
 * A card that CONSUMES a resource — the shape 161 §2 keeps out of an opening hand.
 *
 * Derived from the card's own data rather than listed, so the day a card gains a consume it leaves
 * every start kit that holds it without anyone remembering this file exists.
 */
const isConsume = (dataId: string): boolean =>
    (GetProgramData(dataId).actions ?? []).some(a => a.type === 'STATUS' && a.consume === true);

/**
 * startKit invariants — **ticket 61's five-card engine table** (supersedes ticket 60's).
 *
 * A run does not start with a species' whole tuned deck: every member brings 5 startKit cards, and
 * the STARTER adds 3 generics on top of its five for an 8-card opening deck (Henry, 2026-08-26).
 * A recruit brings the same five any member that is not the first one brings, and no generics. The
 * tuned deck is still the design target the run builds back toward, so a startKit is a SUBSET of it
 * - a tag saying which five survive the cut, never a separate list. That is the invariant these tests exist to hold: the day a deck pass
 * drops a card, the kit that still names it must fail here rather than silently dealing a card the
 * player's deck no longer contains.
 *
 * **What the payoff rule added to that, and why it is the assertion with teeth.** Ticket 09's table
 * deliberately left each deck's PAYOFF out, so the run could build back toward it. Playtest round 5:
 * *"ratatoskr's startKit carried none of his engine, making him pure feed."* The shape is now payoff
 * + 4 enablers, and the shape is checkable - `KIT_PAYOFF` below names the card every kit must lead
 * with, taken from the ratified table, and a deck pass that renames or re-roles that card fails here
 * rather than in someone's playtest three weeks later. Ticket 60 tried the same shape at four tags;
 * Henry cut that on 2026-08-26 because four tagged cards was too thin to play a species with, so the
 * payoff column below is unchanged and every kit gained a fifth card behind it.
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
            // Ticket 61: five, and the same five for a starter and a recruit. Read from the
            // constant rather than a literal, because the day these disagree is the day one
            // species silently opens differently from every other.
            expect(def.startKits?.[osId], `${id}: no kit for ${osId}`).toBeDefined();
            expect(def.startKits![osId]).toHaveLength(START_KIT_SIZE);
        });

        it.each(def.availableOS)('%s deck: carries its glue card', osId => {
            /*
             * 162 §2's rule, and the answer to the other half of round 5's complaint. Every v2 kit
             * holds one neutral card whose job is flow or a floor — `forage`, `tackle`, `undertow`,
             * `soothe` — so no deck is nine cards that all want a board state it has to build first.
             *
             * ASSERTED AGAINST THE DECK, NOT THE OPENING FIVE, and the difference is a measured
             * fact rather than a convenience: six of the twelve kits give their glue
             * `startCopies: 0` (fenrir_v2, skoll_v1, skoll_v2, ratatoskr_v2, huldra_v1, huldra_v2),
             * so those six open on five engine cards and draw the glue later. If the glue is meant
             * to be in the opening hand of all twelve, that is a change to the collection's
             * `startCopies` column and this assertion tightens to the kit with it.
             */
            const glue = KIT_GLUE[osId];
            expect(glue, `${osId} has no glue card in this test's table`).toBeDefined();
            expect(getDeckForOS(id, osId)).toContain(glue);
        });

        it.each(def.availableOS)('%s kit: holds no consume — 161 §2', osId => {
            // "The consume and the second lane are found in the run." A consume in an opening hand
            // is a card that reads as a blank until the deck has built something to spend.
            const consumes = def.startKits![osId].filter(isConsume);
            expect(consumes, `${osId}: opening kit holds a consume`).toEqual([]);
        });

        it.each(def.availableOS)('%s kit: brings 4 more behind the first', osId => {
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

        /*
         * "NEVER TAGS THE GENERIC" IS ALSO RETIRED — ticket 162a.
         *
         * The rule was that GENERIC_HIT is the STARTER's filler, dealt on top of the tagged five,
         * so tagging it would spend an identity slot on a card the run hands out anyway. Collection
         * v2 inverts it deliberately: every kit carries a glue card IN the kit (162 §2, "Quick Scan
         * in every kit that lacked draw", superseded by Forage in v2.1), and for four of the twelve
         * that glue IS `tackle`. The assertion above — that the kit carries its named glue — is
         * what replaced it, and it is the stronger claim of the two: this one only said which card
         * must be ABSENT.
         */
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
