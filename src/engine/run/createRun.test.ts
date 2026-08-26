/**
 * Tests for ticket 09's `createRun` and ticket 08's start-deck rule.
 *
 * The load-bearing test in this file is the `RunStateSchema` parse. `createRun` is the only thing
 * that ever *constructs* an `IRunState` from scratch, and ticket 06's schema is what ticket 23's
 * loader will validate it against on the way back in — so a run this function builds that the
 * schema rejects is a run the player can start and never resume. That one assertion covers the
 * referential integrity refinement (`currentNodeId` names a real node), the three-biome rule, the
 * party cap, and the phase/gauntlet/outcome refinements at once.
 */

import { describe, expect, it, vi } from 'vitest';

import { SeedStream } from '../core/SeedStream';
import { GENERIC_HIT, GetMingmingData, getDeckForOS } from '../data/mingmingRegistry';
import { MACRO_SLOTS, RunStateSchema } from '../runTypes';
import type { IMingmingState } from '../types';
import {
    RECRUIT_KIT_SIZE,
    STARTER_GENERICS,
    START_KIT_SIZE,
    STARTING_SCRAP,
    createRun,
    minimumActiveDeck,
    recruitDeckFor,
    startDeckFor,
} from './createRun';
import { offerGyms } from './gyms';
import { generateRegionGraph } from './regionGraph';

const SEED = 'run-seed-1';

function member(id: string, definitionId: string, activeOS?: string): IMingmingState {
    return { id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 15, defenseIV: 15, hpIV: 15 };
}

/** The ratified tags, read back out of the registry so this test tracks ticket 09's data. */
function ratifiedKit(definitionId: string, os: string): ReadonlyArray<string> {
    return GetMingmingData(definitionId).startKits![os];
}

const KRAKEN = member('m_kraken', 'kraken', 'kraken_v1');
const FENRIR = member('m_fenrir', 'fenrir', 'fenrir_v2');
const HULDRA = member('m_huldra', 'huldra', 'huldra_v1');

function soloInput(overrides: Partial<Parameters<typeof createRun>[0]> = {}) {
    return {
        seed: SEED,
        offer: offerGyms(SEED)[0],
        party: [KRAKEN],
        startedAt: 1_750_000_000_000,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------------------------
// The start-deck rule (ticket 08)
// ---------------------------------------------------------------------------------------------

describe('startDeckFor', () => {
    it('is 8 cards with the starter’s generics, and 5 without', () => {
        /*
         * **Henry, 2026-08-26: *"the STARTER opens with 5 engine + 3 generics = 8 cards. A RECRUIT
         * brings only its 5 engine cards, no generics."*** The generics are the STARTER's allowance
         * (`STARTER_GENERICS`), not a per-member one, so this function has two answers and the
         * caller has to say which it wants — hence the required third parameter.
         *
         * Both cases are pinned here because the interesting failure is the one that looks right:
         * a call site that passes `true` where it meant `false` deals a second helping of filler
         * and every deck-size assertion downstream still looks plausible. Eight is only correct for
         * the member that opens the run.
         */
        const withGenerics = startDeckFor(KRAKEN, new SeedStream(SEED), true);
        expect(withGenerics).toHaveLength(START_KIT_SIZE + STARTER_GENERICS);
        expect(withGenerics).toHaveLength(8);

        const without = startDeckFor(KRAKEN, new SeedStream(SEED), false);
        expect(without).toHaveLength(START_KIT_SIZE);
        expect(without).toHaveLength(5);
        expect(without.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(0);
    });

    it('transcribes the ratified kit in order, payoff first, duplicates included', () => {
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED), true);
        const kit = ratifiedKit('kraken', 'kraken_v1');
        expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([...kit]);
        // Spelled out rather than only compared to the registry, because the ORDER is the design:
        // ticket 61's kit is a five-card engine, `ink_stream` (the payoff the OS is actually paying
        // for) in front and the four cards that fill the pile it counts behind it. A sort or a set
        // comparison would pass while deleting that.
        expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([
            'ink_stream', 'undertow', 'whirlpool_v2', 'pressure_point', 'pressure_point',
        ]);
        // `kraken_v1`'s fifth tag doubles `pressure_point`, so the duplicate case is demonstrated
        // twice over here — but `fenrir_v2` is kept as the second witness because its doubling is
        // load-bearing in a different way: it doubles `ignite` because one is a coin flip and two
        // is an ignition, and a dedupe here would silently hand Fenrir a four-card kit.
        const fenrir = startDeckFor(FENRIR, new SeedStream(SEED), true);
        expect(fenrir.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([
            'pyre_sacrifice', 'ignite', 'ignite', 'molten_core', 'slag_strike',
        ]);
    });

    it('keeps doubled kit cards doubled for every launch species', () => {
        for (const [definitionId, os] of [
            ['fenrir', 'fenrir_v1'], ['fenrir', 'fenrir_v2'],
            ['skoll', 'skoll_v1'], ['skoll', 'skoll_v2'],
            ['kraken', 'kraken_v1'], ['kraken', 'kraken_v2'],
            ['jormungandr', 'jormungandr_v1'], ['jormungandr', 'jormungandr_v2'],
            ['ratatoskr', 'ratatoskr_v1'], ['ratatoskr', 'ratatoskr_v2'],
            ['huldra', 'huldra_v1'], ['huldra', 'huldra_v2'],
        ] as const) {
            const deck = startDeckFor(member('m', definitionId, os), new SeedStream(SEED), true);
            expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([...ratifiedKit(definitionId, os)]);
        }
    });

    it('appends the starter’s generics after the kit, as the None-element hit', () => {
        // Behind the kit, never in front of it: the kit's order is the design (see above), and the
        // filler is what got added to it, so a deck read left to right still opens on the payoff.
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED), true);
        expect(deck.slice(START_KIT_SIZE).map((c) => c.dataId))
            .toEqual([GENERIC_HIT, GENERIC_HIT, GENERIC_HIT]);
        expect(deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(STARTER_GENERICS);
    });

    it('adds no generics at all when it is not the first member', () => {
        // The ruling as one assertion. A second or third starting member is exactly its kit; the
        // starter's three generics were already spent at the top of the party.
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED), false);
        expect(deck.map((c) => c.dataId)).toEqual([...ratifiedKit('kraken', 'kraken_v1')]);
        expect(deck.some((c) => c.dataId === GENERIC_HIT)).toBe(false);
    });

    it('stamps every card with the member as owner, and mints unique instance ids', () => {
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED), true);
        expect(deck.every((c) => c.ownerId === KRAKEN.id)).toBe(true);
        expect(new Set(deck.map((c) => c.instanceId)).size).toBe(deck.length);
    });

    it('falls back to availableOS[0] when the member has no activeOS', () => {
        const noOs = member('m_noos', 'kraken');
        const explicit = member('m_noos', 'kraken', 'kraken_v1');
        const a = startDeckFor(noOs, new SeedStream(SEED), true);
        const b = startDeckFor(explicit, new SeedStream(SEED), true);
        expect(a).toEqual(b);
    });

    // The ten non-launch species have no `startKits` yet, and the balance harness and debug
    // scenarios can still field them. Crashing there would make an untagged species unusable in
    // a debug run for a reason that has nothing to do with the run.
    it('falls back to the tuned deck, with a warning, for an untagged species', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const ymir = member('m_ymir', 'ymir');
            expect(GetMingmingData('ymir').startKits).toBeUndefined();

            const deck = startDeckFor(ymir, new SeedStream(SEED), true);
            expect(deck).toHaveLength(8);
            expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId))
                .toEqual(getDeckForOS('ymir', 'ymir_v1').slice(0, START_KIT_SIZE));
            expect(deck.slice(START_KIT_SIZE).map((c) => c.dataId))
                .toEqual([GENERIC_HIT, GENERIC_HIT, GENERIC_HIT]);

            const message = warn.mock.calls.map((c) => String(c[0])).join('\n');
            expect(message).toContain('ymir');
            expect(message).toContain('ticket 08');
        } finally {
            warn.mockRestore();
        }
    });

    it('is deterministic in the stream it is handed', () => {
        expect(startDeckFor(KRAKEN, new SeedStream(SEED), true))
            .toEqual(startDeckFor(KRAKEN, new SeedStream(SEED), true));
    });
});

describe('recruitDeckFor', () => {
    it('is 5 cards: the recruit’s WHOLE ruled kit and no filler — a non-first starter exactly', () => {
        /*
         * **Henry, 2026-08-26: the generics are the STARTER's allowance, so a recruit brings none.**
         * This is the fifth table. Ticket 08 gave a recruit 3 kit + 1 generic; the 2026-08-24 pass
         * raised it to 5 + 0 after recruiting Ratatoskr into a Fenrir run and getting only the first
         * three of his tagged five — `startKitIdsFor` slices from the front — *"It felt really bad
         * to play Rat without his kit."* Ticket 60 (playtest round 5) made everyone 4 + 2, and this
         * spec makes the engine five tags with three generics for the starter alone.
         *
         * The 2026-08-24 pass fixed the right bug with the wrong lever. Cutting the generic to pay
         * for the missing tags left a recruit playing differently from a starter of the same
         * species, and round 5 found the same hole on the STARTER side anyway: the old table
         * withheld each deck's payoff, so *"ratatoskr's startKit carried none of his engine, making
         * him pure feed."* Tagging the payoff fixed both ends, and once it did there was nothing
         * left for a recruit to be a lesser version OF.
         *
         * **Five is NOT a return to that pass's 5 + 0, and the number arriving in the same place by
         * a different road is the trap this comment exists to mark.** Then, the missing generic was
         * a price a recruit paid for its kit — a recruit was a lesser member. Now nobody's generics
         * are per-member at all: the starter carries three, and every member after that — bought at
         * a workshop or picked at run start — is its five tagged cards and nothing else. So the
         * equality this test ends on is no longer "a recruit is a starter"; it is "a recruit is a
         * member who is not the first one", which is all a recruit ever is.
         */
        const deck = recruitDeckFor(HULDRA, new SeedStream(SEED));
        expect(deck).toHaveLength(RECRUIT_KIT_SIZE);
        expect(deck).toHaveLength(5);
        expect(deck.slice(0, RECRUIT_KIT_SIZE).map((c) => c.dataId)).toEqual([
            ...ratifiedKit('huldra', 'huldra_v1'),
        ]);
        expect(deck.map((c) => c.dataId)).toEqual([
            'hexbloom', 'growth', 'growth', 'iron_bark', 'thorn_tithe',
        ]);
        // Stated as its own assertion because "no filler" is the half of the ruling a future
        // "a recruit should feel like a fresh start" patch would undo without touching the kit
        // size — which is exactly what the 3 + 1 and 4 + 2 tables did, in the other direction.
        expect(deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(0);
        // The ruling in one line: same species, same five, whether you picked it second at run
        // start or bought it at a workshop. `false` is the whole point — compare against a member
        // that is not carrying the starter's generics, because a recruit never is.
        expect(deck.map((c) => c.dataId))
            .toEqual(startDeckFor(HULDRA, new SeedStream(SEED), false).map((c) => c.dataId));
    });

    it('stamps the recruit as owner', () => {
        const deck = recruitDeckFor(HULDRA, new SeedStream(SEED));
        expect(deck.every((c) => c.ownerId === HULDRA.id)).toBe(true);
    });
});

// ---------------------------------------------------------------------------------------------
// The active deck's floor (ticket 61)
// ---------------------------------------------------------------------------------------------

describe('minimumActiveDeck', () => {
    it('is 8 / 13 / 18 by party size — the party’s own base contribution', () => {
        /*
         * *"You can never edit below what the team itself brings — the team is the deck, as a
         * floor."* Pinned as LITERALS as well as against the formula, because 8 / 13 / 18 is the
         * ruled table and asserting only `STARTER_GENERICS + START_KIT_SIZE * n` would let any
         * retune of either constant through green while calling itself the same rule.
         *
         * It is a per-party-size floor rather than the flat 16 an earlier spec named, which is what
         * makes it mean something at every size: a solo run cannot be edited down to four cards and
         * call itself a deck, and a full party cannot bench two members' worth of engine and keep
         * fielding them.
         */
        expect(minimumActiveDeck(1)).toBe(8);
        expect(minimumActiveDeck(2)).toBe(13);
        expect(minimumActiveDeck(3)).toBe(18);

        expect(minimumActiveDeck(1)).toBe(STARTER_GENERICS + START_KIT_SIZE);
        expect(minimumActiveDeck(2)).toBe(STARTER_GENERICS + START_KIT_SIZE * 2);
        expect(minimumActiveDeck(3)).toBe(STARTER_GENERICS + START_KIT_SIZE * 3);
    });

    it('is exactly what createRun deals at each party size', () => {
        // The floor and the opening deck are the same arithmetic said twice, and this is the
        // assertion that keeps them the same: a run opens exactly AT its floor, so the first free
        // edit is one the player has to earn a card for.
        expect(createRun(soloInput()).deck).toHaveLength(minimumActiveDeck(1));
        expect(createRun(soloInput({ party: [KRAKEN, FENRIR] })).deck).toHaveLength(minimumActiveDeck(2));
        expect(createRun(soloInput({ party: [KRAKEN, FENRIR, HULDRA] })).deck)
            .toHaveLength(minimumActiveDeck(3));
    });

    it('has no floor to enforce for an empty party', () => {
        // A party of nobody brings nothing, so there is nothing to keep in the deck. Zero rather
        // than STARTER_GENERICS: the filler rides on a starter that does not exist.
        expect(minimumActiveDeck(0)).toBe(0);
    });
});

// ---------------------------------------------------------------------------------------------
// createRun
// ---------------------------------------------------------------------------------------------

describe('createRun', () => {
    it('produces a run that satisfies RunStateSchema', () => {
        const run = createRun(soloInput());
        const parsed = RunStateSchema.safeParse(run);
        // Print the failure rather than just a red boolean — a refinement failure names the field.
        expect(parsed.success ? null : parsed.error.issues).toBeNull();
        expect(parsed.success).toBe(true);
    });

    it('satisfies RunStateSchema for a full three-member party too', () => {
        const run = createRun(soloInput({ party: [KRAKEN, FENRIR, HULDRA] }));
        expect(RunStateSchema.safeParse(run).success).toBe(true);
    });

    it('is deterministic, card instance ids included', () => {
        expect(createRun(soloInput())).toEqual(createRun(soloInput()));
    });

    it('carries the seed through verbatim', () => {
        expect(createRun(soloInput()).seed).toBe(SEED);
    });

    it('takes gym, tier and biomes from the offer', () => {
        const offer = offerGyms(SEED)[2];
        const run = createRun(soloInput({ offer }));
        expect(run.gymId).toBe(offer.gym.id);
        expect(run.tier).toBe(offer.gym.tier);
        expect(run.biomes).toEqual(offer.biomes);
        expect(run.biomes).toHaveLength(3);
    });

    it('opens on the region graph generated from the same seed', () => {
        const run = createRun(soloInput());
        const graph = generateRegionGraph(SEED);
        expect(run.nodes).toEqual(graph.nodes);
        expect(run.currentNodeId).toBe(graph.entryNodeId);
        expect(run.nodes.some((n) => n.id === run.currentNodeId)).toBe(true);
    });

    it('keeps the party ids in the order given', () => {
        const run = createRun(soloInput({ party: [FENRIR, KRAKEN, HULDRA] }));
        expect(run.partyIds).toEqual(['m_fenrir', 'm_kraken', 'm_huldra']);
    });

    it('gives a solo party an 8-card deck: one kit plus the starter’s three generics', () => {
        const run = createRun(soloInput());
        expect(run.deck).toHaveLength(START_KIT_SIZE + STARTER_GENERICS);
        expect(run.deck).toHaveLength(8);
        expect(run.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(STARTER_GENERICS);
    });

    it('gives a three-member party 18 cards — 8 for the first member, 5 for each of the rest', () => {
        /*
         * **18 = 3 × 5 + 3** (Henry, 2026-08-26). The generics do not multiply with the party: the
         * STARTER gets three, and members two and three bring their five tagged cards and nothing
         * else. A per-member allowance taxed the party for growing — a third member arrived with a
         * third engine AND more `Tackle`s, so a slice of what you were sold was padding. Padding
         * exists to stop a SOLO opening deck being five cards, redrawn every turn; a three-member
         * deck does not need it.
         *
         * The arithmetic coincides with the old per-member 6-card table at three members and NOWHERE
         * else (that table read 6 / 12 / 18), which is exactly why the per-member split is asserted
         * rather than just the total: a total of 18 is also what you would get by handing one
         * generic to each member, and that would be a different rule this sum cannot see.
         */
        const run = createRun(soloInput({ party: [KRAKEN, FENRIR, HULDRA] }));
        expect(run.deck).toHaveLength(3 * START_KIT_SIZE + STARTER_GENERICS);
        expect(run.deck).toHaveLength(18);
        for (const m of [KRAKEN, FENRIR, HULDRA]) {
            const owned = run.deck.filter((c) => c.ownerId === m.id);
            expect(owned).toHaveLength(m === KRAKEN ? START_KIT_SIZE + STARTER_GENERICS : START_KIT_SIZE);
            expect(owned.slice(0, START_KIT_SIZE).map((c) => c.dataId))
                .toEqual([...ratifiedKit(m.definitionId, m.activeOS!)]);
            expect(owned.filter((c) => c.dataId === GENERIC_HIT))
                .toHaveLength(m === KRAKEN ? STARTER_GENERICS : 0);
        }
        // Concatenated in party order, and every instance id distinct across the whole deck.
        expect(run.deck.slice(0, 8).every((c) => c.ownerId === KRAKEN.id)).toBe(true);
        expect(new Set(run.deck.map((c) => c.instanceId)).size).toBe(18);
    });

    it('gives a two-member party 13 cards, the generics on the first', () => {
        // The middle row of the 8 / 13 / 18 table, and the one that catches a per-member relapse
        // fastest: under "generics on every member" it is 16, and under the old 4+2 table it was 10.
        const run = createRun(soloInput({ party: [KRAKEN, FENRIR] }));
        expect(run.deck).toHaveLength(2 * START_KIT_SIZE + STARTER_GENERICS);
        expect(run.deck).toHaveLength(13);
        expect(run.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(STARTER_GENERICS);
        expect(run.deck.filter((c) => c.dataId === GENERIC_HIT).every((c) => c.ownerId === KRAKEN.id))
            .toBe(true);
    });

    it('opens with an empty run collection — the party’s engines ARE the deck', () => {
        // Ticket 61's new field. Nothing is owned-but-unplayed at the start, so `collection` is the
        // one pile that begins empty and the deck is everything the run holds.
        expect(createRun(soloInput()).collection).toEqual([]);
        expect(createRun(soloInput({ party: [KRAKEN, FENRIR, HULDRA] })).collection).toEqual([]);
    });

    it('starts with the ruled 20 opening scrap, and no macros, no drivers and no modifiers', () => {
        /*
         * **Was 0; Henry granted 20 on 2026-08-24.** Ticket 09's zero had the right argument —
         * *"carrying any in would make the first marketplace a function of the previous run"* — but
         * that argument is about CARRYING, and a fixed grant carries nothing: it is the same 20
         * after a win and after a wipe, so no run can bank into the next one and the anti-mudflation
         * rule is untouched. What the 0 cost was measured in the same playtest: early fights pay
         * 10-15, a recruit is 25 and a removal 20, and the first shop lands 1-3 fights in, so the
         * opening shop was a shop you walked past.
         *
         * Pinned as a LITERAL as well as against the constant, because 20 is itself the ruling —
         * *not* 25, which would silently BE a free recruit and take the first workshop's choice away
         * again. Asserting only `STARTING_SCRAP` would let that retune through green.
         */
        const run = createRun(soloInput());
        expect(run.scrap).toBe(STARTING_SCRAP);
        expect(run.scrap).toBe(20);
        expect(run.macros).toHaveLength(MACRO_SLOTS);
        expect(run.macros.every((slot) => slot === null)).toBe(true);
        expect(run.drivers).toEqual([]);
        expect(run.modifiers).toEqual([]);
    });

    it('starts on the map with nothing resolved', () => {
        const run = createRun(soloInput());
        expect(run.phase).toBe('map');
        expect(run.gauntlet).toBeNull();
        expect(run.outcome).toBeNull();
        expect(run.fightsResolved).toBe(0);
    });

    it('uses the injected startedAt and never reads the clock', () => {
        const now = vi.spyOn(Date, 'now');
        try {
            const run = createRun(soloInput({ startedAt: 42 }));
            expect(run.startedAt).toBe(42);
            expect(now).not.toHaveBeenCalled();
        } finally {
            now.mockRestore();
        }
    });

    it('produces different runs for different seeds', () => {
        const a = createRun(soloInput({ seed: 'alpha', offer: offerGyms('alpha')[0] }));
        const b = createRun(soloInput({ seed: 'beta', offer: offerGyms('beta')[0] }));
        expect(a).not.toEqual(b);
        expect(a.deck.map((c) => c.instanceId)).not.toEqual(b.deck.map((c) => c.instanceId));
    });
});
