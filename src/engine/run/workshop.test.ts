/**
 * The workshop — ticket 14.
 *
 * Six claims, each of which can be false without anything crashing, which is what makes them worth
 * a test rather than a comment:
 *
 * - **The assembly price hits its stated target.** *"Growing the party 1 → 2 → 3 costs roughly one
 *   market visit's scrap"* is a number with a derivation, and the derivation is checked here against
 *   the constants it was derived from — so retuning `PARTY_SIZE` or `MARKET_VISITS_PER_RUN` fails the
 *   test rather than quietly falsifying the comment. Ticket 13 established that discipline for
 *   removal; this is the same shape.
 * - **The three prices stay in their ruled order.** Removal < reflash < recruit is the whole of what
 *   makes the sink the cheap button and the body the dear one; any retune that crosses two of them
 *   changes the design rather than the balance.
 * - **Removal is ONE price, not one per counter.** `WORKSHOP_REMOVAL_PRICE` is ticket 13's constant,
 *   and a second literal that happened to equal 30 today would drift the first time either was
 *   touched.
 * - **The species clause is enforced before anything is spent.** A standing law (map § Notes) that
 *   no reducer can check, because species live on the ranch and the party lives on the run.
 * - **A recruit is ticket 08's ruled 3 + 1, not this file's opinion of it.** `recruitDeckFor` is the
 *   ruling; a re-derivation here would be a second answer waiting to disagree.
 * - **The individual is deterministic in the node's visit count.** The workshop is a node's
 *   contents, so ticket 07's re-roll rule and ticket 23's resume contract both apply to it.
 */

import { describe, expect, it } from 'vitest';

import {
    RECRUITS_PER_RUN,
    WORKSHOP_ASSEMBLY_SCRAP,
    WORKSHOP_REFLASH_SCRAP,
    WORKSHOP_REMOVAL_PRICE,
    assemblableSpecies,
    isWorkshopNode,
    planRecruit,
    reflashBlockFor,
    reflashOptionsFor,
    workshopBlockFor,
    workshopSpecies,
} from './workshop';
import { MARKET_VISITS_PER_RUN, REMOVAL_PRICE, cardPrice } from './marketplace';
import { RECRUIT_GENERICS, RECRUIT_KIT_SIZE, createRun, recruitDeckFor } from './createRun';
import { toMingmingState } from './battleSetup';
import { nodeSeed } from './nodeSeed';
import { offerGyms } from './gyms';
import { PARTY_SIZE } from '../party';
import { isRewardable } from '../RewardSystem';
import { SeedStream } from '../core/SeedStream';
import { GENERIC_HIT } from '../data/mingmingRegistry';
import { ProgramRegistry } from '../data/programRegistry';
import type { IMingmingState } from '../types';
import type { IRanchMember, IRanchState, IRegionNode, IRunState } from '../runTypes';

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const rosterMember = (id: string, definitionId: string, activeOS: string): IRanchMember => ({
    id, definitionId, activeOS, attackIV: 10, defenseIV: 10, hpIV: 10,
});

function makeRun(seed = 'workshop-run', party: IMingmingState[] = [KRAKEN]): IRunState {
    return createRun({ seed, offer: offerGyms('offer-seed')[0], party, startedAt: 1_700_000_000_000 });
}

const RUN = makeRun();

/** Every workshop the generated region contains — ticket 07 puts one in each of the three biomes. */
const WORKSHOPS = RUN.nodes.filter((n) => n.kind === 'workshop');

/** A workshop as `enterNode` leaves it: visit-incremented. */
function visited(node: IRegionNode, visit: number): IRegionNode {
    return { ...node, visited: visit };
}

const NODE = visited(WORKSHOPS[0], 1);

function makeRanch(blueprints: Record<string, number>, roster: IRanchMember[] = [rosterMember('mm1', 'kraken', 'kraken_v1')]): IRanchState {
    return { roster, blueprints, codex: { seen: [], played: [] }, gymsCleared: [], highestTierCleared: 0, seenTips: [] };
}

/** Every price the marketplace actually offers, so "a card" means a card the player could buy. */
const OFFERABLE_PRICES = Object.keys(ProgramRegistry).filter(isRewardable).map(cardPrice).sort((a, b) => a - b);
const MEDIAN_CARD_PRICE = OFFERABLE_PRICES[Math.floor(OFFERABLE_PRICES.length / 2)];

// ---------------------------------------------------------------------------------------------
// The assembly price's stated target
// ---------------------------------------------------------------------------------------------

describe('the recruit price is derived, not chosen', () => {
    /** Ticket 12's measured anchor: a full 8-10 fight run with a 3-member party. */
    const RUN_SCRAP_LOW = 450;
    const RUN_SCRAP_HIGH = 500;

    it('puts a workshop in every biome, so a run sees as many workshops as markets', () => {
        // The premise the whole derivation rests on: ticket 07 guarantees one of each per biome, so
        // quoting a workshop price against a MARKET visit's scrap is comparing like with like.
        expect(WORKSHOPS.length).toBe(MARKET_VISITS_PER_RUN);
        expect(new Set(WORKSHOPS.map((n) => n.biomeIndex)).size).toBe(MARKET_VISITS_PER_RUN);
    });

    it('takes two recruits to fill a party, which is what the price is divided against', () => {
        // Not an estimate — the party starts solo and ends at PARTY_SIZE, and it grows here only.
        expect(RECRUITS_PER_RUN).toBe(PARTY_SIZE - 1);
        expect(RECRUITS_PER_RUN).toBe(2);
    });

    it('costs one market visit’s scrap to grow the party 1 → 2 → 3', () => {
        const visitScrapLow = RUN_SCRAP_LOW / MARKET_VISITS_PER_RUN;   // 150
        const visitScrapHigh = RUN_SCRAP_HIGH / MARKET_VISITS_PER_RUN; // ~167
        const growTheTeam = WORKSHOP_ASSEMBLY_SCRAP * RECRUITS_PER_RUN;

        expect(growTheTeam).toBe(150);
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBe(visitScrapLow / RECRUITS_PER_RUN);
        // "Roughly one visit's scrap" — between 85% and 115% of a visit at both ends of ticket 12's
        // measured band, the same tolerance ticket 13 holds its removal price to.
        expect(growTheTeam / visitScrapLow).toBeGreaterThanOrEqual(0.85);
        expect(growTheTeam / visitScrapLow).toBeLessThanOrEqual(1.15);
        expect(growTheTeam / visitScrapHigh).toBeGreaterThanOrEqual(0.85);
    });

    it('costs roughly one and a half cards’ worth of market, so recruiting competes with the shop', () => {
        // Henry's stated design target for this node: mid-run recruiting must compete with the
        // marketplace for the same currency. The unit that makes that legible is a card.
        expect(MEDIAN_CARD_PRICE).toBe(48);
        const cardsForgone = WORKSHOP_ASSEMBLY_SCRAP / MEDIAN_CARD_PRICE;
        expect(cardsForgone).toBeGreaterThan(1.4);
        expect(cardsForgone).toBeLessThan(1.8);
        // And across a run, the two recruits are three cards not bought.
        expect(Math.round((WORKSHOP_ASSEMBLY_SCRAP * RECRUITS_PER_RUN) / MEDIAN_CARD_PRICE)).toBe(3);
    });

    it('is not a rounding error and not unaffordable — the two ways the ruling fails', () => {
        // Below the cheapest sink it would be free in practice; at a whole market visit each the two
        // recruits would eat 300 of 450 and the first workshop would be unpayable by a solo party.
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBeGreaterThan(REMOVAL_PRICE);
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBeGreaterThan(MEDIAN_CARD_PRICE);
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBeLessThan(RUN_SCRAP_LOW / MARKET_VISITS_PER_RUN);
        // Cheaper than the dearest single card on the shelf: the recruit is gated by a blueprint as
        // well, and pricing it above everything would make the double gate a wall.
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBeLessThan(OFFERABLE_PRICES[OFFERABLE_PRICES.length - 1]);
    });
});

describe('the reflash price', () => {
    it('is roughly half a recruit — no body, no cards', () => {
        const halves = (WORKSHOP_REFLASH_SCRAP * 2) / WORKSHOP_ASSEMBLY_SCRAP;
        expect(halves).toBeGreaterThanOrEqual(0.9);
        expect(halves).toBeLessThanOrEqual(1.2);
    });

    it('sits between the sink and the card it costs you', () => {
        // Above removal, so the cheapest button in the workshop stays the sink rather than a
        // power-up; below the median card, so a reflash never costs more than what you gave up.
        expect(WORKSHOP_REFLASH_SCRAP).toBeGreaterThan(WORKSHOP_REMOVAL_PRICE);
        expect(WORKSHOP_REFLASH_SCRAP).toBeLessThan(MEDIAN_CARD_PRICE);
        expect(WORKSHOP_REFLASH_SCRAP).toBeLessThan(WORKSHOP_ASSEMBLY_SCRAP);
    });
});

describe('removal is one price, not one per counter', () => {
    it('charges exactly what a marketplace charges', () => {
        // Ticket 13 derived 30 against a stated target ("stripping all generics costs roughly one
        // market visit's scrap"). A second, cheaper workshop price would falsify that derivation
        // without retuning it — the player would simply do every removal here.
        expect(WORKSHOP_REMOVAL_PRICE).toBe(REMOVAL_PRICE);
    });
});

describe('what the node serves', () => {
    it('serves workshops and nothing else', () => {
        expect(isWorkshopNode('workshop')).toBe(true);
        for (const kind of ['wild', 'elite', 'alpha', 'ambush', 'marketplace', 'event', 'gym'] as const) {
            expect(isWorkshopNode(kind)).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------------------------
// Who can be built
// ---------------------------------------------------------------------------------------------

describe('assemblableSpecies', () => {
    it('offers a species the ranch holds a blueprint for and the party does not field', () => {
        const ranch = makeRanch({ fenrir: 2 });
        expect(assemblableSpecies(ranch, RUN).map((s) => s.speciesId)).toEqual(['fenrir']);
        expect(assemblableSpecies(ranch, RUN)[0].blueprints).toBe(2);
        expect(workshopBlockFor('fenrir', ranch, RUN)).toBeNull();
    });

    it('offers nothing without a blueprint', () => {
        expect(assemblableSpecies(makeRanch({}), RUN)).toEqual([]);
        expect(assemblableSpecies(makeRanch({ fenrir: 0 }), RUN)).toEqual([]);
        expect(workshopBlockFor('fenrir', makeRanch({}), RUN)).toBe('no-blueprint');
    });

    it('refuses a species already on the team — the standing species clause', () => {
        // Map § Notes: the roster may hold ten krakens, the party fields one. `partyBlockFor` is the
        // one implementation of that law and this is a call to it, not a copy.
        const ranch = makeRanch({ kraken: 3 });
        expect(workshopBlockFor('kraken', ranch, RUN)).toBe('duplicate-species');
        expect(assemblableSpecies(ranch, RUN)).toEqual([]);
        // The blueprint is still LISTED, with its reason — a blueprint you cannot spend here is news.
        expect(workshopSpecies(ranch, RUN).map((s) => [s.speciesId, s.block]))
            .toEqual([['kraken', 'duplicate-species']]);
    });

    it('refuses everything once the party is full', () => {
        const trio = makeRun('full-party', [
            KRAKEN,
            { ...KRAKEN, id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1' },
            { ...KRAKEN, id: 'mm3', definitionId: 'ratatoskr', activeOS: 'ratatoskr_v1' },
        ]);
        const ranch = makeRanch({ jormungandr: 1 }, [
            rosterMember('mm1', 'kraken', 'kraken_v1'),
            rosterMember('mm2', 'fenrir', 'fenrir_v1'),
            rosterMember('mm3', 'ratatoskr', 'ratatoskr_v1'),
        ]);

        expect(trio.partyIds.length).toBe(PARTY_SIZE);
        expect(workshopBlockFor('jormungandr', ranch, trio)).toBe('party-full');
        expect(assemblableSpecies(ranch, trio)).toEqual([]);
    });

    it('counts a party id the roster cannot resolve toward the ceiling', () => {
        // `reconcileLoadedState` discards a run whose party names a missing member, so this cannot
        // survive a load — but a torn state reaching here must not let the player field a fourth.
        const torn: IRunState = { ...RUN, partyIds: ['mm1', 'ghost-a', 'ghost-b'] };
        expect(workshopBlockFor('fenrir', makeRanch({ fenrir: 1 }), torn)).toBe('party-full');
    });

    it('sorts by name so the list does not reshuffle as counts change', () => {
        const ranch = makeRanch({ ymir: 1, fenrir: 1, jormungandr: 1 });
        const names = workshopSpecies(ranch, RUN).map((s) => s.speciesId);
        expect(names).toEqual(['fenrir', 'jormungandr', 'ymir']);
    });
});

// ---------------------------------------------------------------------------------------------
// The recruit
// ---------------------------------------------------------------------------------------------

describe('planRecruit', () => {
    const RANCH = makeRanch({ fenrir: 1 });

    it('brings ticket 08’s ruled 3 kit + 1 generic, from recruitDeckFor and not re-derived', () => {
        const plan = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir', osId: 'fenrir_v1' })!;

        expect(plan.cards).toHaveLength(RECRUIT_KIT_SIZE + RECRUIT_GENERICS);
        expect(plan.cards).toHaveLength(4);
        expect(plan.cards.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(RECRUIT_GENERICS);

        // The same four cards `createRun`'s own recruit rule produces for the same member and the
        // same stream. A second derivation of "3 + 1" living here is the drift this asserts against.
        const stream = new SeedStream(new SeedStream(nodeSeed(RUN, NODE, 'workshop')).fork('recruit-deck:fenrir'));
        expect(plan.cards).toEqual(recruitDeckFor(toMingmingState(plan.member), stream));
    });

    it('gives every card the new member as its owner', () => {
        const plan = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir' })!;
        for (const card of plan.cards) expect(card.ownerId).toBe(plan.member.id);
        expect(new Set(plan.cards.map((c) => c.instanceId)).size).toBe(plan.cards.length);
    });

    it('charges WORKSHOP_ASSEMBLY_SCRAP and rolls stats in range', () => {
        const plan = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir' })!;
        expect(plan.scrap).toBe(WORKSHOP_ASSEMBLY_SCRAP);
        for (const iv of [plan.member.attackIV, plan.member.defenseIV, plan.member.hpIV]) {
            // `RanchMemberSchema` bounds IVs at int 0-31 and this member has to survive the save.
            expect(Number.isInteger(iv)).toBe(true);
            expect(iv).toBeGreaterThanOrEqual(0);
            expect(iv).toBeLessThanOrEqual(31);
        }
    });

    it('honours the firmware the player picked, and falls back to the first otherwise', () => {
        expect(planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir', osId: 'fenrir_v2' })!.member.activeOS)
            .toBe('fenrir_v2');
        expect(planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir' })!.member.activeOS)
            .toBe('fenrir_v1');
    });

    it('is deterministic in the run, the node and the visit — a resumed run rolls the same unit', () => {
        const a = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir', osId: 'fenrir_v1' })!;
        const b = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir', osId: 'fenrir_v1' })!;
        expect(b).toEqual(a);
    });

    it('rolls a different individual on the second visit — ticket 07’s re-entry rule', () => {
        const first = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir' })!;
        const second = planRecruit({ ranch: RANCH, run: RUN, node: visited(WORKSHOPS[0], 2), speciesId: 'fenrir' })!;
        expect(second.member.id).not.toBe(first.member.id);
        expect(second.cards.map((c) => c.instanceId)).not.toEqual(first.cards.map((c) => c.instanceId));
    });

    it('rolls a different individual at a different workshop and in a different run', () => {
        const here = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir' })!;
        const there = planRecruit({ ranch: RANCH, run: RUN, node: visited(WORKSHOPS[1], 1), speciesId: 'fenrir' })!;
        expect(there.member.id).not.toBe(here.member.id);

        const other = makeRun('a-different-run');
        const elsewhere = planRecruit({
            ranch: RANCH,
            run: other,
            node: visited(other.nodes.filter((n) => n.kind === 'workshop')[0], 1),
            speciesId: 'fenrir',
        })!;
        expect(elsewhere.member.id).not.toBe(here.member.id);
    });

    it('returns null for anything the species clause or the party ceiling refuses', () => {
        // No dispatch is produced at all for an illegal recruit — which is the only place that law
        // can be enforced, since no reducer can see the roster's species and the run's party at once.
        expect(planRecruit({ ranch: makeRanch({}), run: RUN, node: NODE, speciesId: 'fenrir' })).toBeNull();
        expect(planRecruit({ ranch: makeRanch({ kraken: 1 }), run: RUN, node: NODE, speciesId: 'kraken' })).toBeNull();
    });

    it('never reuses a roster id, because the ranch outlives the run', () => {
        // Two runs on one seed are reachable (the debug launcher hands one over; ticket 23 resumes
        // one), and two roster members under one id would make `partyIds` ambiguous forever.
        const plan = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir' })!;
        const crowded = makeRanch({ fenrir: 1 }, [...RANCH.roster, rosterMember(plan.member.id, 'fenrir', 'fenrir_v1')]);

        const second = planRecruit({ ranch: crowded, run: RUN, node: NODE, speciesId: 'fenrir' })!;
        expect(second.member.id).not.toBe(plan.member.id);
        expect(crowded.roster.some((m) => m.id === second.member.id)).toBe(false);
        // The cards follow the corrected id rather than the one it collided with.
        for (const card of second.cards) expect(card.ownerId).toBe(second.member.id);
    });
});

// ---------------------------------------------------------------------------------------------
// The reflash
// ---------------------------------------------------------------------------------------------

describe('reflash options', () => {
    const KRAKEN_MEMBER = rosterMember('mm1', 'kraken', 'kraken_v1');

    it('offers every firmware the species has except the one it is running', () => {
        const options = reflashOptionsFor(KRAKEN_MEMBER);
        expect(options.length).toBeGreaterThan(0);
        expect(options).not.toContain('kraken_v1');
    });

    it('reads the registry rather than assuming _v1/_v2 (ticket 15)', () => {
        // An unknown species yields nothing rather than throwing: a renamed species must not take
        // the whole panel down with it.
        expect(reflashOptionsFor(rosterMember('mmX', 'no-such-species', 'whatever_v1'))).toEqual([]);
        expect(reflashBlockFor(rosterMember('mmX', 'no-such-species', 'whatever_v1'), makeRanch({ 'no-such-species': 1 })))
            .toBe('no-other-firmware');
    });

    it('needs a blueprint of the member’s own species', () => {
        expect(reflashBlockFor(KRAKEN_MEMBER, makeRanch({}))).toBe('no-blueprint');
        expect(reflashBlockFor(KRAKEN_MEMBER, makeRanch({ fenrir: 5 }))).toBe('no-blueprint');
        expect(reflashBlockFor(KRAKEN_MEMBER, makeRanch({ kraken: 1 }))).toBeNull();
    });
});
