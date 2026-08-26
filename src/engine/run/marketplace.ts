/**
 * THE MARKETPLACE — ticket 13 (steam-release map). The first scrap SINK in the game.
 *
 * # WHAT A MARKET IS FOR
 *
 * Ticket 12 gave a run an income (`SCRAP_PER_ENEMY`) and nothing to spend it on. This module is the
 * other half: **buy a card, pay to remove a card** — two verbs over one run-scoped currency, plus
 * ticket 15's macro stall below. (Ticket 13 shipped a third verb, *sell a card*; Henry deleted it in
 * ticket 56, and un-ruled again in 2026-08-26's amendment — see `SELL_PRICE_BY_ENERGY`.)
 * `economy-session.md` calls removal *the
 * designer-added sink* — the one price in the game whose job is to consume scrap rather than to
 * trade it — and Henry's amendment of 2026-08-21 says what it is a sink *for*:
 *
 * > the generic None-element filler (3 in the start deck, 1 per recruit) **is what removal is for**
 * > — price removal so stripping all generics over a run costs roughly one market visit's scrap.
 * > Revisiting a market is allowed (node re-entry), so **stock re-rolls per visit** and **prices
 * > must not be farmable to zero**.
 *
 * Both halves of that amendment are implemented as laws with tests behind them, not as intentions:
 * the stock is a pure function of (run seed, node id, visit count) via `nodeSeed`, and the no-farm
 * half is now **structural rather than arithmetic** — ticket 13 held it with a `sell < buy` clamp,
 * and since ticket 56 there is no way to turn a card back into scrap at all. `marketplace.test.ts`
 * asserts that at the module's surface: a sell verb re-appearing here is the regression, whatever
 * it would be priced at.
 *
 * # POWER DIES AT THE SURFACE
 *
 * A standing law (map § Notes): *"true numbers in UI; `power` is internal pricing only."* `power` is
 * a balance instrument — `debug/balance/powerscale.ts` scores cards with it — and a shop price
 * derived from it would publish that instrument as a player-facing quantity, one arithmetic step
 * from being reverse-engineered. So **prices are keyed on printed energy cost ONLY** — one thing,
 * printed on the card, and since ticket 56 not even rarity joins it (see `CARD_PRICE_BY_ENERGY`).
 * Nothing in this file reads an action's `power`, and `marketplace.test.ts` proves both exclusions
 * behaviourally: two cards of the same printed energy and *different* rarity must price identically
 * (as must two of the same energy and wildly different power), and at registry scale every energy
 * bucket is multi-rarity and single-priced.
 *
 * # WHICH NUMBERS BELOW ARE RULED, AND WHICH ARE STILL PROPOSALS
 *
 * Ticket 13: *"Pricing: propose a table... Henry picks numbers. Stock size, reroll cost and removal
 * price are Henry numbers too."* They are gathered in one block under THE MARKETPLACE KNOB so that
 * ratifying them is editing one screenful, in the style of ticket 12's `SCRAP_PER_ENEMY`. Ticket 56
 * ratified some of that screenful and left the rest open, so the block is no longer uniform:
 *
 * - **RULED** (Henry, ticket 56; applied by ticket 57): the card table `CARD_PRICE_BY_ENERGY`, and
 *   removal at 20 — a service this map no longer sells. **RULED earlier** (`macros-and-drivers.md`, upheld in 56's
 *   reconciliation): `MACRO_PRICE_STANDARD` / `MACRO_PRICE_RARE`.
 * - **STILL PROPOSALS**, each flagged at its own declaration: `MARKET_STOCK_SIZE`,
 *   `MARKET_WILDCARD_SLOTS`, `MACRO_STOCK_SIZE` — and `REROLL_PRICE`, which ticket 57 *derived* from
 *   the ruled card table rather than being handed a number for.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random()`, no
 * `Date.now()`.
 */

import { SeedStream } from '../core/SeedStream';
import { MACRO_IDS, MacroRegistry } from '../data/macroRegistry';
import { ProgramRegistry } from '../data/programRegistry';
import { isRewardable, rewardCardPool, type IRewardPartyMember } from '../RewardSystem';
import { numericBaseCost } from '../types';
import type { Element } from '../types';
import type { IRegionNode, IRunCard, IRunState, NodeKind } from '../runTypes';
import { nodeSeed } from './nodeSeed';

// =================================================================================================
// THE MARKETPLACE KNOB — some of it RULED by Henry in ticket 56, the rest still a proposal
// =================================================================================================

/**
 * ## The anchor everything below is quoted against
 *
 * **Ticket 12's "450-500 a run, ~150 a visit" is dead** — ticket 56 replaced the per-body income
 * with `RewardSystem.scrapForWin`, which pays **10 plus 5 per enemy beyond the first** (1v1 10, 2v2
 * 15, 3v3 20) and **30 flat for an elite**. The modelled run is the one `workshop.ts` derives and
 * both test files recompute from `scrapForWin` rather than restate:
 *
 * | source | count | pays | total |
 * |---|---|---|---|
 * | biome exits that are elites | 2 | 30 | 60 |
 * | the gym (three fights of three) | 1 | 3 × 20 | 60 |
 * | wilds, on a party growing 1 → 2 → 3 | ~6 | 10 / 15 / 20 | 90 |
 *
 * — **about 210 scrap a run**, taken at the low end of ticket 12's 8-10 fight shape because pricing
 * to the optimistic end of a band is how a shop ends up unaffordable for everyone who is not already
 * winning. Ticket 07 puts **exactly one marketplace per biome** and a run is three biomes, so a run
 * sees **three markets** (more if the player backtracks, which costs re-fought wilds and therefore
 * pays for itself).
 *
 * **A market visit's scrap = 210 / 3 = 70.** This one number is the divisor behind the removal
 * price, the stock sizes and the reroll cost, and if Henry retunes `BASE_WIN_SCRAP` /
 * `SCRAP_PER_EXTRA_ENEMY` / `ELITE_WIN_SCRAP` it is the only thing that has to be recomputed here —
 * `marketplace.test.ts` recomputes the 210 and the 70 from those constants, so a retune fails the
 * test rather than quietly falsifying this table.
 *
 * Note what the anchor is NOT: it is not what the player is holding when they walk into market one.
 * Income accumulates across the run, so the first market is poorer than 70 and the third is richer.
 * That skew is the intended shape — the first market is a choice between one card and one removal,
 * the third is a shopping trip — and it is why nothing below is priced so that the *first* visit can
 * clear the stock.
 */
export const MARKET_VISITS_PER_RUN = 3;

/**
 * **PROPOSAL — stock size: 5 cards from the party pool.**
 *
 * Derivation, re-run against ticket 56's numbers: a visit brings **~70 scrap** and the shelf prices
 * at 15/25/35/45 (`CARD_PRICE_BY_ENERGY`) with the offerable registry's **median at 25** — the
 * 1-energy rung is where most printed cards sit. So a visit buys **two cards at most**: three only
 * if all three come off the cheap rung (3 × 15 = 45), and fewer again if the player also removes
 * anything (20). A stock of 5 pool cards + 1 wild-card is therefore **six offers against a purse
 * that clears two of them** — a stock the player can never buy out, which is what makes it a
 * *choice* rather than a queue — while still being small enough to read at a glance on the Steam
 * Deck's 1280x800 (ticket 37) without scrolling past the deck list underneath it.
 *
 * The cut income made this ratio *stronger*, not weaker: ticket 13 sized 5 against a visit that
 * could clear three rows of six, and a visit now clears two. Shrinking the stock to match would be
 * the wrong correction — a shorter shelf at a poorer visit is two constraints doing one job.
 *
 * Smaller (3) makes the reroll mandatory rather than optional; larger (8+) makes every visit a
 * spreadsheet and drowns the wild-card slot, which is the one row with news in it.
 */
export const MARKET_STOCK_SIZE = 5;

/**
 * **PROPOSAL — one off-pool wild-card slot.**
 *
 * `economy-session.md`'s reward-pool recommendation ends in a parenthesis: *"optional off-pool
 * wild-cards"*. This is that parenthesis, and it is the slot that **stops a mono-species party from
 * seeing the same twelve cards all run**. The pool rule the rest of the stock uses is the party's
 * own `getDeckForOS` lists (`rewardCardPool`) — for a solo run that is a single tuned deck of 8-11
 * ids, so without this slot every market and every reward for 40 minutes would draw from the same
 * short list, and "recruiting is drafting" would read as "recruiting is the only drafting".
 *
 * One slot in six is ~17% of the stock: enough that every visit has something the party could not
 * otherwise be offered (three guaranteed strangers across a run), and few enough that the stock is
 * still recognisably *your team's* cards. Two slots would make the market a general store and blunt
 * the identity ticket 08 spent its whole ruling building.
 */
export const MARKET_WILDCARD_SLOTS = 1;

/**
 * WHAT A CARD COSTS — **RULED by Henry in ticket 56, applied by ticket 57.**
 *
 * > *"Market buy: 0e 15 / 1e 25 / 2e 35 / 3e 45."*
 *
 * # THIS REPLACED A RARITY BASE PLUS AN ENERGY STEP, AND THE MODEL CHANGED, NOT JUST THE NUMBERS
 *
 * Ticket 13 priced a card as `CARD_PRICE_BY_RARITY[rarity] + 8 x energy` — 24/40/64/96 by rarity,
 * plus a step. Henry's table is **energy alone**: a 2-energy Common and a 2-energy Rare both cost 35.
 *
 * That is a design statement, not a simplification. Rarity in this game is a *drop-rate* weight
 * (`RewardSystem.RARITY_WEIGHTS`), not a power tier — the rev-3 curve prices power in **energy**
 * (`50 x E - 10`, `docs/power_curve_spec.md`), so a shop that charged for rarity was charging twice
 * for the same thing and charging it against the wrong axis. A stall now asks "how much of your turn
 * does this cost", which is the question the card itself answers.
 *
 * Four rungs, 10 apart, on the 5-scrap grid the income sits on. Anything printed above 3 energy
 * clamps to the top rung — `numericBaseCost` resolves X-cost cards to the shared 3-energy budget
 * (ticket 22), so an X card is priced as the expensive card it plays as.
 */
export const CARD_PRICE_BY_ENERGY: ReadonlyArray<number> = [15, 25, 35, 45];

/** Anything printed above this is priced as this. See `CARD_PRICE_BY_ENERGY`. */
export const MAX_PRICED_ENERGY = CARD_PRICE_BY_ENERGY.length - 1;

/**
 * WHAT A CARD SELLS FOR — **5 / 10 / 15 / 20 by energy cost 0/1/2/3e** (Henry, 2026-08-26).
 *
 * # SELLING CAME BACK, AND IT IS A DIFFERENT MECHANIC FROM THE ONE THAT LEFT
 *
 * Ticket 56 banned selling and ticket 57 deleted `sellPrice` and `sellRunCard` from this file and
 * from `runSlice`. That ban was right for the game it was ruled against: a deck you could only
 * shrink by paying meant selling was a way to be *paid* for the shrinking you were doing anyway.
 *
 * The run collection removes that shape entirely. Editing a card out of the active deck is free
 * now, so selling is no longer "removal with a rebate paid to you" — it is what you do with a card
 * you are never going to play, at the one node that deals in scrap. Henry: *"now it doesn't feel
 * bad to grab all the cards even if you don't plan to use them, you can get some scrap for them."*
 * That is the reason the ban is repealed rather than worked around, and it is why paid removal is
 * deleted in the same pass: the two verbs traded places.
 *
 * # THE NO-LOOP LAW IS STRUCTURAL, NOT ARITHMETIC
 *
 * Every rung is **below its own buy rung** — 5 < 15, 10 < 25, 15 < 35, 20 < 45 — so buying a card
 * and selling it back is a strict loss at every energy cost, and no sequence of trades mints scrap.
 * Ticket 13's old `Math.min(sell, buy - 1)` clamp existed to guarantee that for any multiplier
 * someone might type; a ruled table of four literals makes the clamp unnecessary and the law
 * checkable by reading two arrays side by side. `marketplace.test.ts` reads them that way.
 *
 * A third of the buy price, on the same 5-scrap grid the whole economy sits on.
 */
export const SELL_PRICE_BY_ENERGY: ReadonlyArray<number> = [5, 10, 15, 20];

/** What the market pays for one card. Above `MAX_PRICED_ENERGY` sells as the top rung, as it buys. */
export function sellPrice(dataId: string): number {
    const data = ProgramRegistry[dataId];
    const energy = Math.min(numericBaseCost(data?.baseCost ?? 0), MAX_PRICED_ENERGY);
    return SELL_PRICE_BY_ENERGY[Math.max(0, energy)];
}

/*
 * PAID REMOVAL IS DELETED — Henry, 2026-08-26. `REMOVAL_PRICE` (20) and its whole derivation lived
 * here, and `WORKSHOP_REMOVAL_PRICE` re-exported it so one sink had one price at two counters.
 *
 * It has no job left. A card leaves the active deck for the run collection **for free** at any of
 * the four edit surfaces, so a 20-scrap button that did the same thing more slowly is a trap for a
 * player who has not yet found the editor. Selling replaces it in the other direction: the card you
 * will never play turns into scrap (`SELL_PRICE_BY_ENERGY`) instead of costing you scrap to be rid
 * of. See that constant for why the ticket-56 sell ban was repealed in the same pass.
 *
 * The derivation this block used to carry — "stripping all generics over a run costs roughly one
 * market visit" — is gone with it rather than re-banded, and deliberately: it measured a round trip
 * (filler multiplies with the party, player buys it back out) that the run collection and the
 * starter-only generics between them deleted at the source.
 */

/**
 * A REROLL COSTS 10 SCRAP — and this is **the one number in the shop ticket 56 did not rule**, so
 * the arithmetic is here in full and it is the first thing to argue with.
 *
 * Ticket 13 priced it at 20 with a stated law: *"priced BELOW the cheapest card, because a reroll
 * buys nothing but a new set of choices, so it must never be the most expensive thing on the
 * screen — and close to it, so it is never free variance."* Under ticket 56's table the cheapest
 * card is **15**, which makes the old 20 break its own rule: rerolling would cost more than buying.
 *
 * Ticket 57's instruction is *"rescale, do not re-derive"*, so the ratio is what carries across:
 * 20/24 of the cheapest card is 0.83, and 0.83 x 15 = 12.5, which lands on **10** once the
 * deck-archetypes "numbers move in 5s" rule (`map` § Notes) rounds it. 10 is two thirds of the
 * cheapest card and half of a removal — cheap enough to be a real option at a poor visit, dear
 * enough that reroll-until-happy costs a card.
 *
 * **FLAGGED:** derived, not ruled. If it is wrong it is wrong by 5.
 */
export const REROLL_PRICE = 10;

// =================================================================================================
// Prices
// =================================================================================================

/**
 * What a card costs to buy. **Reads `baseCost` and nothing else** — not `rarity` since ticket 56,
 * and never an action's `power`; see the header on why.
 *
 * An unknown id prices at the **cheapest rung** rather than throwing: a price is asked for by a
 * render, and a screen that crashes on a stale dataId is worse than one that shows a plausible
 * number. The cheap end is the deliberate direction to be wrong in — a phantom row the player can
 * afford is a smaller lie than one they save up for. `'X'` costs resolve through `numericBaseCost`
 * (the shared 3-energy static budget, ticket 22) rather than being special-cased, so an X card is
 * priced as the expensive card it plays as.
 */
export function cardPrice(dataId: string): number {
    const data = ProgramRegistry[dataId];
    // An unknown id prices as the cheapest rung rather than throwing: a price is asked for by a
    // render, and a shop row that crashes is worse than one that is wrong by 30 scrap.
    if (!data) return CARD_PRICE_BY_ENERGY[0];
    const energy = Math.min(Math.max(numericBaseCost(data.baseCost), 0), MAX_PRICED_ENERGY);
    return CARD_PRICE_BY_ENERGY[energy];
}

// =================================================================================================
// Macro prices — ticket 15
// =================================================================================================

/**
 * MACRO PRICES: **32 standard, 48 rare — and since ticket 57 they are LITERALS, not a derivation.**
 *
 * `macros-and-drivers.md`, RULED: *"Pricing RULED: full 1e-card value, rares 1.5x."* Ticket 13 obeyed
 * that by *computing* it — `CARD_PRICE_BY_RARITY.Common + ENERGY_PRICE_STEP x 1` = 32 — so that a
 * tuning pass on the card table moved the macros with it. That was the right shape at the time and
 * it cannot survive ticket 56, which made a 1-energy card cost **25**.
 *
 * Henry ruled the collision explicitly in 56's reconciliation: *"Macro prices keep the older 'full
 * 1e-card value' ruling — commons 32, rares 48 — superseding this ticket's 25/40."* So the two
 * rulings genuinely disagree about what a 1-energy card is worth, and the macro numbers are the ones
 * that stand. A derivation would now silently produce 25/37 and quietly overturn the ruling that
 * won, which is exactly the failure a derived constant is supposed to prevent.
 *
 * They are therefore written down, with this note, and the link to the card table is **cut on
 * purpose**. Moving them is editing these two numbers.
 *
 * The resulting shape, stated truly against the four rungs: a standard macro costs **more than any
 * card up to the 1-energy rung** (32 against 15 and 25) and **less than either dear rung** (35 at
 * 2 energy, 45 at 3). It is the **rare macro alone, at 48, that outprices every card on the shelf.**
 * So a standard macro is a considered purchase rather than something bought with spare change —
 * nearly half of a 70-scrap visit — without being the dearest thing at the stall; and a rare is over
 * two thirds of a visit, which is the "most of a visit" the ruling was reaching for.
 */
export const MACRO_PRICE_STANDARD = 32;

/** **RULED** — a rare macro costs one and a half times a standard one. `macros-and-drivers.md`. */
export const MACRO_PRICE_RARE = 48;

/**
 * What a macro costs. Keyed on the macro's rarity tier and nothing else — there is no `power` here
 * for the same reason there is none in `cardPrice` (see the module header), and no per-macro price
 * table, because a table is a place for twelve numbers to drift out of the one ruling that governs
 * them.
 *
 * An unknown id prices as a standard macro rather than throwing: a price is asked for by a render.
 */
export function macroPrice(macroId: string): number {
    const macro = MacroRegistry[macroId];
    return macro?.rarity === 'Rare' ? MACRO_PRICE_RARE : MACRO_PRICE_STANDARD;
}



// =================================================================================================
// The stock
// =================================================================================================

/** Which node kinds this module serves. One per biome, by ticket 07. */
export function isMarketNode(kind: NodeKind): boolean {
    return kind === 'marketplace';
}

/** One thing on sale. */
export interface IMarketOffer {
    /**
     * The card as it will enter the deck if bought — **minted here, not at purchase time**.
     *
     * That is what makes "sold out" survive an app close without `IRunState` growing a field (ticket
     * 06's shape is ratified and ticket 13 must not change it): the offer's `instanceId` is a pure
     * function of the run seed, the node and the visit count, so an offer is sold exactly when the
     * run deck already contains that instance id. `isOfferSold` is that one-liner, and the buy
     * reducer refuses a duplicate instance id for the same reason — two cards sharing an instance id
     * would both vanish on the first `removeRunCard`.
     */
    readonly card: IRunCard;
    /** `cardPrice(card.dataId)`, carried so a render never re-derives a price the reducer checks. */
    readonly price: number;
    /**
     * True for the off-pool slot. Surfaced to the screen because the point of the slot is that the
     * player can *see* something arrive from outside their party's lists.
     */
    readonly wildcard: boolean;
}

export interface IMarketStock {
    readonly offers: ReadonlyArray<IMarketOffer>;
    /** `nodeSeed(run, node, 'market')` — handed back so a test can prove what the roll depended on. */
    readonly seed: string;
    /** The visit this stock belongs to. Two visits are two stocks; see the module header. */
    readonly visit: number;
}

export interface MarketStockInput {
    readonly run: IRunState;
    /** The market node, **already visit-incremented** — see `nodeSeed`. */
    readonly node: IRegionNode;
    /** The party as it is right now. Same rule as the reward pick (`rewardCardPool`). */
    readonly party: ReadonlyArray<IRewardPartyMember>;
    /** The fallback element for a party that contributes no cards at all. See `rewardCardPool`. */
    readonly fallbackElement?: Element;
}

/**
 * Draw `count` distinct ids from `source`, uniformly, without replacement.
 *
 * **Uniform, and NOT rarity-weighted, unlike the reward pick.** `rollDropTable` weights its rolls
 * 50/30/15/5 because a reward is a gift and the weighting is the only thing stopping every fight
 * from paying an Epic. The market's job is different: it is to let you buy the card you decided you
 * wanted, out of the lists your own party actually runs, so every offerable id in the pool is drawn
 * with the same probability whatever tier is printed on it. The brake here is the **purse** — six
 * offers against a visit that clears two of them (see `MARKET_STOCK_SIZE`) — and the *energy* rung
 * an expensive card sits on, not its scarcity.
 *
 * **FLAG FOR HENRY — since ticket 56 there is no rarity gate in this market at all, at either end.**
 * Ticket 13's version of this comment argued the draw could stay uniform *because* the price gated
 * rarity: "a Rare costs 2.5 Commons, so weighting the stock as well would tax rarity twice." Ticket
 * 56 removed the rarity term from the price, and that premise went with it — a Rare and a Common
 * printed at the same energy now cost **exactly the same** and are **equally likely to be stocked**.
 * That is a real consequence of the ruling rather than a decision taken here, and it is left as the
 * ruling leaves it. If a Rare is meant to feel rare at a stall, the gate has to be put back
 * somewhere on purpose — a weighted draw in this function, a scarcity cap on the stock, or a rarity
 * term returning to `cardPrice` — and which of those is Henry's call, not ticket 57's.
 */
function drawDistinct(source: ReadonlyArray<string>, count: number, stream: SeedStream): string[] {
    const remaining = [...source];
    const picked: string[] = [];
    // Stops on an exhausted source rather than padding. A pool smaller than the stock is a real
    // state (a solo party runs an 8-11 card list) and a short stock is the honest answer to it — the
    // reward pick pads because a "pick 1 of 3" with two options cannot be answered, whereas a
    // four-row shop is simply a four-row shop.
    while (picked.length < count && remaining.length > 0) {
        picked.push(...remaining.splice(stream.nextInt(0, remaining.length - 1), 1));
    }
    return picked;
}

/**
 * Roll a market's stock. Pure, and deterministic in (`run.seed`, `node.id`, `node.visited`) plus the
 * party's pool.
 *
 * **The two streams are forked apart on purpose**, the same discipline `rollEncounter` uses: the
 * pool cards are drawn from one stream and the wild-cards from another, so that changing
 * `MARKET_WILDCARD_SLOTS` cannot shift which pool cards appear. Without the split, adding a second
 * wild-card slot would silently rewrite every stock in every existing run.
 *
 * Instance ids come from a third fork, so that a future change to *how many* things are on sale
 * cannot change the identity of the cards already in a resumed run's stock.
 */
export function rollMarketStock(input: MarketStockInput): IMarketStock {
    const { run, node, party, fallbackElement = 'None' } = input;

    const seed = nodeSeed(run, node, 'market');
    const poolStream = new SeedStream(new SeedStream(seed).fork('market-pool'));
    const wildStream = new SeedStream(new SeedStream(seed).fork('market-wildcard'));
    const idStream = new SeedStream(new SeedStream(seed).fork('market-card-ids'));

    // **The same pool rule as rewards, by ticket 13's own words.** Not a copy of the rule — the
    // function itself, so that when Henry rules on `economy-session.md`'s last open economy item the
    // shop and the drops move together instead of one of them being forgotten.
    const pool = rewardCardPool(party, fallbackElement);

    // Everything real that the party pool does NOT contain. This is the wild-card's source and the
    // reason it is "off-pool" in more than name: it is the set complement, computed against the same
    // rewardability rule the pool uses, so a wild-card can never be a card the party could have been
    // offered anyway.
    const offPool = Object.keys(ProgramRegistry).filter((id) => isRewardable(id) && !pool.includes(id));

    const drawn: Array<{ dataId: string; wildcard: boolean }> = [
        ...drawDistinct(pool, MARKET_STOCK_SIZE, poolStream).map((dataId) => ({ dataId, wildcard: false })),
        ...drawDistinct(offPool, MARKET_WILDCARD_SLOTS, wildStream).map((dataId) => ({ dataId, wildcard: true })),
    ];

    const offers: IMarketOffer[] = drawn.map(({ dataId, wildcard }) => ({
        card: {
            instanceId: idStream.nextId('bought'),
            dataId,
            // `ownerId: null` — "bought, drafted, or granted by an event" (`runTypes.IRunCard`). A
            // purchased card belongs to the shared deck and to no member, which is also what keeps
            // `RunScreen`'s per-member card counts honest.
            ownerId: null,
        },
        price: cardPrice(dataId),
        wildcard,
    }));

    return { offers, seed, visit: node.visited };
}

// =================================================================================================
// The macro stock — ticket 15
// =================================================================================================

/**
 * **PROPOSAL — two macros on offer per visit.**
 *
 * Ticket 13 left a marked slot for this and named the rule: macros are bought here. Two is set
 * against the rack, not against the wallet: the rack is **three slots** (`MACRO_SLOTS`) and a run
 * sees three markets, so two per stall means the player can fill the rack in a run without any one
 * stall handing them the whole thing. One per stall would make the rack a function of how many
 * markets you happened to route through; four would let the first market fill it and make the other
 * two stalls' macro rows dead rows.
 *
 * What the wallet says about that, re-derived against ticket 56's income: at 32–48 scrap a pair is
 * **64–96 against a 70-scrap visit** (see `MARKET_VISITS_PER_RUN`) — **the whole trip, or more than
 * it.** So two on the shelf is emphatically not "roughly one card's worth of the budget", as this
 * comment claimed at the old 150-scrap anchor; a single standard macro is already about half a visit
 * and the pair is all of it. The trade the row presents is therefore **a macro instead of the cards,
 * not as well as them**, and the rack fills at roughly one macro per stall across the run's three
 * markets. That is a sharper version of the reason for two rather than an argument against it: two
 * is what makes the row a *choice between macros* while the purse keeps it from being a sweep.
 */
export const MACRO_STOCK_SIZE = 2;

/** One macro on sale. */
export interface IMacroOffer {
    readonly macroId: string;
    /** `macroPrice(macroId)`, carried so a render never re-derives a price the reducer checks. */
    readonly price: number;
}

/**
 * Roll a market's macro stock. Pure, and deterministic in (`run.seed`, `node.id`, `node.visited`).
 *
 * **Its own fork, `market-macros`.** Same discipline as the pool/wildcard/id split above: adding or
 * removing macro slots must not shift which CARDS a stall offers, and vice versa. Without the split,
 * shipping this ticket would silently re-roll every card stock in every saved run.
 *
 * **There is no "sold out" here, and that is not an omission.** A card offer is an `IRunCard` with a
 * minted instance id, so "already bought" is derivable from the deck; a macro is a bare id in a
 * three-slot tuple, and two Surges in two slots is a legal and sensible rack. So macros are
 * *fungible* — the brake on buying them is the rack's three slots and the price, not the stall. The
 * map-reveal is excluded from the roll for a different reason: it is not a battle consumable and
 * ticket 07's amendment ties it to events and items rather than to the shop shelf... except that the
 * amendment prices it "like the others", so it IS shelved. It is in.
 */
export function rollMacroStock(input: MarketStockInput): ReadonlyArray<IMacroOffer> {
    const { run, node } = input;
    const seed = nodeSeed(run, node, 'market');
    const macroStream = new SeedStream(new SeedStream(seed).fork('market-macros'));

    return drawDistinct([...MACRO_IDS], MACRO_STOCK_SIZE, macroStream)
        .map((macroId) => ({ macroId, price: macroPrice(macroId) }));
}

/**
 * Has this offer already been bought? True exactly when its minted instance id is still **owned** —
 * in the active deck or in the run collection, either one.
 *
 * Derived rather than stored, which is what lets a sold-out slot survive a resume without a new
 * field in the ratified run shape.
 *
 * # WHY BOTH PILES, AS OF TICKET 61
 *
 * This took the deck alone, which was exact while the deck was the only place a card could be. It
 * is not any more: a bought card lands in the deck (ticket 63, ruled) and the free editor can move
 * it to the collection a second later. Asked about the deck alone, the stall would then call the
 * offer unsold and **sell the same instance twice** — a card duplicated out of nothing, and a real
 * cards-for-scrap farm rather than the drain described below.
 *
 * A sold row un-sells only if that instance leaves the run entirely, which means selling it
 * (`sellPrice`, always under the buy rung) and buying the row again: a sale a lap. That is a drain,
 * not a farm — every lap is scrap leaving the run and none entering, which is the no-farm law
 * holding structurally rather than by a clamp.
 */
export function isOfferSold(owned: ReadonlyArray<IRunCard>, offer: IMarketOffer): boolean {
    return owned.some((card) => card.instanceId === offer.card.instanceId);
}
