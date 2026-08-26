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
    RUN_GENERICS,
    START_KIT_SIZE,
    STARTING_SCRAP,
    createRun,
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
    it('is 6 cards with the run’s generics, and 4 without', () => {
        /*
         * **Henry, 2026-08-25: *"Only add generics for the first mingming. After that the second
         * and third mingmings do not need to add an additional generic card."*** The generics are a
         * RUN-level allowance now (`RUN_GENERICS`), not a per-member one, so this function has two
         * answers and the caller has to say which it wants — hence the required third parameter.
         *
         * Both cases are pinned here because the interesting failure is the one that looks right:
         * a call site that passes `true` where it meant `false` deals a second helping of filler
         * and every deck-size assertion downstream still looks plausible. Six is only correct for
         * the member that opens the run.
         */
        const withGenerics = startDeckFor(KRAKEN, new SeedStream(SEED), true);
        expect(withGenerics).toHaveLength(START_KIT_SIZE + RUN_GENERICS);
        expect(withGenerics).toHaveLength(6);

        const without = startDeckFor(KRAKEN, new SeedStream(SEED), false);
        expect(without).toHaveLength(START_KIT_SIZE);
        expect(without).toHaveLength(4);
        expect(without.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(0);
    });

    it('transcribes the ratified kit in order, payoff first, duplicates included', () => {
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED), true);
        const kit = ratifiedKit('kraken', 'kraken_v1');
        expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([...kit]);
        // Spelled out rather than only compared to the registry, because the ORDER is the design:
        // ticket 60's kit is a mini-engine, `ink_stream` (the payoff the OS is actually paying for)
        // in front and the three cards that fill the pile it counts behind it. A sort or a set
        // comparison would pass while deleting that.
        expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([
            'ink_stream', 'undertow', 'whirlpool_v2', 'pressure_point',
        ]);
        // Ticket 60 retagged `kraken_v1` down to four singletons, so the duplicate case has to be
        // demonstrated somewhere it still exists or this test's "duplicates included" is a claim
        // about nothing. `fenrir_v2` doubles `ignite` because one is a coin flip and two is an
        // ignition; a dedupe here would silently hand Fenrir a three-card kit.
        const fenrir = startDeckFor(FENRIR, new SeedStream(SEED), true);
        expect(fenrir.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([
            'pyre_sacrifice', 'ignite', 'ignite', 'molten_core',
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

    it('appends the run’s generics after the kit, as the None-element hit', () => {
        // Behind the kit, never in front of it: the kit's order is the design (see above), and the
        // filler is what got added to it, so a deck read left to right still opens on the payoff.
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED), true);
        expect(deck.slice(START_KIT_SIZE).map((c) => c.dataId)).toEqual([GENERIC_HIT, GENERIC_HIT]);
        expect(deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(RUN_GENERICS);
    });

    it('adds no generics at all when it is not the first member', () => {
        // The ruling as one assertion. A second or third starting member is exactly its kit; the
        // run's two generics were already spent at the top of the party.
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
            expect(deck).toHaveLength(6);
            expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId))
                .toEqual(getDeckForOS('ymir', 'ymir_v1').slice(0, START_KIT_SIZE));
            expect(deck.slice(START_KIT_SIZE).map((c) => c.dataId)).toEqual([GENERIC_HIT, GENERIC_HIT]);

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
    it('is 4 cards: the recruit’s WHOLE ruled kit and no filler — a non-first starter exactly', () => {
        /*
         * **Henry, 2026-08-25: the generics are a RUN-level allowance, so a recruit brings none.**
         * This is the fourth table. Ticket 08 gave a recruit 3 kit + 1 generic; the 2026-08-24 pass
         * raised it to 5 + 0 after recruiting Ratatoskr into a Fenrir run and getting only the first
         * three of his tagged five — `startKitIdsFor` slices from the front — *"It felt really bad
         * to play Rat without his kit."* Ticket 60 (playtest round 5) made everyone 4 + 2.
         *
         * The 2026-08-24 pass fixed the right bug with the wrong lever. Cutting the generic to pay
         * for the missing tags left a recruit playing differently from a starter of the same
         * species, and round 5 found the same hole on the STARTER side anyway: the old table
         * withheld each deck's payoff, so *"ratatoskr's startKit carried none of his engine, making
         * him pure feed."* Tagging the payoff and cutting the fourth enabler fixed both ends, and
         * once it did there was nothing left for a recruit to be a lesser version OF.
         *
         * **Four is NOT a return to that pass's 5 + 0, and the number arriving in the same place by
         * a different road is the trap this comment exists to mark.** Then, the missing generic was
         * a price a recruit paid for its kit — a recruit was a lesser member. Now nobody's generics
         * are per-member at all: the run has two, the first mingming carries them, and every member
         * after that — bought at a workshop or picked at run start — is its four tagged cards and
         * nothing else. So the equality this test ends on is no longer "a recruit is a starter"; it
         * is "a recruit is a member who is not the first one", which is all a recruit ever is.
         */
        const deck = recruitDeckFor(HULDRA, new SeedStream(SEED));
        expect(deck).toHaveLength(RECRUIT_KIT_SIZE);
        expect(deck).toHaveLength(4);
        expect(deck.slice(0, RECRUIT_KIT_SIZE).map((c) => c.dataId)).toEqual([
            ...ratifiedKit('huldra', 'huldra_v1'),
        ]);
        expect(deck.map((c) => c.dataId)).toEqual([
            'hexbloom', 'growth', 'iron_bark', 'thorn_tithe',
        ]);
        // Stated as its own assertion because "no filler" is the half of the ruling a future
        // "a recruit should feel like a fresh start" patch would undo without touching the kit
        // size — which is exactly what the 3 + 1 and 4 + 2 tables did, in the other direction.
        expect(deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(0);
        // The ruling in one line: same species, same four, whether you picked it second at run
        // start or bought it at a workshop. `false` is the whole point — compare against a member
        // that is not carrying the run's generics, because a recruit never is.
        expect(deck.map((c) => c.dataId))
            .toEqual(startDeckFor(HULDRA, new SeedStream(SEED), false).map((c) => c.dataId));
    });

    it('stamps the recruit as owner', () => {
        const deck = recruitDeckFor(HULDRA, new SeedStream(SEED));
        expect(deck.every((c) => c.ownerId === HULDRA.id)).toBe(true);
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

    it('gives a solo party a 6-card deck: one kit plus the run’s two generics', () => {
        const run = createRun(soloInput());
        expect(run.deck).toHaveLength(START_KIT_SIZE + RUN_GENERICS);
        expect(run.deck).toHaveLength(6);
        expect(run.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(RUN_GENERICS);
    });

    it('gives a three-member party 14 cards — 6 for the first member, 4 for each of the rest', () => {
        /*
         * **14, not 18** (Henry, 2026-08-25). The generics stopped multiplying with the party: the
         * run gets two, the first member carries them, and members two and three bring their four
         * tagged cards and nothing else. The old 18 taxed the party for growing — a third member
         * arrived with a third engine AND two more `Tackle`s, so a third of what you were sold was
         * padding. Padding exists to stop a SOLO opening deck being four cards; a three-member deck
         * does not need it, and 14 is what leaves a full party room inside the 20-25 gate.
         *
         * The per-member split is asserted rather than just the total, because a total of 14 is also
         * what you would get by handing the generics to the LAST member, or by splitting them one
         * and one — both of which would be a different rule that this arithmetic cannot see.
         */
        const run = createRun(soloInput({ party: [KRAKEN, FENRIR, HULDRA] }));
        expect(run.deck).toHaveLength(3 * START_KIT_SIZE + RUN_GENERICS);
        expect(run.deck).toHaveLength(14);
        for (const m of [KRAKEN, FENRIR, HULDRA]) {
            const owned = run.deck.filter((c) => c.ownerId === m.id);
            expect(owned).toHaveLength(m === KRAKEN ? START_KIT_SIZE + RUN_GENERICS : START_KIT_SIZE);
            expect(owned.slice(0, START_KIT_SIZE).map((c) => c.dataId))
                .toEqual([...ratifiedKit(m.definitionId, m.activeOS!)]);
            expect(owned.filter((c) => c.dataId === GENERIC_HIT))
                .toHaveLength(m === KRAKEN ? RUN_GENERICS : 0);
        }
        // Concatenated in party order, and every instance id distinct across the whole deck.
        expect(run.deck.slice(0, 6).every((c) => c.ownerId === KRAKEN.id)).toBe(true);
        expect(new Set(run.deck.map((c) => c.instanceId)).size).toBe(14);
    });

    it('gives a two-member party 10 cards, the generics on the first', () => {
        // The middle row of the 6 / 10 / 14 table, and the one that catches a per-member relapse
        // fastest: under the old rule this was 13, and under "generics on every member" it is 12.
        const run = createRun(soloInput({ party: [KRAKEN, FENRIR] }));
        expect(run.deck).toHaveLength(2 * START_KIT_SIZE + RUN_GENERICS);
        expect(run.deck).toHaveLength(10);
        expect(run.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(RUN_GENERICS);
        expect(run.deck.filter((c) => c.dataId === GENERIC_HIT).every((c) => c.ownerId === KRAKEN.id))
            .toBe(true);
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
