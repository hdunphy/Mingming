/**
 * The marketplace — ticket 13, repriced by ticket 57 against Henry's ticket 56 ruling.
 *
 * Six claims, each of which can be false without anything crashing, which is what makes them worth
 * a test rather than a comment:
 *
 * - **The stock re-rolls per visit and only per visit** (Henry, 2026-08-21). A cached stock looks
 *   identical until the second visit; a stock rolled from a fresh seed each render looks identical
 *   until the player resumes a saved run and finds the stall restocked behind their back.
 * - **The pool rule is the reward pool's, plus a genuinely off-pool wild-card.** A "wild-card" drawn
 *   from the party pool is a sixth ordinary row wearing a badge, and a mono-species run would never
 *   notice.
 * - **A price is the card's printed energy and NOTHING else.** Ticket 56 replaced ticket 13's
 *   `rarity base + 8 x energy` with a four-rung table read by energy alone, so the claim this file
 *   used to make — *"every card sharing a (rarity, cost) pair prices identically"* — is now too weak
 *   to catch a regression: the test that matters is that **two cards of the same energy and
 *   different rarity cost the same**, which the old model went out of its way to make false. `power`
 *   is still barred from the formula by the same standing law (map § Notes), so both exclusions are
 *   asserted behaviourally rather than by grep.
 * - **The market takes and never gives.** Henry: *"cards cannot be sold."* Ticket 13 kept "not
 *   farmable to zero" true with a `sell < buy` clamp and a test per registry card; there is now no
 *   sell verb at all, so the law is asserted at the module's surface instead.
 * - **The reroll stays strictly under the cheapest card.** The one ordering law the module still
 *   claims, and the only reason `REROLL_PRICE` moved at all — at ticket 13's 20 against ticket 56's
 *   15-scrap floor, rerolling would cost more than buying.
 * - **The removal price's arithmetic is recomputed here — against a target that has since been
 *   retired.** *"Stripping all generics over a run costs roughly one market visit's scrap"* was a
 *   number with a derivation, and the derivation is still checked against the constants it was
 *   derived from. Two rulings have since emptied the target out: Henry's 2026-08-25 move of the
 *   generics from per-member to per-run leaves a whole run holding **two** of them, and Henry has
 *   separately ruled that **paid removal is no longer how a deck gets thinned** — cards move to a
 *   run collection instead (a later package). The block below therefore keeps the arithmetic exact
 *   and says plainly that it is no longer measuring a live design goal; retuning `RUN_GENERICS`,
 *   the market count or the income table still fails the test rather than quietly falsifying the
 *   comment.
 */

import { afterAll, describe, expect, it } from 'vitest';

import * as marketplace from './marketplace';
import {
    CARD_PRICE_BY_ENERGY,
    MARKET_STOCK_SIZE,
    MARKET_VISITS_PER_RUN,
    MARKET_WILDCARD_SLOTS,
    MAX_PRICED_ENERGY,
    REMOVAL_PRICE,
    REROLL_PRICE,
    cardPrice,
    isMarketNode,
    isOfferSold,
    rollMarketStock,
} from './marketplace';
import { RUN_GENERICS, createRun } from './createRun';
import { encounterSeed } from './encounter';
import { nodeSeed } from './nodeSeed';
import { offerGyms } from './gyms';
import { PARTY_SIZE } from '../party';
import { rewardCardPool, scrapForWin } from '../RewardSystem';
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
// Prices — printed energy is the whole formula
// ---------------------------------------------------------------------------------------------

const REGISTRY_IDS = Object.keys(ProgramRegistry);

/**
 * Henry's ruled table, written out here as the four numbers he said rather than imported, so that
 * an edit to `CARD_PRICE_BY_ENERGY` has to be an edit to a *quotation of the ruling* as well:
 *
 * > *"Market buy: 0e 15 / 1e 25 / 2e 35 / 3e 45."* (ticket 56)
 */
const RULED_TABLE: ReadonlyArray<number> = [15, 25, 35, 45];

/** The rung a card of this printed energy sits on, clamp included. `X` resolves through the caller. */
const rungFor = (energy: number): number => RULED_TABLE[Math.min(Math.max(energy, 0), 3)];

describe('a price is the card’s printed energy, and nothing else', () => {
    it('is Henry’s ruled table, on the 5-scrap grid the income sits on', () => {
        expect([...CARD_PRICE_BY_ENERGY]).toEqual(RULED_TABLE);
        // The clamp point is the table's own length, not a second number that could drift from it.
        expect(MAX_PRICED_ENERGY).toBe(RULED_TABLE.length - 1);
        // "Numbers move in 5s" (map § Notes) — the rule that turned the reroll's 12.5 into 10.
        for (const price of CARD_PRICE_BY_ENERGY) expect(price % 5).toBe(0);
    });

    it('prices every card in the registry off its printed energy alone', () => {
        for (const id of REGISTRY_IDS) {
            const energy = numericBaseCost(ProgramRegistry[id].baseCost);
            expect([id, cardPrice(id)]).toEqual([id, rungFor(energy)]);
        }
    });

    it('collapses 216 shipped cards onto FOUR prices, one per rung', () => {
        // The registry-scale form of "energy is the whole formula". Ticket 13's model spread these
        // same cards over thirteen (rarity, energy) buckets; ticket 56's spreads them over the four
        // rungs and no more, because there is nothing else left in the formula to spread them by.
        const prices = new Set(REGISTRY_IDS.map(cardPrice));
        expect([...prices].sort((a, b) => a - b)).toEqual(RULED_TABLE);

        // And every rung is a rung some shipped card actually stands on — a table with a dead rung
        // in it is a table that has drifted off the cards it prices.
        expect(prices.size).toBe(CARD_PRICE_BY_ENERGY.length);

        // The collapse is real work, not an accident of a flat registry: six distinct printed costs
        // (0, 1, 2, 3, 4 and X) come in and four prices come out, which is the clamp doing its job.
        const printed = new Set(REGISTRY_IDS.map((id) => String(ProgramRegistry[id].baseCost)));
        expect(printed.size).toBeGreaterThan(prices.size);
    });

    it('charges the SAME for two cards of one energy and different rarities', () => {
        // THE ticket 57 claim, and the exact assertion ticket 13's suite made the other way round.
        // Rarity is a drop-rate weight (`RewardSystem.RARITY_WEIGHTS`), not a power tier, and the
        // rev-3 curve prices power in energy — so charging for rarity charged twice for one thing.
        // These three are all 2-energy; the old model billed them 40, 56 and 80.
        expect(ProgramRegistry.bracing_cold.rarity).toBe('Common');
        expect(ProgramRegistry.strength_burst.rarity).toBe('Uncommon');
        expect(ProgramRegistry.core_overclock_daemon.rarity).toBe('Rare');
        expect(cardPrice('bracing_cold')).toBe(35);
        expect(cardPrice('strength_burst')).toBe(35);
        expect(cardPrice('core_overclock_daemon')).toBe(35);
    });

    it('holds that at registry scale: every energy bucket is multi-rarity and single-priced', () => {
        // The named trio above could survive someone re-introducing a rarity term for the tiers it
        // does not cover. This is the same claim over all four rungs at once: each one holds cards
        // of more than one rarity, and every card in it costs the same.
        const byEnergy = new Map<number, { rarities: Set<string>; prices: Set<number> }>();
        for (const id of REGISTRY_IDS) {
            const data = ProgramRegistry[id];
            const rung = Math.min(numericBaseCost(data.baseCost), MAX_PRICED_ENERGY);
            const bucket = byEnergy.get(rung) ?? { rarities: new Set<string>(), prices: new Set<number>() };
            bucket.rarities.add(String(data.rarity));
            bucket.prices.add(cardPrice(id));
            byEnergy.set(rung, bucket);
        }
        expect(byEnergy.size).toBe(CARD_PRICE_BY_ENERGY.length);
        for (const [rung, { rarities, prices }] of byEnergy) {
            expect([rung, rarities.size > 1]).toEqual([rung, true]);
            expect([rung, prices.size]).toEqual([rung, 1]);
        }
    });

    it('prices two cards identical but for their power identically', () => {
        // `power` is a balance instrument (`debug/balance/powerscale.ts`), and a price derived from
        // it would publish it — the standing "true numbers in UI" law (map § Notes). Ticket 56 did
        // not relax this; it removed the only other input, which makes the law easier to hold, not
        // less load-bearing.
        ProgramRegistry.ticket57_feeble = fixture('ticket57_feeble', { power: 1 });
        ProgramRegistry.ticket57_monstrous = fixture('ticket57_monstrous', { power: 999 });

        expect(cardPrice('ticket57_feeble')).toBe(cardPrice('ticket57_monstrous'));
    });

    it('prices two cards identical but for their rarity identically', () => {
        // The fixture form of the registry claim above, so it keeps holding on a registry that has
        // stopped being diverse: same energy, one Common and one Rare, one price.
        ProgramRegistry.ticket57_plain = fixture('ticket57_plain', { rarity: 'Common' });
        ProgramRegistry.ticket57_precious = fixture('ticket57_precious', { rarity: 'Rare' });

        expect(cardPrice('ticket57_plain')).toBe(cardPrice('ticket57_precious'));
        expect(cardPrice('ticket57_plain')).toBe(RULED_TABLE[2]); // both are printed at 2 energy
    });

    it('prices an unknown id at the CHEAPEST rung rather than throwing at a render', () => {
        // A price is asked for by a render, so a stale dataId must produce a plausible number rather
        // than a crashed shop. The fallback moved with the model: ticket 13 fell back to the Common
        // base, and the cheapest rung is what "plausible" means now.
        expect(cardPrice('no-such-card')).toBe(RULED_TABLE[0]);
    });

    it('prices an X-cost card at the TOP rung, via the shared static budget', () => {
        // `numericBaseCost` resolves X to the 3-energy static budget (ticket 22) rather than this
        // module special-casing it, so an X card is priced as the expensive card it plays as.
        expect(numericBaseCost('X')).toBe(MAX_PRICED_ENERGY);
        const xCard = REGISTRY_IDS.find((id) => ProgramRegistry[id].baseCost === 'X');
        expect(xCard).toBeTruthy();
        expect(cardPrice(xCard as string)).toBe(RULED_TABLE[3]);
    });

    it('clamps anything printed above 3 energy onto the top rung', () => {
        // The table has four rungs and the cards do not: `battery_pack` is printed at 4 today, and
        // an off-the-end price would be `undefined` — a NaN on a shop row — without the clamp.
        const overCost = REGISTRY_IDS.filter((id) => numericBaseCost(ProgramRegistry[id].baseCost) > MAX_PRICED_ENERGY);
        expect(overCost.length).toBeGreaterThan(0);
        for (const id of overCost) expect([id, cardPrice(id)]).toEqual([id, RULED_TABLE[3]]);

        // Asserted on a fixture as well, so the clamp stays covered on a day when no shipped card
        // happens to be printed above 3.
        ProgramRegistry.ticket57_colossal = fixture('ticket57_colossal', { baseCost: 7 });
        expect(cardPrice('ticket57_colossal')).toBe(RULED_TABLE[3]);
    });
});

/**
 * A card that exists only to be priced. Everything a price must NOT read — power, rarity, element,
 * actions — is a parameter, and the one thing it must read is `baseCost`.
 */
function fixture(id: string, over: { power?: number; rarity?: Rarity; baseCost?: number | 'X' } = {}): ProgramData {
    return {
        id,
        name: id,
        description: 'fixture',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        rarity: over.rarity ?? 'Rare',
        baseCost: over.baseCost ?? 2,
        constraints: [],
        actions: [{ type: 'ATTACK', power: over.power ?? 10, target: 'TARGET' }],
    };
}

afterAll(() => {
    delete ProgramRegistry.ticket57_feeble;
    delete ProgramRegistry.ticket57_monstrous;
    delete ProgramRegistry.ticket57_plain;
    delete ProgramRegistry.ticket57_precious;
    delete ProgramRegistry.ticket57_colossal;
});

// ---------------------------------------------------------------------------------------------
// The no-farm law — now structural, and the one surviving price ordering
// ---------------------------------------------------------------------------------------------

describe('the market takes and never gives', () => {
    it('offers no way at all to turn a card back into scrap', () => {
        // Henry, ticket 56: "cards cannot be sold." Ticket 13 kept "prices must not be farmable to
        // zero" (Henry, 2026-08-21) true arithmetically — `sellPrice` clamped to `buy - 1`, checked
        // here against all 216 cards. There is now nothing to check, and THAT is the assertion: a
        // sell verb re-appearing on this module is the regression, whatever it is priced at.
        const surface = Object.keys(marketplace);
        // Guards the two assertions below from passing on an empty namespace object, which is the
        // one way a "module exports no X" test can be true and meaningless at the same time.
        expect(surface).toContain('cardPrice');
        expect(surface).not.toContain('sellPrice');
        expect(surface).not.toContain('SELL_MULTIPLIER');
        // Named rather than pattern-matched on purpose: a future `sellMacro` would deserve its own
        // ruling and its own test, not a silent pass under a regex that happened to catch it.
    });

    it('charges for a reroll, and charges strictly less for it than the cheapest card', () => {
        // The one ordering law this module still claims, and the reason REROLL_PRICE moved at all:
        // a reroll buys nothing but a new set of choices, so it must never be the most expensive
        // thing on the screen — and it must never be free, or the stock is a slot machine.
        expect(REROLL_PRICE).toBeGreaterThan(0);
        expect(REROLL_PRICE).toBeLessThan(Math.min(...CARD_PRICE_BY_ENERGY));
        // Against the shelf as it actually stocks, not only against the table.
        expect(REROLL_PRICE).toBeLessThan(Math.min(...REGISTRY_IDS.map(cardPrice)));
        // Ticket 13's 20 is what this catches: it was under a 24-scrap floor and is over a 15 one.
        expect(20).toBeGreaterThan(Math.min(...CARD_PRICE_BY_ENERGY));
    });

    it('keeps the reroll close enough to a card that variance is never free', () => {
        // The other half of ticket 13's stated law — "close to it, so it is never free variance."
        // Two thirds of the cheapest card, half a removal. A reroll at 5 would make the stall a
        // slot machine you pull until it pays.
        expect(REROLL_PRICE / Math.min(...CARD_PRICE_BY_ENERGY)).toBeGreaterThan(0.5);
        expect(REROLL_PRICE).toBe(REMOVAL_PRICE / 2);
        expect(REROLL_PRICE % 5).toBe(0);
    });
});

// ---------------------------------------------------------------------------------------------
// The removal price's stated target
// ---------------------------------------------------------------------------------------------

describe('removal, measured against Henry’s stated target', () => {
    /**
     * The run's spendable scrap, recomputed from `scrapForWin`'s income table rather than restated
     * as a literal — two elite biome exits, a three-fight gym, and about six wilds fought by a party
     * growing from one body to three. This is the same derivation `workshop.test.ts` runs, and it is
     * deliberately NOT ticket 12's 450-500 anchor: ticket 56 moved the income, and that anchor is
     * dead wherever it is still quoted.
     */
    const RUN_SCRAP = 2 * scrapForWin('elite', 1)
        + 3 * scrapForWin('gym', PARTY_SIZE)
        + 2 * (scrapForWin('wild', 1) + scrapForWin('wild', 2) + scrapForWin('wild', 3));

    /**
     * The generics a run accumulates, start to finish: **`RUN_GENERICS`, and that is the whole
     * term** (Henry, 2026-08-25 — *"Only add generics for the first mingming. After that the second
     * and third mingmings do not need to add an additional generic card."*).
     *
     * This used to be a sum with a per-recruit term in it, and the sum is gone rather than zeroed.
     * The generics are no longer something a MEMBER brings — they are a run-level allowance spent
     * on the first mingming — so there is no second term to multiply by `RECRUITS_PER_RUN` and no
     * "generics per recruit" quantity to name. A run holds two whether it ends solo or at a full
     * three-member party.
     *
     * The lineage, since this number is what the strip price is divided against and it has moved
     * every time the deck table has: 5 under ticket 08's 3 + 1, 3 for the one day the 5 + 0 table
     * stood, 6 under ticket 60's 4 + 2 per member, and **2** now.
     */
    const RECRUITS_PER_RUN = 2;
    const GENERICS_PER_RUN = RUN_GENERICS;

    it('counts two generics in a full run, however far the party grew', () => {
        expect(GENERICS_PER_RUN).toBe(2);
        expect(GENERICS_PER_RUN).toBe(RUN_GENERICS);
        // Counted off a real three-member run's actual deck rather than asserted about the constant,
        // because "it does not scale with the party" is the whole ruling and a constant cannot show
        // it. A 1 → 2 → 3 party takes on `RECRUITS_PER_RUN` recruits (`vision.md`) and each of them
        // brings its kit and no filler, so this count is the same two the run opened with.
        expect(TRIO).toHaveLength(1 + RECRUITS_PER_RUN);
        const trio = makeRun('generics-count', TRIO);
        expect(trio.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(GENERICS_PER_RUN);
        // And a solo run holds the same two — the allowance is the run's, not the party's.
        expect(RUN.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(GENERICS_PER_RUN);
        expect(GENERIC_HIT).toBe('water_slap');
    });

    it('quotes the income table the derivation is written against', () => {
        // So that a retune of `scrapForWin` fails here rather than leaving the arithmetic below
        // describing a scale the game no longer pays out on.
        //
        // 240, up from 210: the two elite biome exits pay 45 each rather than 30 (Henry,
        // 2026-08-24), so 2 x 45 + 3 x 20 + 2 x (10 + 15 + 20) = 90 + 60 + 90. This is INCOME only.
        // A run now also opens holding `createRun.STARTING_SCRAP`, and that grant lands before the
        // first stall rather than being spread across the three, so it is deliberately not divided
        // into a per-visit figure here — it makes the FIRST visit 20 richer, not every visit.
        expect(RUN_SCRAP).toBe(240);
        expect(RUN_SCRAP / MARKET_VISITS_PER_RUN).toBe(80);
    });

    it('costs half a market visit to strip them all — against a target that has been retired', () => {
        const visitScrap = RUN_SCRAP / MARKET_VISITS_PER_RUN; // 240 / 3 = 80
        const stripAll = REMOVAL_PRICE * GENERICS_PER_RUN;    // 20 x 2 = 40

        expect(stripAll).toBe(40);
        expect(visitScrap).toBe(80);
        /*
         * **FLAG FOR HENRY: this block no longer measures a live design goal, and the honest thing
         * is to say so rather than to invent a new band for it to hit.** The arithmetic below is
         * recomputed exactly from the shipped constants, and it is kept because a silent move in
         * `REMOVAL_PRICE`, `MARKET_VISITS_PER_RUN`, the income table or the generic count should
         * still fail a test. What it can no longer do is tell you whether the price is RIGHT.
         *
         * The history, since the number crossed ticket 13's "roughly one market visit's scrap"
         * target twice before landing here: ticket 13 aimed at one visit (30 against a 150-scrap
         * visit). Ticket 56's income made the ruled 20 a dearer strip — 100 against a 70-scrap
         * visit, about one and a half. The 2026-08-24 pass moved it back inside from both ends
         * (elite raise 70 -> 80, and recruits stopped bringing a generic, 5 -> 3), giving 60/80.
         * Ticket 60's 4 + 2 per member took it back out to 120/80, 1.5 visits.
         *
         * **Both of the things that target was made of are now gone.**
         *
         * The first is the generic count. Henry's 2026-08-25 ruling makes the generics a run-level
         * allowance — two, on the first mingming, never multiplied by the party — so a full strip is
         * two removals, 40 against an ~80-scrap visit. The target was really a proxy for a deck
         * problem: filler multiplied with the party, so the run was sold padding at a workshop and
         * then had to buy it back out at a stall, and the removal price was the lever that decided
         * how painful that round trip was. The ruling deletes the round trip at the source. Two
         * generics in a whole run is not a deck someone needs to save up to fix.
         *
         * The second is paid removal itself. Henry has ruled that buying removals is no longer how
         * a deck gets thinned — cards move to a run collection instead, in a later package. So
         * "what fraction of a market visit does a full strip cost" is not a question the design is
         * asking any more, and 0.5 is neither a pass nor a miss against it: there is nothing left
         * to be measured against. Do NOT read the numbers below as a new band, and do not retune
         * `REMOVAL_PRICE` to move them — when the collection package lands, this block should be
         * rewritten against whatever the collection actually charges, or deleted with it.
         */
        expect(stripAll / visitScrap).toBe(0.5);
        // The 1.5-visit breach ticket 60 opened is closed — but closed by there being almost
        // nothing left to strip, not by anyone retuning the price. `REMOVAL_PRICE` has not moved.
        expect(stripAll / visitScrap).toBeLessThan(1);
        expect(REMOVAL_PRICE).toBe(20);
        // A sixth of the run's income, down from a half. Pinned exactly so that any move in the
        // price, the income table or the generic count fails here on sight.
        expect(stripAll / RUN_SCRAP).toBe(1 / 6);
    });

    it('sits between the cheapest card and the next rung up, so the sink competes', () => {
        // Ticket 13 could say "dearer than the cheapest card and under an Uncommon"; with rarity out
        // of the formula the same shape is now stated against the rungs. Removal is dearer than a
        // 0-energy card and cheaper than a 1-energy one — the sink is a real alternative to a
        // purchase at every stall, without being the obvious default.
        expect(REMOVAL_PRICE).toBeGreaterThan(Math.min(...REGISTRY_IDS.map(cardPrice)));
        expect(REMOVAL_PRICE).toBeGreaterThan(CARD_PRICE_BY_ENERGY[0]);
        expect(REMOVAL_PRICE).toBeLessThan(CARD_PRICE_BY_ENERGY[1]);
    });

    it('pays nothing back — removal is a pure sink, not a trade', () => {
        // Ticket 13 made this a comparison (removing cost more than selling paid). Selling is gone,
        // so the claim is now absolute: the scrap a removal consumes exceeds what the shelf would
        // charge for the very card being removed, and none of it ever comes back.
        expect(cardPrice(GENERIC_HIT)).toBe(CARD_PRICE_BY_ENERGY[0]);
        expect(REMOVAL_PRICE).toBeGreaterThan(cardPrice(GENERIC_HIT));
    });
});
