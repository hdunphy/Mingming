/**
 * The marketplace — ticket 13.
 *
 * Five claims, each of which can be false without anything crashing, which is what makes them worth
 * a test rather than a comment:
 *
 * - **The stock re-rolls per visit and only per visit** (Henry, 2026-08-21). A cached stock looks
 *   identical until the second visit; a stock rolled from a fresh seed each render looks identical
 *   until the player resumes a saved run and finds the stall restocked behind their back.
 * - **The pool rule is the reward pool's, plus a genuinely off-pool wild-card.** A "wild-card" drawn
 *   from the party pool is a sixth ordinary row wearing a badge, and a mono-species run would never
 *   notice.
 * - **`power` does not reach the price.** Standing law (map § Notes). The test is behavioural rather
 *   than a grep: cards that share a (rarity, energy cost) pair must price identically however far
 *   apart their internals are.
 * - **Sell < buy, for every card in the registry.** Henry's "prices must not be farmable to zero".
 *   One card priced the wrong way round is an infinite scrap loop.
 * - **The removal price hits its stated target.** *"Stripping all generics over a run costs roughly
 *   one market visit's scrap"* is a number with a derivation, and the derivation is checked here
 *   against the constants it was derived from — so retuning `START_GENERICS` or the market count
 *   fails the test instead of quietly falsifying the comment.
 */

import { afterAll, describe, expect, it } from 'vitest';

import {
    CARD_PRICE_BY_RARITY,
    ENERGY_PRICE_STEP,
    MARKET_STOCK_SIZE,
    MARKET_VISITS_PER_RUN,
    MARKET_WILDCARD_SLOTS,
    REMOVAL_PRICE,
    REROLL_PRICE,
    SELL_MULTIPLIER,
    cardPrice,
    isMarketNode,
    isOfferSold,
    rollMarketStock,
    sellPrice,
} from './marketplace';
import { RECRUIT_GENERICS, START_GENERICS, createRun } from './createRun';
import { encounterSeed } from './encounter';
import { nodeSeed } from './nodeSeed';
import { offerGyms } from './gyms';
import { rewardCardPool } from '../RewardSystem';
import { GENERIC_HIT } from '../data/mingmingRegistry';
import { ProgramRegistry } from '../data/programRegistry';
import { numericBaseCost } from '../types';
import type { ProgramData, Rarity } from '../types';
import type { IMingmingState } from '../types';
import type { IRegionNode, IRunCard, IRunState } from '../runTypes';

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});

/** A solo kraken: the narrowest party there is, and therefore the harshest test of the pool. */
const SOLO = [member('mm1', 'kraken', 'kraken_v1')];
const TRIO = [
    member('mm1', 'kraken', 'kraken_v1'),
    member('mm2', 'fenrir', 'fenrir_v1'),
    member('mm3', 'ratatoskr', 'ratatoskr_v1'),
];

function makeRun(seed = 'market-run', party = SOLO): IRunState {
    return createRun({ seed, offer: offerGyms('offer-seed')[0], party, startedAt: 1_700_000_000_000 });
}

const RUN = makeRun();

/** Every marketplace the generated region contains — ticket 07 puts one in each of the three biomes. */
const MARKETS = RUN.nodes.filter((n) => n.kind === 'marketplace');

/** A market as `enterNode` leaves it: visit-incremented. */
function visited(node: IRegionNode, visit: number): IRegionNode {
    return { ...node, visited: visit };
}

const MARKET = visited(MARKETS[0], 1);

function stockAt(node: IRegionNode, run = RUN, party = SOLO) {
    return rollMarketStock({ run, node, party });
}

// ---------------------------------------------------------------------------------------------
// The seed
// ---------------------------------------------------------------------------------------------

describe('the market re-rolls per visit, and only per visit', () => {
    it('puts a marketplace in every biome, so a run sees the three markets the prices assume', () => {
        expect(MARKETS.length).toBe(MARKET_VISITS_PER_RUN);
        expect(new Set(MARKETS.map((n) => n.biomeIndex)).size).toBe(MARKET_VISITS_PER_RUN);
    });

    it('gives the same stock for the same run, node and visit — a resumed run restocks nothing', () => {
        expect(stockAt(MARKET)).toEqual(stockAt(MARKET));
        // Card instance ids included: the offer IS the card that enters the deck, so an id that
        // moved between renders would make "already bought" unresolvable after a reload.
        expect(stockAt(MARKET).offers.map((o) => o.card.instanceId))
            .toEqual(stockAt(MARKET).offers.map((o) => o.card.instanceId));
    });

    it('rolls a different stock on the second visit', () => {
        const first = stockAt(MARKET);
        const second = stockAt(visited(MARKETS[0], 2));

        expect(second.visit).toBe(2);
        expect(second.seed).not.toBe(first.seed);
        expect(second.offers.map((o) => o.card.dataId)).not.toEqual(first.offers.map((o) => o.card.dataId));
    });

    it('rolls a different stock in a different market on the same visit', () => {
        const a = stockAt(visited(MARKETS[0], 1));
        const b = stockAt(visited(MARKETS[1], 1));
        expect(b.seed).not.toBe(a.seed);
    });

    it('rolls a different stock in a different run', () => {
        const other = makeRun('a-different-run');
        const otherMarket = other.nodes.filter((n) => n.kind === 'marketplace')[0];
        expect(stockAt(visited(otherMarket, 1), other).seed).not.toBe(stockAt(MARKET).seed);
    });

    it('shares ONE derivation with the encounter roll rather than copying it', () => {
        // Ticket 13 extracted `nodeSeed`; `encounterSeed` is now a call to it. The two purposes must
        // still land on different seeds, or a market and a fight on the same node would draw the
        // same numbers.
        expect(encounterSeed(RUN, MARKET)).toBe(nodeSeed(RUN, MARKET, 'encounter'));
        expect(stockAt(MARKET).seed).toBe(nodeSeed(RUN, MARKET, 'market'));
        expect(stockAt(MARKET).seed).not.toBe(encounterSeed(RUN, MARKET));
    });
});

// ---------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------

describe('what is in the stock', () => {
    it('is MARKET_STOCK_SIZE cards from the reward pool plus MARKET_WILDCARD_SLOTS from outside it', () => {
        const stock = stockAt(MARKET);
        const pool = rewardCardPool(SOLO);

        expect(stock.offers.length).toBe(MARKET_STOCK_SIZE + MARKET_WILDCARD_SLOTS);

        const fromPool = stock.offers.filter((o) => !o.wildcard);
        const wild = stock.offers.filter((o) => o.wildcard);

        expect(fromPool.length).toBe(MARKET_STOCK_SIZE);
        expect(wild.length).toBe(MARKET_WILDCARD_SLOTS);
        for (const offer of fromPool) expect(pool).toContain(offer.card.dataId);
    });

    it('draws the wild-card from genuinely OFF the pool — the thing that saves a mono-species run', () => {
        // `economy-session.md`'s "optional off-pool wild-cards". A solo kraken's pool is one tuned
        // deck; without this slot the player would be offered those same ids at all three markets
        // and by every reward pick in between.
        const pool = rewardCardPool(SOLO);
        for (const node of MARKETS) {
            for (const visit of [1, 2, 3]) {
                for (const offer of stockAt(visited(node, visit)).offers) {
                    if (!offer.wildcard) continue;
                    expect(pool).not.toContain(offer.card.dataId);
                }
            }
        }
    });

    it('never offers a token, in either slot', () => {
        for (const node of MARKETS) {
            for (const visit of [1, 2, 3]) {
                for (const offer of stockAt(visited(node, visit)).offers) {
                    const data = ProgramRegistry[offer.card.dataId];
                    expect(data).toBeTruthy();
                    expect(data.isToken).toBeFalsy();
                    expect(data.rarity as string).not.toBe('Token');
                }
            }
        }
    });

    it('offers each card once, and mints each one as an unowned run card', () => {
        const stock = stockAt(MARKET, RUN, TRIO);
        const ids = stock.offers.map((o) => o.card.dataId);
        expect(new Set(ids).size).toBe(ids.length);
        for (const offer of stock.offers) {
            // `ownerId: null` — bought cards belong to the shared deck and to no member.
            expect(offer.card.ownerId).toBeNull();
            expect(offer.price).toBe(cardPrice(offer.card.dataId));
        }
    });

    it('draws a three-species party from all three pools', () => {
        // "Recruiting IS drafting" (ticket 08): a wider party is a wider shop, and that has to be
        // visible in the stock rather than only in the comment.
        const soloPool = rewardCardPool(SOLO);
        const trioPool = rewardCardPool(TRIO);
        expect(trioPool.length).toBeGreaterThan(soloPool.length);

        const offPoolForTrio = stockAt(MARKET, RUN, TRIO).offers
            .filter((o) => !o.wildcard)
            .filter((o) => !trioPool.includes(o.card.dataId));
        expect(offPoolForTrio).toEqual([]);
    });

    it('serves marketplaces and nothing else', () => {
        expect(isMarketNode('marketplace')).toBe(true);
        for (const kind of ['wild', 'elite', 'alpha', 'ambush', 'workshop', 'event', 'gym'] as const) {
            expect(isMarketNode(kind)).toBe(false);
        }
    });

    it('knows an offer is sold when its instance is in the deck, and survives a reload knowing it', () => {
        const stock = stockAt(MARKET);
        const bought = stock.offers[0];
        const deck: IRunCard[] = [bought.card];

        expect(isOfferSold(deck, bought)).toBe(true);
        expect(isOfferSold(deck, stock.offers[1])).toBe(false);
        // Re-rolled from the same run state — which is what a resume does — the same offer is still
        // recognisably the one that was bought.
        expect(isOfferSold(deck, stockAt(MARKET).offers[0])).toBe(true);
    });
});

// ---------------------------------------------------------------------------------------------
// Prices — power dies at the surface
// ---------------------------------------------------------------------------------------------

const REGISTRY_IDS = Object.keys(ProgramRegistry);

describe('prices are keyed on rarity and energy cost, and nothing else', () => {
    it('prices every card in the registry as base + step × cost', () => {
        for (const id of REGISTRY_IDS) {
            const data = ProgramRegistry[id];
            const base = CARD_PRICE_BY_RARITY[data.rarity as Rarity] ?? CARD_PRICE_BY_RARITY.Common;
            expect(cardPrice(id)).toBe(base + ENERGY_PRICE_STEP * numericBaseCost(data.baseCost));
        }
    });

    it('gives every card sharing a (rarity, cost) pair the SAME price — so no third input exists', () => {
        // This is the "power dies at the surface" test at registry scale. 216 shipped cards collapse
        // into a dozen (rarity, cost) buckets whose members differ wildly in `power`, in actions and
        // in element. If any of those leaked into the price, a bucket would hold two prices.
        const byKey = new Map<string, Set<number>>();
        for (const id of REGISTRY_IDS) {
            const data = ProgramRegistry[id];
            const key = `${data.rarity}|${numericBaseCost(data.baseCost)}`;
            const prices = byKey.get(key) ?? new Set<number>();
            prices.add(cardPrice(id));
            byKey.set(key, prices);
        }
        expect(byKey.size).toBeGreaterThan(5);
        for (const [key, prices] of byKey) expect([key, prices.size]).toEqual([key, 1]);
    });

    it('prices two cards identical but for their power identically', () => {
        // The direct form of the same claim: `power` is a balance instrument
        // (`debug/balance/powerscale.ts`), and a price derived from it would publish it.
        const template = (id: string, power: number): ProgramData => ({
            id,
            name: id,
            description: 'fixture',
            element: 'Fire',
            target: 'Single',
            category: 'Attack',
            rarity: 'Rare',
            baseCost: 2,
            constraints: [],
            actions: [{ type: 'ATTACK', power, target: 'TARGET' }],
        });
        ProgramRegistry.ticket13_feeble = template('ticket13_feeble', 1);
        ProgramRegistry.ticket13_monstrous = template('ticket13_monstrous', 999);

        expect(cardPrice('ticket13_feeble')).toBe(cardPrice('ticket13_monstrous'));
        expect(sellPrice('ticket13_feeble')).toBe(sellPrice('ticket13_monstrous'));
    });

    it('prices an unknown id as a Common rather than throwing at a render', () => {
        expect(cardPrice('no-such-card')).toBe(CARD_PRICE_BY_RARITY.Common);
    });

    it('prices an X-cost card at the shared static budget rather than special-casing it', () => {
        const xCard = REGISTRY_IDS.find((id) => ProgramRegistry[id].baseCost === 'X');
        expect(xCard).toBeTruthy();
        const data = ProgramRegistry[xCard!];
        const base = CARD_PRICE_BY_RARITY[data.rarity as Rarity];
        expect(cardPrice(xCard!)).toBe(base + ENERGY_PRICE_STEP * numericBaseCost('X'));
    });
});

afterAll(() => {
    delete ProgramRegistry.ticket13_feeble;
    delete ProgramRegistry.ticket13_monstrous;
});

// ---------------------------------------------------------------------------------------------
// The no-farm law
// ---------------------------------------------------------------------------------------------

describe('the market cannot be farmed to zero', () => {
    it('sells every card in the registry for strictly less than it buys it for', () => {
        // Henry, 2026-08-21: "prices must not be farmable to zero." One card priced the wrong way
        // round turns buy-then-sell into an infinite scrap loop, and the player would find it long
        // before a playtest report did.
        for (const id of REGISTRY_IDS) {
            const buy = cardPrice(id);
            const sell = sellPrice(id);
            expect(sell).toBeLessThan(buy);
            expect(sell).toBeGreaterThanOrEqual(0);
        }
    });

    it('loses the player scrap on every buy-sell round trip', () => {
        const stock = stockAt(MARKET);
        for (const offer of stock.offers) {
            expect(sellPrice(offer.card.dataId) - offer.price).toBeLessThan(0);
        }
    });

    it('sells at the ratified multiplier', () => {
        expect(SELL_MULTIPLIER).toBeLessThan(1);
        expect(sellPrice(GENERIC_HIT)).toBe(Math.floor(cardPrice(GENERIC_HIT) * SELL_MULTIPLIER));
    });

    it('charges for a reroll, and charges less for it than for the cheapest card', () => {
        // A reroll buys nothing but a new set of choices, so it must never be the most expensive
        // thing on the screen — and it must never be free, or the stock is a slot machine.
        expect(REROLL_PRICE).toBeGreaterThan(0);
        expect(REROLL_PRICE).toBeLessThan(Math.min(...REGISTRY_IDS.map(cardPrice)));
    });
});

// ---------------------------------------------------------------------------------------------
// The removal price's stated target
// ---------------------------------------------------------------------------------------------

describe('removal is priced at Henry’s stated target', () => {
    /** Ticket 12's measured anchor: a full 8-10 fight run with a 3-member party. */
    const RUN_SCRAP_LOW = 450;
    const RUN_SCRAP_HIGH = 500;

    /**
     * The generics a run accumulates: `START_GENERICS` in the opening deck, plus `RECRUIT_GENERICS`
     * for each of the two recruits a 1 → 2 → 3 party takes on (`vision.md`).
     */
    const RECRUITS_PER_RUN = 2;
    const GENERICS_PER_RUN = START_GENERICS + RECRUIT_GENERICS * RECRUITS_PER_RUN;

    it('counts five generics in a full run, which is what the price is divided against', () => {
        expect(GENERICS_PER_RUN).toBe(5);
        expect(GENERIC_HIT).toBe('water_slap');
    });

    it('costs roughly one market visit’s scrap to strip them all', () => {
        const visitScrapLow = RUN_SCRAP_LOW / MARKET_VISITS_PER_RUN;   // 150
        const visitScrapHigh = RUN_SCRAP_HIGH / MARKET_VISITS_PER_RUN; // ~167
        const stripAll = REMOVAL_PRICE * GENERICS_PER_RUN;             // 150

        expect(stripAll).toBe(150);
        // "Roughly one visit's scrap" — between 85% and 115% of a visit at both ends of ticket 12's
        // measured band. Anything outside that is a different design, not a rounding difference.
        expect(stripAll / visitScrapLow).toBeGreaterThanOrEqual(0.85);
        expect(stripAll / visitScrapLow).toBeLessThanOrEqual(1.15);
        expect(stripAll / visitScrapHigh).toBeGreaterThanOrEqual(0.85);
    });

    it('costs more than the cheapest card and less than a good one, so the sink competes', () => {
        const cheapest = Math.min(...REGISTRY_IDS.map(cardPrice));
        expect(REMOVAL_PRICE).toBeGreaterThan(cheapest);
        expect(REMOVAL_PRICE).toBeLessThan(CARD_PRICE_BY_RARITY.Uncommon);
    });

    it('pays nothing back — removal is a sink, not a trade', () => {
        // Selling the same generic returns a third of what removing it costs. That gap is the whole
        // choice the sink presents: the slow cheap way out, or the fast expensive one.
        expect(sellPrice(GENERIC_HIT)).toBeLessThan(REMOVAL_PRICE);
    });
});
