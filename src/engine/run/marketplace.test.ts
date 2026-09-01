/**
 * The marketplace — ticket 13, repriced by ticket 57, and re-verbed by ticket 61's amended spec.
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
 * - **A sale never pays what the same card costs.** Selling came back (Henry, 2026-08-26) and paid
 *   removal went in the same pass, so the "prices must not be farmable to zero" law of 2026-08-21 is
 *   live again and is once more arithmetic rather than an absence. Ticket 13 held it with a
 *   `Math.min(sell, buy - 1)` clamp; a ruled table of four literals holds it by construction, so the
 *   test **reads the two arrays side by side** — rung against its own rung — and then re-checks it
 *   per card across the whole registry, which is the form ticket 57 deleted along with the verb.
 * - **The reroll stays strictly under the cheapest card.** The one ordering law the module still
 *   claims, and the only reason `REROLL_PRICE` moved at all — at ticket 13's 20 against ticket 56's
 *   15-scrap floor, rerolling would cost more than buying.
 * - **Paid removal is gone from the module's surface, and the arithmetic it anchored is re-aimed at
 *   the sell table.** *"Stripping all generics over a run costs roughly one market visit's scrap"*
 *   was a number with a derivation, and both halves of that derivation have since been emptied out:
 *   the generics are the STARTER's three rather than a per-member helping, and a card now leaves the
 *   active deck for the run collection **for free**, so there is no removal left to price. What is
 *   kept is the derivation's machinery — the income table recomputed from `scrapForWin`, and the
 *   generic count counted off a real three-member run — now measuring what a full run's filler is
 *   WORTH at the stall rather than what it costs to be rid of. Retuning `STARTER_GENERICS`, the
 *   market count or the income table still fails a test rather than quietly falsifying a comment.
 */

import { afterAll, describe, expect, it } from 'vitest';

import * as marketplace from './marketplace';
import {
    CARD_PRICE_BY_ENERGY,
    MARKET_NEUTRAL_SLOTS,
    GYM_COUNTER_ANSWERS,
    MARKET_NEUTRAL_UTILITY,
    MARKET_STOCK_SIZE,
    MARKET_TOTAL_SLOTS,
    MARKET_VISITS_PER_RUN,
    MARKET_WILDCARD_SLOTS,
    MAX_PRICED_ENERGY,
    REROLL_PRICE,
    SELL_PRICE_BY_ENERGY,
    cardPrice,
    isMarketNode,
    isOfferSold,
    rollMarketStock,
    sellPrice,
} from './marketplace';
import { STARTER_GENERICS, createRun } from './createRun';
import { encounterSeed } from './encounter';
import { nodeSeed } from './nodeSeed';
import { offerGyms } from './gyms';
import { PARTY_SIZE } from '../party';
import { isRewardable, rewardCardPool, scrapForWin } from '../RewardSystem';
import { GENERIC_HIT, LAUNCH_SPECIES, MingmingRegistry, getDeckForOS } from '../data/mingmingRegistry';
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
    it('is MARKET_STOCK_SIZE from the pool plus a neutral and a stranger — seven, ruled 2026-08-28', () => {
        const stock = stockAt(MARKET);
        const pool = rewardCardPool(SOLO);

        expect(stock.offers.length).toBe(MARKET_TOTAL_SLOTS);
        expect(MARKET_TOTAL_SLOTS).toBe(MARKET_STOCK_SIZE + MARKET_NEUTRAL_SLOTS + MARKET_WILDCARD_SLOTS);

        const bySlot = (slot: string) => stock.offers.filter((o) => o.slot === slot);
        expect(bySlot('pool').length).toBe(MARKET_STOCK_SIZE);
        expect(bySlot('neutral').length).toBe(MARKET_NEUTRAL_SLOTS);
        expect(bySlot('stranger').length).toBe(MARKET_WILDCARD_SLOTS);

        for (const offer of bySlot('pool')) expect(pool).toContain(offer.card.dataId);
        // `wildcard` means the STRANGER now, and only it. Henry's element ruling made a neutral card
        // part of every party's pool, so calling that slot off-pool would be untrue.
        expect(stock.offers.filter((o) => o.wildcard).map((o) => o.slot)).toEqual(['stranger']);
        for (const offer of bySlot('stranger')) expect(pool).not.toContain(offer.card.dataId);
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

    /**
     * TICKET 69 — the off-pool slot's draw list.
     *
     * The list is PINNED here, which the ticket asks for by name: *"a test pins the slot's draw
     * list so a future card pass cannot silently empty it."* An emptied list is the failure mode
     * with no other alarm — `drawDistinct` stops on an exhausted source rather than throwing, so a
     * card pass that renamed `hamstring` would silently produce a five-row shop with no wild-card
     * slot at all, and every other test here would still pass.
     */
    describe('the neutral-utility list (ticket 69)', () => {
        it('holds the ruled seed entry, and is not empty', () => {
            expect(MARKET_NEUTRAL_UTILITY.length).toBeGreaterThan(0);
            // 67 R4.3 names this card. It is the hedge; the rest of the list is breadth.
            expect(MARKET_NEUTRAL_UTILITY).toContain('hamstring');
            expect(new Set(MARKET_NEUTRAL_UTILITY).size).toBe(MARKET_NEUTRAL_UTILITY.length);
        });

        it('carries EVERY toolbox printing — the standing law, asserted per gym', () => {
            /*
             * `research/69-toolbox-printings.md` closes ticket 69's law: *every gym boss ships with
             * at least THREE counter flavors reachable by any party*. Henry's reason is on the
             * ticket — *"otherwise you build the same deck every time and it feels bad if you can't
             * find the one card"* — so the law is about REACHABILITY, and it is asserted per gym
             * rather than as a flat list, because a flat list would still pass if all nine answers
             * belonged to one boss.
             *
             * A card that is printed but not stocked here is unreachable, which is the same outcome
             * as never printing it and has no other alarm.
             */
            // Read from the exported table rather than a second copy: a hand-written list here
            // would keep passing after the real one drifted, which is the failure this guards.
            expect(Object.keys(GYM_COUNTER_ANSWERS)).toHaveLength(3);
            for (const [gym, answers] of Object.entries(GYM_COUNTER_ANSWERS)) {
                expect(answers.length, `${gym} needs three flavors`).toBeGreaterThanOrEqual(3);
                for (const id of answers) {
                    expect(MARKET_NEUTRAL_UTILITY, `${gym} — ${id} is not reachable`).toContain(id);
                }
            }
        });

        it('every entry satisfies the three conditions the list is DERIVED from', () => {
            const inSomeLaunchDeck = new Set<string>();
            for (const species of LAUNCH_SPECIES) {
                for (const os of MingmingRegistry[species].availableOS) {
                    for (const id of getDeckForOS(species, os)) inSomeLaunchDeck.add(id);
                }
            }

            for (const id of MARKET_NEUTRAL_UTILITY) {
                const data = ProgramRegistry[id];
                expect(data, `${id} is not a real card`).toBeTruthy();
                // 1. Neutral, so it is equally at home in any deck and gains STAB nowhere.
                expect(data.element, `${id} is not element None`).toBe('None');
                /*
                 * 2. In no LAUNCH species' deck — the set an EA party's pool can never contain,
                 *    which is the whole reason the hedge is needed. LAUNCH rather than PLAYABLE
                 *    deliberately: all three shipped entries DO appear in a post-launch species'
                 *    list (hamstring in hel_v1, adrenaline in sleipnir_v1, squirrel_away in
                 *    fafnir_v2 / hel_v2), and that is not a conflict — `rollMarketStock` keeps the
                 *    `!pool.includes` filter, so a future party fielding hel simply is not offered
                 *    a card it already drafts. Asserting PLAYABLE here would forbid three cards for
                 *    a reason that will not exist until those species ship, and would then be wrong
                 *    in the other direction.
                 */
                expect(inSomeLaunchDeck.has(id), `${id} is already in a launch deck`).toBe(false);
                // 3. Real content, not an internal token.
                expect(isRewardable(id), `${id} is not rewardable`).toBe(true);
            }
        });

        it('NEVER puts the control species’ calibration deck on sale — the bug this closed', () => {
            // `control` is the balance corpus's deliberate FLOOR ("the worst deck in the game") and
            // is not in PLAYABLE_SPECIES, so its six `baseline_*` cards fell straight through the
            // old "not in the party's pool" filter and onto the shelf at roughly 3% a visit.
            const calibration = getDeckForOS('control', 'control_v1');
            expect(calibration.length).toBeGreaterThan(0);
            for (const id of calibration) expect(MARKET_NEUTRAL_UTILITY).not.toContain(id);

            for (const node of MARKETS) {
                for (const visit of [1, 2, 3]) {
                    for (const offer of stockAt(visited(node, visit)).offers) {
                        expect(calibration, 'a calibration card reached the shelf')
                            .not.toContain(offer.card.dataId);
                    }
                }
            }
        });

        it('reserves its slot at EVERY market and visit — the shelf is never six', () => {
            /*
             * This is the test the element ruling nearly broke, and the reason the draw filters on
             * "not already taken" rather than "not in the pool".
             *
             * Under the old species rule the neutral list was outside every party pool, so
             * `!pool.includes(id)` was a no-op on it. Henry's ruling folds every neutral card into
             * every party's pool, so that same filter would have emptied this source and dropped
             * the shelf to six with nothing failing — `drawDistinct` stops on an exhausted source
             * rather than throwing.
             */
            for (const node of MARKETS) {
                for (const visit of [1, 2, 3]) {
                    const offers = stockAt(visited(node, visit)).offers;
                    const neutral = offers.filter((o) => o.slot === 'neutral');
                    expect(neutral.length).toBe(MARKET_NEUTRAL_SLOTS);
                    for (const offer of neutral) {
                        expect(MARKET_NEUTRAL_UTILITY).toContain(offer.card.dataId);
                    }
                }
            }
        });

        it('never shows the same card twice on one shelf', () => {
            // The two off-pool sources are disjoint by construction (`stranger` excludes the neutral
            // list) — this is the claim that stays true if either source is edited.
            for (const node of MARKETS) {
                for (const visit of [1, 2, 3]) {
                    const ids = stockAt(visited(node, visit)).offers.map((o) => o.card.dataId);
                    expect(new Set(ids).size).toBe(ids.length);
                }
            }
        });

        it('reaches EVERY party — a solo of any launch species can be offered hamstring', () => {
            /*
             * The ruling's actual requirement (67 R4.3): the mechanical answer must be *purchasable*
             * by any party, without changing any species pool. Not guaranteed — purchasable. So this
             * asserts the card is REACHABLE for each launch species rather than that it always
             * appears, and it does it by walking real markets rather than by inspecting the list,
             * because the list being right and the draw being right are two different claims.
             */
            for (const species of LAUNCH_SPECIES) {
                const party = [member('mm1', species, MingmingRegistry[species].availableOS[0])];
                let seen = false;
                for (let seed = 0; seed < 12 && !seen; seed += 1) {
                    const run = makeRun(`neutral-reach-${species}-${seed}`, party);
                    for (const node of run.nodes.filter((n) => n.kind === 'marketplace')) {
                        for (const visit of [1, 2, 3]) {
                            const stock = stockAt(visited(node, visit), run, party);
                            if (stock.offers.some((o) => o.card.dataId === 'hamstring')) seen = true;
                        }
                    }
                }
                expect(seen, `a solo ${species} was never offered hamstring`).toBe(true);
            }
        });

        it('prices it off ENERGY alone, with no neutral premium — ticket 56 is unchanged', () => {
            // Ticket 69's brief mentions a "~+20% None-element" pricing law. There is no such law in
            // the code and adding one would contradict ticket 56's ruling, which is explicit that a
            // card's price is its energy and nothing else ("a 2-energy Common and a 2-energy Rare
            // both cost 35... a design statement, not a simplification"). Flagged in the resolution.
            for (const id of MARKET_NEUTRAL_UTILITY) {
                const energy = numericBaseCost(ProgramRegistry[id].baseCost);
                expect(cardPrice(id)).toBe(CARD_PRICE_BY_ENERGY[Math.min(Math.max(energy, 0), 3)]);
            }
            expect(cardPrice('hamstring')).toBe(CARD_PRICE_BY_ENERGY[1]);
        });
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
    delete ProgramRegistry.ticket61_plain;
    delete ProgramRegistry.ticket61_precious;
    delete ProgramRegistry.ticket61_colossal;
});

// ---------------------------------------------------------------------------------------------
// Selling, the no-loop law, and the one surviving price ordering
// ---------------------------------------------------------------------------------------------

describe('the market buys back, and always for less than it sold', () => {
    it('sells the two verbs it has, and no longer sells a removal', () => {
        // Henry, 2026-08-26: selling is back and paid removal is deleted — *"the two verbs traded
        // places."* Ticket 56 banned selling and ticket 57 deleted `sellPrice`; this assertion is
        // that pair inverted, and it is a surface check for the same reason it was one then: a
        // `REMOVAL_PRICE` re-appearing on this module is the regression now, whatever it is priced
        // at, because a card leaves the active deck for the run collection for free.
        const surface = Object.keys(marketplace);
        // Guards the assertions below from passing on an empty namespace object, which is the one
        // way a "module exports no X" test can be true and meaningless at the same time.
        expect(surface).toContain('cardPrice');
        expect(surface).toContain('sellPrice');
        expect(surface).toContain('SELL_PRICE_BY_ENERGY');
        expect(surface).not.toContain('REMOVAL_PRICE');
        // Named rather than pattern-matched on purpose: a future `removeMacro` would deserve its own
        // ruling and its own test, not a silent pass under a regex that happened to catch it.
    });

    it('is Henry’s ruled sell table — 5 / 10 / 15 / 20 by energy, on the 5-scrap grid', () => {
        // Quoted as the four numbers he said rather than only imported, the same way `RULED_TABLE`
        // quotes the buy rungs: an edit to `SELL_PRICE_BY_ENERGY` has to be an edit to a quotation
        // of the ruling as well.
        expect([...SELL_PRICE_BY_ENERGY]).toEqual([5, 10, 15, 20]);
        expect(SELL_PRICE_BY_ENERGY.length).toBe(CARD_PRICE_BY_ENERGY.length);
        for (const price of SELL_PRICE_BY_ENERGY) expect(price % 5).toBe(0);
    });

    it('THE NO-LOOP LAW: every sell rung is strictly below its OWN buy rung', () => {
        /*
         * The restored form of ticket 13's law (Henry, 2026-08-21: *"prices must not be farmable to
         * zero"*), which ticket 57 deleted along with the verb it governed.
         *
         * Ticket 13 held it with a `Math.min(sell, buy - 1)` clamp — machinery that existed to make
         * the law true for whatever multiplier someone typed. A ruled table of four literals makes
         * the clamp unnecessary and the law **checkable by reading the two arrays side by side**,
         * which is exactly what this does: rung i against rung i, never a total or a minimum, because
         * "sell is under buy on average" is precisely the true-sounding statement that would let one
         * rung mint scrap.
         */
        expect(SELL_PRICE_BY_ENERGY.length).toBe(CARD_PRICE_BY_ENERGY.length);
        SELL_PRICE_BY_ENERGY.forEach((sell, energy) => {
            const buy = CARD_PRICE_BY_ENERGY[energy];
            expect([energy, sell < buy]).toEqual([energy, true]);
            // The pair spelled out, so a failure prints the rung that broke rather than `false`.
            expect([energy, sell, buy]).toEqual([energy, [5, 10, 15, 20][energy], [15, 25, 35, 45][energy]]);
        });
    });

    it('holds the no-loop law per card, over the whole shipped registry', () => {
        // Ticket 13 asserted this card by card across all 216 shipped programs, and ticket 57
        // deleted it with `sellPrice`. Restored in the same form: the rung-vs-rung check above is
        // about the TABLES, and this is about the two FUNCTIONS that read them — a `sellPrice` that
        // resolved energy differently from `cardPrice` (a missing clamp, a different unknown-id
        // fallback) would satisfy the table law and still mint scrap on a real card.
        expect(REGISTRY_IDS.length).toBeGreaterThan(200);
        for (const id of REGISTRY_IDS) {
            expect([id, sellPrice(id) < cardPrice(id)]).toEqual([id, true]);
        }
        // Both ends of the fallback behaviour too, since neither is a registry id: an unknown card
        // and an X-cost card both have to keep the law rather than falling off opposite ends of it.
        expect(sellPrice('no-such-card')).toBeLessThan(cardPrice('no-such-card'));
        const xCard = REGISTRY_IDS.find((id) => ProgramRegistry[id].baseCost === 'X') as string;
        expect(sellPrice(xCard)).toBe(SELL_PRICE_BY_ENERGY[MAX_PRICED_ENERGY]);
        expect(sellPrice(xCard)).toBeLessThan(cardPrice(xCard));
    });

    it('pays on printed energy alone, clamp and unknown-id fallback included', () => {
        // The sell side of "a price is the card's printed energy and nothing else" — same law, same
        // reasons (`power` is a balance instrument; rarity is a drop-rate weight), and it has to hold
        // on the paying side too or the shop would be readable in one direction only.
        for (const id of REGISTRY_IDS) {
            const energy = Math.min(Math.max(numericBaseCost(ProgramRegistry[id].baseCost), 0), MAX_PRICED_ENERGY);
            expect([id, sellPrice(id)]).toEqual([id, SELL_PRICE_BY_ENERGY[energy]]);
        }
        // Same-energy, different-rarity, different-power: one payout. Its own fixtures rather than
        // the buy tests' — a test that reads state another test registered passes or fails on the
        // runner's ordering, which is not a property of the shop.
        ProgramRegistry.ticket61_plain = fixture('ticket61_plain', { rarity: 'Common', power: 1 });
        ProgramRegistry.ticket61_precious = fixture('ticket61_precious', { rarity: 'Rare', power: 999 });
        ProgramRegistry.ticket61_colossal = fixture('ticket61_colossal', { baseCost: 7 });

        expect(sellPrice('ticket61_plain')).toBe(sellPrice('ticket61_precious'));
        expect(sellPrice('ticket61_plain')).toBe(SELL_PRICE_BY_ENERGY[2]); // both printed at 2 energy
        expect(sellPrice('ticket61_colossal')).toBe(SELL_PRICE_BY_ENERGY[MAX_PRICED_ENERGY]);
        // An unknown id pays the cheapest rung rather than throwing, for `cardPrice`'s reason: a
        // price is asked for by a render, and being wrong cheap is the smaller lie.
        expect(sellPrice('no-such-card')).toBe(SELL_PRICE_BY_ENERGY[0]);
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
        // Two thirds of the cheapest card. A reroll at 5 would make the stall a slot machine you
        // pull until it pays.
        expect(REROLL_PRICE / Math.min(...CARD_PRICE_BY_ENERGY)).toBeGreaterThan(0.5);
        // Pinned exactly. This line used to read `REROLL_PRICE === REMOVAL_PRICE / 2`, which held
        // the number to the digit by tying it to a price that no longer exists — so the digit is
        // written down instead, with its derivation: ticket 13's 20/24 ratio (0.83) against ticket
        // 56's 15-scrap floor is 12.5, rounded onto the 5-scrap grid. Still FLAGGED as derived
        // rather than ruled; if it is wrong it is wrong by 5.
        expect(REROLL_PRICE).toBe(10);
        expect(REROLL_PRICE % 5).toBe(0);
    });

    it('costs more than the cheapest sale, so one generic never buys a fresh shelf', () => {
        // The reroll is the one thing at the stall that consumes scrap and hands back nothing, and
        // now that the market pays out again it is worth stating what it costs in SALES rather than
        // only in cards: two 0-energy sales, which is every generic a solo run holds but one. That
        // keeps "never free variance" true from the paying side as well as the buying side.
        expect(REROLL_PRICE).toBeGreaterThan(SELL_PRICE_BY_ENERGY[0]);
        expect(REROLL_PRICE / SELL_PRICE_BY_ENERGY[0]).toBe(2);
    });
});

// ---------------------------------------------------------------------------------------------
// What a run's filler is worth at the stall — the derivation paid removal used to anchor
// ---------------------------------------------------------------------------------------------

describe('the generics, measured against the run’s income', () => {
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
     * The generics a run accumulates, start to finish: **`STARTER_GENERICS`, and that is the whole
     * term** (Henry, 2026-08-26 — *"the STARTER opens with 5 engine + 3 generics. A RECRUIT brings
     * only its 5 engine cards, no generics."*).
     *
     * This used to be a sum with a per-recruit term in it, and the sum is gone rather than zeroed.
     * The generics are no longer something a MEMBER brings — they are the starter's allowance, spent
     * at the top of the party — so there is no second term to multiply by `RECRUITS_PER_RUN` and no
     * "generics per recruit" quantity to name. A run holds three whether it ends solo or at a full
     * three-member party.
     *
     * The lineage, since this number has moved every time the deck table has: 5 under ticket 08's
     * 3 + 1, 3 for the one day the 5 + 0 table stood, 6 under ticket 60's 4 + 2 per member, 2 under
     * the 2026-08-25 run-level allowance, and **3** now.
     */
    const RECRUITS_PER_RUN = 2;
    const GENERICS_PER_RUN = STARTER_GENERICS;

    it('counts three generics in a full run, however far the party grew', () => {
        expect(GENERICS_PER_RUN).toBe(3);
        expect(GENERICS_PER_RUN).toBe(STARTER_GENERICS);
        // Counted off a real three-member run's actual deck rather than asserted about the constant,
        // because "it does not scale with the party" is the whole ruling and a constant cannot show
        // it. A 1 → 2 → 3 party takes on `RECRUITS_PER_RUN` recruits (`vision.md`) and each of them
        // brings its kit and no filler, so this count is the same three the run opened with.
        expect(TRIO).toHaveLength(1 + RECRUITS_PER_RUN);
        const trio = makeRun('generics-count', TRIO);
        expect(trio.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(GENERICS_PER_RUN);
        // And a solo run holds the same three — the allowance is the starter's, not the party's.
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

    it('pays a sixteenth of a market visit to sell them all — costing nothing to be rid of', () => {
        const visitScrap = RUN_SCRAP / MARKET_VISITS_PER_RUN;          // 240 / 3 = 80
        const sellAll = sellPrice(GENERIC_HIT) * GENERICS_PER_RUN;     // 5 x 3 = 15

        expect(sellAll).toBe(15);
        expect(visitScrap).toBe(80);
        /*
         * **This block used to price a REMOVAL, and the thing it measured is gone rather than
         * repriced.** The arithmetic is recomputed exactly from the shipped constants, and it is
         * kept because a silent move in the sell table, `MARKET_VISITS_PER_RUN`, the income table or
         * the generic count should still fail a test. What it measures has changed sign.
         *
         * The history, since the number crossed ticket 13's *"stripping all generics over a run
         * costs roughly one market visit's scrap"* target several times before the target itself was
         * retired: ticket 13 aimed at one visit (30 against a 150-scrap visit). Ticket 56's income
         * made the ruled 20 a dearer strip — 100 against a 70-scrap visit, about one and a half. The
         * 2026-08-24 pass moved it back inside from both ends (elite raise 70 → 80, recruits stopped
         * bringing a generic), giving 60/80. Ticket 60's 4 + 2 per member took it back out to
         * 120/80. The 2026-08-25 run-level allowance left two generics and a 40/80 strip.
         *
         * **Henry deleted paid removal on 2026-08-26, so the target has no subject left.** The old
         * target was really a proxy for a deck problem: filler multiplied with the party, so the run
         * was sold padding at a workshop and then had to buy it back out at a stall, and the removal
         * price was the lever that decided how painful the round trip was. Two rulings deleted the
         * round trip at the source — the generics are the starter's three and never multiply, and a
         * card leaves the active deck for the run collection **for free**.
         *
         * So the question this block asks is now the other one: not *what does it cost to be rid of
         * the filler* (nothing) but *what is the filler WORTH* if you sell it instead. Three
         * 0-energy sales, 15 against an ~80-scrap visit — a fifth of a stall, or two thirds of one
         * reroll. That is deliberately small, and it is the shape Henry asked for: selling is for
         * *"a card you are never going to play"*, not an income stream, and the run's filler is the
         * least valuable thing it owns. Do NOT read the ratio below as a band anyone is aiming at.
         */
        expect(sellAll / visitScrap).toBe(3 / 16);
        expect(sellAll / visitScrap).toBeLessThan(1);
        expect(sellPrice(GENERIC_HIT)).toBe(5);
        // A sixteenth of the run's income, where a full strip used to cost a sixth of it. Pinned
        // exactly so that any move in the sell table, the income table or the generic count fails
        // here on sight.
        expect(sellAll / RUN_SCRAP).toBe(1 / 16);
    });

    it('is worth less to sell than the cheapest card on the shelf costs to buy', () => {
        // Ticket 13 could say a removal was "dearer than the cheapest card and under an Uncommon";
        // with removal deleted, the ordering worth stating is the one the sell table creates. Even
        // the DEAREST sale (a 3-energy card at 20) is over the cheapest buy rung, so selling a card
        // you will never play can fund a card you will — while the whole filler pile (15) still
        // cannot buy the cheapest thing on the shelf (15) outright. Filler is not a bank.
        expect(sellPrice(GENERIC_HIT)).toBeLessThan(Math.min(...REGISTRY_IDS.map(cardPrice)));
        expect(sellPrice(GENERIC_HIT) * GENERICS_PER_RUN).toBe(CARD_PRICE_BY_ENERGY[0]);
        expect(SELL_PRICE_BY_ENERGY[MAX_PRICED_ENERGY]).toBeGreaterThan(CARD_PRICE_BY_ENERGY[0]);
    });

    it('pays back strictly less than it charged — a buy-then-sell lap is a loss', () => {
        // Ticket 13 made this a comparison (removing cost more than selling paid); ticket 57 made it
        // absolute (nothing came back at all). It is a comparison again, and it is the no-loop law
        // stated on the one card every run is holding three of: the generic buys at the cheapest
        // rung and sells for a third of that, so the lap costs 10 scrap and mints none.
        expect(cardPrice(GENERIC_HIT)).toBe(CARD_PRICE_BY_ENERGY[0]);
        expect(sellPrice(GENERIC_HIT)).toBeLessThan(cardPrice(GENERIC_HIT));
        expect(cardPrice(GENERIC_HIT) - sellPrice(GENERIC_HIT)).toBe(10);
    });
});
