/**
 * The workshop — ticket 14.
 *
 * Six claims, each of which can be false without anything crashing, which is what makes them worth
 * a test rather than a comment:
 *
 * - **The assembly price stays inside the bounds its docblock claims.** Ticket 56 RULED 25 and 15,
 *   so these are no longer derivations that produce a number — they are bounds the ruled number is
 *   checked against, computed from `scrapForWin`'s income table rather than from a restatement of
 *   it. Retuning `PARTY_SIZE`, `MARKET_VISITS_PER_RUN` or the income constants fails the test rather
 *   than quietly falsifying the comment. Ticket 13 established that discipline for removal; this is
 *   the same shape, pointed at a ruling instead of a proposal.
 * - **The ruled order is reflash < removal < recruit**, and it is the *inverse* of ticket 14's
 *   proposed order on its first two terms. That inversion is the substantive thing ticket 56 changed
 *   about this file's design, so it is asserted rather than assumed — see the reflash block for why
 *   losing "the sink is the cheapest button" is coherent.
 * - **Removal is ONE price, not one per counter.** `WORKSHOP_REMOVAL_PRICE` is ticket 13's constant,
 *   re-exported; that is exactly why ticket 56's move of the removal price needed no edit in
 *   `workshop.ts`, and why a second literal here would have drifted.
 * - **The species clause is enforced before anything is spent.** A standing law (map § Notes) that
 *   no reducer can check, because species live on the ranch and the party lives on the run.
 * - **A recruit is the ruled 4 and nothing else — ticket 60's mini-engine kit, the same four any
 *   member that is not the first one gets, and the fourth table after ticket 08's 3 + 1, the 5 + 0
 *   of 2026-08-24 and ticket 60's 4 + 2 — not this file's opinion of it.** `recruitDeckFor` is the
 *   ruling; a re-derivation here would be a second answer waiting to disagree, and with the table
 *   having moved four times in a fortnight it would have been a second answer to re-edit each time.
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
import { CARD_PRICE_BY_ENERGY, MARKET_VISITS_PER_RUN, REMOVAL_PRICE, cardPrice } from './marketplace';
import { RECRUIT_KIT_SIZE, createRun, recruitDeckFor } from './createRun';
import { toMingmingState } from './battleSetup';
import { nodeSeed } from './nodeSeed';
import { offerGyms } from './gyms';
import { PARTY_SIZE } from '../party';
import { BASE_WIN_SCRAP, ELITE_WIN_SCRAP, SCRAP_PER_EXTRA_ENEMY, isRewardable, scrapForWin } from '../RewardSystem';
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
    return { roster, blueprints, codex: { seen: [], played: [] , species: [], assembled: [], os: [] }, gymsCleared: [], highestTierCleared: 0, seenTips: [], codexMilestones: [] };
}

/** Every price the marketplace actually offers, so "a card" means a card the player could buy. */
const OFFERABLE_PRICES = Object.keys(ProgramRegistry).filter(isRewardable).map(cardPrice).sort((a, b) => a - b);
const MEDIAN_CARD_PRICE = OFFERABLE_PRICES[Math.floor(OFFERABLE_PRICES.length / 2)];

// ---------------------------------------------------------------------------------------------
// The assembly price's bounds, against the income table that replaced ticket 12's
// ---------------------------------------------------------------------------------------------

/**
 * What a solo party takes off one wild. The single most load-bearing number in this file's
 * affordability argument: the biome-1 workshop is reached solo, and `enemyPartySize` makes an
 * ordinary wild symmetric with your team, so this is the rate the first recruit is saved up at.
 */
const SOLO_WILD_SCRAP = scrapForWin('wild', 1);

/**
 * The run total `WORKSHOP_ASSEMBLY_SCRAP`'s docblock derives, recomputed here from `scrapForWin`
 * rather than restated as a literal: two elite biome exits, a three-fight gym, and about six wilds
 * fought by a party that is growing from one body to three.
 */
const RUN_SCRAP = 2 * scrapForWin('elite', 1)
    + 3 * scrapForWin('gym', PARTY_SIZE)
    + 2 * (scrapForWin('wild', 1) + scrapForWin('wild', 2) + scrapForWin('wild', 3));

describe('the recruit price is checked against the income, not derived from it', () => {
    it('puts a workshop in every biome, so a run sees as many workshops as markets', () => {
        // The premise the whole comparison rests on: ticket 07 guarantees one of each per biome, so
        // quoting a workshop price against a MARKET visit's scrap is comparing like with like.
        expect(WORKSHOPS.length).toBe(MARKET_VISITS_PER_RUN);
        expect(new Set(WORKSHOPS.map((n) => n.biomeIndex)).size).toBe(MARKET_VISITS_PER_RUN);
    });

    it('takes two recruits to fill a party, which is what the price is multiplied by', () => {
        // Not an estimate — the party starts solo and ends at PARTY_SIZE, and it grows here only.
        expect(RECRUITS_PER_RUN).toBe(PARTY_SIZE - 1);
        expect(RECRUITS_PER_RUN).toBe(2);
    });

    it('quotes the income table as it stands after the elite raise, so a retune lands here first', () => {
        // The four numbers the docblock's table is built out of. Asserted so that moving the income
        // breaks this file rather than silently leaving its arithmetic describing a dead scale —
        // which is exactly what ticket 12's 450-500 anchor did until ticket 57 came through, and
        // exactly what ticket 56's own elite figure did the moment Henry raised it on 2026-08-24.
        expect(BASE_WIN_SCRAP).toBe(10);
        expect(SCRAP_PER_EXTRA_ENEMY).toBe(5);
        // 45, not ticket 56's 30: at 30 an elite paid only ten more than the 3v3 wild it is
        // strictly harder than, which made the biome exit the worst-value fight on the map.
        expect(ELITE_WIN_SCRAP).toBe(45);
        expect(scrapForWin('wild', 1)).toBe(10);
        expect(scrapForWin('wild', PARTY_SIZE)).toBe(20);
        // 90 from the two elite exits + 60 from the gym + 90 from the wilds. Was 210; the whole
        // +30 is the elites, since nothing else in the table moved.
        expect(RUN_SCRAP).toBe(240);
    });

    it('grows the party 1 → 2 → 3 for about five eighths of a market visit', () => {
        const visitScrap = RUN_SCRAP / MARKET_VISITS_PER_RUN; // 240 / 3 = 80
        const growTheTeam = WORKSHOP_ASSEMBLY_SCRAP * RECRUITS_PER_RUN;

        expect(growTheTeam).toBe(50);
        expect(visitScrap).toBe(80);
        // Five eighths, where the same pair cost five sevenths before the elite raise: the fee did
        // not move, the visit got 10 richer (70 -> 80). The drift is towards the cheap edge, which
        // is worth watching but is not yet over it.
        expect(growTheTeam / visitScrap).toBe(0.625);
        // Ticket 14 could say "exactly one visit"; the ruled number gives that tidiness up. What it
        // must not do is drift to either edge — a whole visit each would make the market a window
        // display, and half a visit for the pair would make the node a free power-up.
        expect(growTheTeam / visitScrap).toBeGreaterThan(0.6);
        expect(growTheTeam / visitScrap).toBeLessThan(0.85);
        // A fifth of the run now rather than a quarter, where ticket 14's 75 was a third of a much
        // larger one.
        expect(growTheTeam / RUN_SCRAP).toBeLessThan(0.3);
    });

    it('costs one median card per recruit, so recruiting competes with the shop', () => {
        // Henry's stated design target for this node: mid-run recruiting must compete with the
        // marketplace for the same currency. The unit that makes that legible is still a card — but
        // ticket 56 moved the card table as well as the income, so the unit itself changed size.
        // The offerable registry now prices on energy alone (15/25/35/45) and clusters on the
        // 1-energy rung, which puts the median at 25 where the rarity table put it at 48.
        expect(MEDIAN_CARD_PRICE).toBe(25);
        expect(MEDIAN_CARD_PRICE).toBe(CARD_PRICE_BY_ENERGY[1]);

        // At the ruled numbers a recruit IS a median card, exactly — 25 against 25. That equality is
        // two rulings landing on the same rung rather than a derivation, so what is asserted as a
        // law is the band either side of it: at least one whole card, or the fee is spare change and
        // the "route decision" is imaginary; under two, or the recruit stops being "a card you gave
        // up" and becomes a shopping trip. (Ticket 14's 75 sat at ~1.5 cards on the old table; the
        // old band here was 0.4-0.6 because that table's median was nearly twice the fee.)
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBe(MEDIAN_CARD_PRICE);
        const cardsForgone = WORKSHOP_ASSEMBLY_SCRAP / MEDIAN_CARD_PRICE;
        expect(cardsForgone).toBeGreaterThanOrEqual(1);
        expect(cardsForgone).toBeLessThan(2);

        // And across a run, the two recruits are two median cards not bought — out of the nine a
        // 240-scrap run could otherwise afford (eight, before the elite raise paid for a ninth),
        // which is the share that keeps the shop worth walking into after the party is full.
        expect((WORKSHOP_ASSEMBLY_SCRAP * RECRUITS_PER_RUN) / MEDIAN_CARD_PRICE).toBe(2);
        expect(Math.floor(RUN_SCRAP / MEDIAN_CARD_PRICE)).toBe(9);
    });

    it('is payable at the first workshop by the solo party that walks into it', () => {
        // The failure ticket 14's 75 would have become the moment the income was cut. A solo party's
        // wilds field one body, so the first recruit is saved up ten at a time: 25 is three won
        // fights and an errand, where 75 would have been eight and a node walked past.
        expect(SOLO_WILD_SCRAP).toBe(10);
        expect(Math.ceil(WORKSHOP_ASSEMBLY_SCRAP / SOLO_WILD_SCRAP)).toBe(3);
        expect(Math.ceil(75 / SOLO_WILD_SCRAP)).toBe(8);
    });

    it('is not a rounding error and not unaffordable — the two ways the ruling fails', () => {
        // Dearer than the cheapest thing on the shelf, so declining a recruit still buys something.
        // (Against REMOVAL_PRICE the claim is "dearer than one removal", which ticket 57's
        // marketplace half lands by moving that constant to 20; it is not asserted here because
        // this file must not encode a number another ticket owns.)
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBeGreaterThan(OFFERABLE_PRICES[0]);
        // Under a whole market visit each, or the two recruits eat the marketplace.
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBeLessThan(RUN_SCRAP / MARKET_VISITS_PER_RUN);
        // Cheaper than the dearest single card on the shelf: the recruit is gated by a blueprint as
        // well, and pricing it above everything would make the double gate a wall.
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBeLessThan(OFFERABLE_PRICES[OFFERABLE_PRICES.length - 1]);
    });
});

describe('the reflash price', () => {
    it('is three fifths of a recruit — no body, no cards', () => {
        const fraction = WORKSHOP_REFLASH_SCRAP / WORKSHOP_ASSEMBLY_SCRAP;
        expect(fraction).toBeGreaterThanOrEqual(0.5);
        expect(fraction).toBeLessThanOrEqual(0.75);
        expect(WORKSHOP_REFLASH_SCRAP).toBeLessThan(WORKSHOP_ASSEMBLY_SCRAP);
    });

    it('sits on the income’s 5-scrap grid, not the market’s 8', () => {
        // Ticket 14 rounded its proposed 40 onto ticket 13's 8-scrap energy step — a grid ticket 56
        // deleted along with the rarity base it was added to. Ticket 56's prices are whole and half
        // multiples of a won solo fight instead, which is the grid a workshop is actually paid in.
        expect(WORKSHOP_REFLASH_SCRAP % SCRAP_PER_EXTRA_ENEMY).toBe(0);
        expect(WORKSHOP_ASSEMBLY_SCRAP % SCRAP_PER_EXTRA_ENEMY).toBe(0);
        expect(WORKSHOP_REFLASH_SCRAP).toBe(1.5 * SOLO_WILD_SCRAP);
        expect(WORKSHOP_ASSEMBLY_SCRAP).toBe(2.5 * SOLO_WILD_SCRAP);
    });

    it('is now the CHEAPEST button at the workshop, inverting ticket 14’s ordering', () => {
        // Ticket 14 held the reflash above removal so "the cheapest button stays the sink". Henry
        // ruled the other way, and the reason it is coherent is that the two prices are not in the
        // same currency: a removal costs scrap alone, a reflash costs scrap PLUS a blueprint, which
        // drops from ~20% of wilds. This holds whichever value ticket 13's constant carries.
        expect(WORKSHOP_REFLASH_SCRAP).toBeLessThan(WORKSHOP_REMOVAL_PRICE);
    });

    it('is under the card it costs you, and not a token at that', () => {
        // The claim being protected is "a reflash never costs more than the card you gave up to buy
        // it", and that survives ticket 56 — 15 against a median of 25. What does NOT survive is the
        // margin: ticket 56 cut the card table as well as the income, so the shelf came down to meet
        // this price instead of staying overhead, and the reflash is three fifths of a median card
        // rather than a third of one. Under ticket 14's 40-against-48 it was true by a hair.
        expect(WORKSHOP_REFLASH_SCRAP).toBeLessThan(MEDIAN_CARD_PRICE);
        const cardFraction = WORKSHOP_REFLASH_SCRAP / MEDIAN_CARD_PRICE; // 0.6
        // Both edges are the design, not the arithmetic: at a whole card the reflash would cost what
        // it re-aims (and would outprice the recruit's own card-for-a-body trade), while under half
        // a card it reads as a token at a scale where one won solo wild pays 10.
        expect(cardFraction).toBeGreaterThan(0.5);
        expect(cardFraction).toBeLessThan(1);
    });
});

describe('removal is one price, not one per counter', () => {
    it('charges exactly what a marketplace charges', () => {
        // One price for one verb, wherever it is bought. Ticket 13 derived its number against a
        // target ("stripping all generics costs roughly one market visit's scrap") that is now
        // retired on both sides — the generics stopped multiplying with the party (Henry,
        // 2026-08-25) and paid removal is no longer how a deck gets thinned at all — so the reason
        // this assertion survives is the plainer one it always also had: a second, cheaper workshop
        // price would mean the player simply did every removal here, and the marketplace's sink
        // would be a button nobody pressed.
        expect(WORKSHOP_REMOVAL_PRICE).toBe(REMOVAL_PRICE);
    });

    it('needed no edit when ticket 56 moved the removal price', () => {
        // The whole payoff of the re-export. WORKSHOP_REMOVAL_PRICE is not a number this file keeps
        // in step with ticket 13's — it IS ticket 13's, so there is nothing here to fall behind.
        expect(Object.is(WORKSHOP_REMOVAL_PRICE, REMOVAL_PRICE)).toBe(true);
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

    it('brings the ruled 4 kit cards and no generics, from recruitDeckFor and not re-derived', () => {
        // Ticket 08 ruled 3 + 1; the 2026-08-24 pass re-ruled it to 5 + 0 after a recruited
        // Ratatoskr turned up holding the first three of his five tagged cards in a deck drawing
        // 5-7 a turn: *"It felt really bad to play Rat without his kit."* Ticket 60 (playtest round
        // 5) settled the kit at four — the payoff plus three enablers — for starter and recruit
        // alike, which is what removed the last reason for a recruit to be a lesser version of a
        // starter.
        //
        // Henry then moved the generics off the member entirely (2026-08-25): the RUN gets two, the
        // first mingming carries them, and nobody else adds any. So a recruit brings four. That is
        // NOT the 5 + 0 table returning — there the missing generic was a price the recruit paid,
        // and here there is simply no per-member generic left for anyone to pay. The workshop sells
        // a body and its engine; the filler that stops a solo opening deck being four cards was
        // already bought, once, at the top of the run.
        const plan = planRecruit({ ranch: RANCH, run: RUN, node: NODE, speciesId: 'fenrir', osId: 'fenrir_v1' })!;

        expect(plan.cards).toHaveLength(RECRUIT_KIT_SIZE);
        expect(plan.cards).toHaveLength(4);
        expect(plan.cards.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(0);

        // The same four cards `createRun`'s own recruit rule produces for the same member and the
        // same stream. A second derivation of the kit living here is the drift this asserts against.
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
