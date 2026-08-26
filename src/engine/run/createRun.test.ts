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
    RECRUIT_GENERICS,
    RECRUIT_KIT_SIZE,
    START_GENERICS,
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
    it('is 6 cards: 4 kit + 2 generics', () => {
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED));
        expect(deck).toHaveLength(START_KIT_SIZE + START_GENERICS);
        expect(deck).toHaveLength(6);
    });

    it('transcribes the ratified kit in order, payoff first, duplicates included', () => {
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED));
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
        const fenrir = startDeckFor(FENRIR, new SeedStream(SEED));
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
            const deck = startDeckFor(member('m', definitionId, os), new SeedStream(SEED));
            expect(deck.slice(0, START_KIT_SIZE).map((c) => c.dataId)).toEqual([...ratifiedKit(definitionId, os)]);
        }
    });

    it('fills the remaining two with the generic None-element hit', () => {
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED));
        expect(deck.slice(START_KIT_SIZE).map((c) => c.dataId)).toEqual([GENERIC_HIT, GENERIC_HIT]);
    });

    it('stamps every card with the member as owner, and mints unique instance ids', () => {
        const deck = startDeckFor(KRAKEN, new SeedStream(SEED));
        expect(deck.every((c) => c.ownerId === KRAKEN.id)).toBe(true);
        expect(new Set(deck.map((c) => c.instanceId)).size).toBe(deck.length);
    });

    it('falls back to availableOS[0] when the member has no activeOS', () => {
        const noOs = member('m_noos', 'kraken');
        const explicit = member('m_noos', 'kraken', 'kraken_v1');
        const a = startDeckFor(noOs, new SeedStream(SEED));
        const b = startDeckFor(explicit, new SeedStream(SEED));
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

            const deck = startDeckFor(ymir, new SeedStream(SEED));
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
        expect(startDeckFor(KRAKEN, new SeedStream(SEED))).toEqual(startDeckFor(KRAKEN, new SeedStream(SEED)));
    });
});

describe('recruitDeckFor', () => {
    it('is 6 cards: the recruit’s WHOLE ruled kit plus 2 generics — a starter’s six exactly', () => {
        /*
         * **Ticket 60 (playtest round 5) made a recruit and a starter the same shape: 4 kit + 2
         * generics.** This is the third table. Ticket 08 gave a recruit 3 kit + 1 generic; the
         * 2026-08-24 pass raised it to 5 + 0 after recruiting Ratatoskr into a Fenrir run and
         * getting only the first three of his tagged five — `startKitIdsFor` slices from the front
         * — *"It felt really bad to play Rat without his kit."*
         *
         * That pass fixed the right bug with the wrong lever. Cutting the generic to pay for the
         * missing tags left a recruit playing differently from a starter of the same species, and
         * round 5 found the same hole on the STARTER side anyway: the old table withheld each
         * deck's payoff, so *"ratatoskr's startKit carried none of his engine, making him pure
         * feed."* Tagging the payoff and cutting the fourth enabler fixes both ends at once, and
         * once it does there is nothing left for a recruit to be a lesser version OF. So a recruit
         * is not a seed and is not a starter-minus-something: it is the identical six, which is
         * what the last assertion here pins.
         */
        const deck = recruitDeckFor(HULDRA, new SeedStream(SEED));
        expect(deck).toHaveLength(RECRUIT_KIT_SIZE + RECRUIT_GENERICS);
        expect(deck).toHaveLength(6);
        expect(deck.slice(0, RECRUIT_KIT_SIZE).map((c) => c.dataId)).toEqual([
            ...ratifiedKit('huldra', 'huldra_v1'),
        ]);
        expect(deck.map((c) => c.dataId)).toEqual([
            'hexbloom', 'growth', 'iron_bark', 'thorn_tithe', GENERIC_HIT, GENERIC_HIT,
        ]);
        // Stated as its own assertion because `RECRUIT_GENERICS = 2` is the half of the ruling a
        // future "recruits are a seed, not a starter" patch would undo without touching the kit
        // size — which is exactly what the 5 + 0 table did, in the other direction.
        expect(deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(RECRUIT_GENERICS);
        expect(deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(2);
        // The ruling in one line: same species, same six, whether you started with it or bought it.
        expect(deck.map((c) => c.dataId))
            .toEqual(startDeckFor(HULDRA, new SeedStream(SEED)).map((c) => c.dataId));
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

    it('gives a solo party a 6-card deck', () => {
        expect(createRun(soloInput()).deck).toHaveLength(6);
    });

    it('gives a three-member party 18 cards, 6 per member, each correctly owned', () => {
        const run = createRun(soloInput({ party: [KRAKEN, FENRIR, HULDRA] }));
        expect(run.deck).toHaveLength(18);
        for (const m of [KRAKEN, FENRIR, HULDRA]) {
            const owned = run.deck.filter((c) => c.ownerId === m.id);
            expect(owned).toHaveLength(6);
            expect(owned.slice(0, START_KIT_SIZE).map((c) => c.dataId))
                .toEqual([...ratifiedKit(m.definitionId, m.activeOS!)]);
        }
        // Concatenated in party order, and every instance id distinct across the whole deck.
        expect(run.deck.slice(0, 6).every((c) => c.ownerId === KRAKEN.id)).toBe(true);
        expect(new Set(run.deck.map((c) => c.instanceId)).size).toBe(18);
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
