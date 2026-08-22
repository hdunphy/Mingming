/**
 * THE MARKETPLACE — ticket 13 (steam-release map). The first scrap SINK in the game.
 *
 * # WHAT A MARKET IS FOR
 *
 * Ticket 12 gave a run an income (`SCRAP_PER_ENEMY`) and nothing to spend it on. This module is the
 * other half: **buy a card, sell a card, pay to remove a card**, three verbs over one run-scoped
 * currency. `economy-session.md` calls removal *the designer-added sink* — the one price in the
 * game whose job is to consume scrap rather than to trade it — and Henry's amendment of 2026-08-21
 * says what it is a sink *for*:
 *
 * > the generic None-element filler (3 in the start deck, 1 per recruit) **is what removal is for**
 * > — price removal so stripping all generics over a run costs roughly one market visit's scrap.
 * > Revisiting a market is allowed (node re-entry), so **stock re-rolls per visit** and **prices
 * > must not be farmable to zero**.
 *
 * Both halves of that amendment are implemented as laws with tests behind them, not as intentions:
 * the stock is a pure function of (run seed, node id, visit count) via `nodeSeed`, and `sellPrice`
 * is derived from `cardPrice` so that **sell < buy** cannot be broken by retuning one table.
 *
 * # POWER DIES AT THE SURFACE
 *
 * A standing law (map § Notes): *"true numbers in UI; `power` is internal pricing only."* `power` is
 * a balance instrument — `debug/balance/powerscale.ts` scores cards with it — and a shop price
 * derived from it would publish that instrument as a player-facing quantity, one arithmetic step
 * from being reverse-engineered. So **prices are keyed on rarity and energy cost ONLY**: two things
 * already printed on the card. Nothing in this file reads an action's `power`, and
 * `marketplace.test.ts` proves it behaviourally — every card sharing a (rarity, cost) pair must
 * price identically, however hard they differ underneath.
 *
 * # EVERY NUMBER BELOW IS A PROPOSAL AWAITING HENRY
 *
 * Ticket 13: *"Pricing: propose a table... Henry picks numbers. Stock size, reroll cost and removal
 * price are Henry numbers too."* They are gathered in one block under THE MARKETPLACE KNOB so that
 * ratifying them is editing one screenful, in the style of ticket 12's `SCRAP_PER_ENEMY`.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random()`, no
 * `Date.now()`.
 */

import { SeedStream } from '../core/SeedStream';
import { MACRO_IDS, MacroRegistry } from '../data/macroRegistry';
import { ProgramRegistry } from '../data/programRegistry';
import { isRewardable, rewardCardPool, type IRewardPartyMember } from '../RewardSystem';
import { numericBaseCost } from '../types';
import type { Element, Rarity } from '../types';
import type { IRegionNode, IRunCard, IRunState, NodeKind } from '../runTypes';
import { nodeSeed } from './nodeSeed';

// =================================================================================================
// THE MARKETPLACE KNOB — every number here is a PROPOSAL awaiting Henry's ratification
// =================================================================================================

/**
 * ## The anchor everything below is quoted against
 *
 * Ticket 12 measured the run: **a full 8-10 fight run with a three-member party lands around
 * 450-500 scrap** before anything is earned by selling. Ticket 07 puts **exactly one marketplace per
 * biome** and a run is three biomes, so a run sees **three markets** (more if the player backtracks,
 * which costs re-fought wilds and therefore pays for itself).
 *
 * **A market visit's scrap ≈ 450 / 3 = 150.** The upper anchor gives 500 / 3 ≈ 167; 150 is used
 * throughout as the conservative figure, because pricing to the optimistic end of a band is how a
 * shop ends up unaffordable for everyone who is not already winning. This one number is the divisor
 * behind the removal price, the stock size and the reroll cost, and if Henry moves the income bands
 * in `SCRAP_PER_ENEMY` it is the only thing that has to be recomputed here.
 *
 * Note what the anchor is NOT: it is not what the player is holding when they walk into market one.
 * Income accumulates across the run, so the first market is poorer than 150 and the third is richer.
 * That skew is the intended shape — the first market is a choice between one card and one removal,
 * the third is a shopping trip — and it is why nothing below is priced so that the *first* visit can
 * clear the stock.
 */
export const MARKET_VISITS_PER_RUN = 3;

/**
 * **PROPOSAL — stock size: 5 cards from the party pool.**
 *
 * Derivation: a visit brings ~150 scrap and the median offer prices at 32-48 (see
 * `CARD_PRICE_BY_RARITY`), so a visit buys **three cards at most** and fewer if the player also
 * removes anything. A stock of 5 pool cards + 1 wild-card is therefore a stock the player can never
 * buy out — which is what makes it a *choice* rather than a queue — while still being small enough
 * to read at a glance on the Steam Deck's 1280x800 (ticket 37) without scrolling past the deck list
 * underneath it.
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
 * **PROPOSAL — buy price = a rarity base plus 8 per point of energy.**
 *
 * Keyed on **rarity and energy cost only** — see the header on why `power` cannot appear here. Both
 * inputs are printed on the card, so the price is legible before it is paid: a player can look at a
 * card they have never seen and know roughly what it will cost.
 *
 * | rarity | base | typical printed cost | price |
 * |---|---|---|---|
 * | Common | 24 | 0-1 | **24-32** |
 * | Uncommon | 40 | 1-2 | **48-56** |
 * | Rare | 64 | 2-3 | **80-88** |
 * | Epic | 96 | 2-3 | **112-120** |
 *
 * The reasoning, in the order the numbers were chosen:
 *
 * - **The Common floor (24) is set against the removal price (30).** Removal has to cost *more* than
 *   the cheapest card or the sink is free, and it has to cost *less* than a good card or nobody ever
 *   sharpens their deck. 24 / 30 / 48 puts removal exactly between "the cheapest thing here" and
 *   "the thing you came for".
 * - **The rarity curve is ~1.6x per step**, not the 2x of `SCRAP_YIELDS`. Rarity in this registry is
 *   a statement about how *specialised* a card is, not how strong (ticket 21 froze power scaling),
 *   so a Rare should be a considered purchase rather than a whole visit's income. At 1.6x a Rare is
 *   ~2.5 Commons; at 2x it would be 4, and the market would sell nothing but Commons at biome 1.
 * - **8 per energy point** is a third of a rarity step. Energy cost correlates with effect size but
 *   is not a quality ranking — a 0-cost Common is often the card a deck actually wants — so cost
 *   nudges the price rather than driving it. It exists mostly so that two Commons are not the same
 *   price when one of them is free to play.
 * - **Epic is priced although the registry ships none** (216 cards: Common/Uncommon/Rare/Token
 *   only). The record is total for the same reason ticket 12's tables list the non-fight node kinds
 *   at zero: a missing key returns `undefined`, and `undefined` arithmetic prices a card at `NaN`.
 */
export const CARD_PRICE_BY_RARITY: Readonly<Record<Rarity, number>> = {
    Common: 24,
    Uncommon: 40,
    Rare: 64,
    Epic: 96,
};

/** **PROPOSAL** — added per point of printed energy cost. See `CARD_PRICE_BY_RARITY`. */
export const ENERGY_PRICE_STEP = 8;

/**
 * **PROPOSAL — a card sells for 40% of what it costs, rounded down.**
 *
 * A multiplier and not a second table, because the law selling must obey is comparative:
 * **`sellPrice(x) < cardPrice(x)` for every card in the registry, or the market is an infinite scrap
 * loop.** That is Henry's *"prices must not be farmable to zero"* clause, and under a multiplier
 * below 1 it is arithmetic rather than vigilance. Two independently-tuned tables would satisfy it on
 * the day they were written and stop satisfying it the first time either half was retuned — which is
 * precisely what would have happened with `RewardSystem.getScrapYield`'s flat `Rare: 50`.
 *
 * **Why 40% and not 50% or 25%:**
 *
 * - A 60% haircut makes buy→sell round-tripping visibly stupid: churning the whole stock burns
 *   ~90 scrap for nothing, which is three removals.
 * - It still pays enough to be worth the click on the cards a run genuinely wants gone. The generic
 *   filler sells for 9, so **dumping all five generics returns 45 — about a third of what removing
 *   them costs.** Selling is the cheap, slow way to thin a deck and removal is the fast, expensive
 *   one, which is the trade the sink is supposed to present.
 * - At 50% a Rare bought at 80 returns 40, and a player who mis-clicks loses only 40 — cheap enough
 *   that buying becomes low-stakes. At 25% selling is not worth reading the list for.
 */
export const SELL_MULTIPLIER = 0.4;

/**
 * **PROPOSAL — removal costs 30 scrap. THIS IS THE NUMBER WITH A STATED TARGET, so here is the
 * arithmetic in full.**
 *
 * Henry's amendment: *"price removal so stripping all generics over a run costs roughly one market
 * visit's scrap."*
 *
 * 1. **One market visit's scrap** = a run's income / markets per run = **450 / 3 = 150** (see
 *    `MARKET_VISITS_PER_RUN`; the 500 anchor gives 167).
 * 2. **Generics in a run.** `createRun`'s ruled start deck is 5 kit + `START_GENERICS` = **3
 *    generics**, and `recruitDeckFor` adds `RECRUIT_GENERICS` = **1 per recruit**. A run that grows
 *    1 → 2 → 3 members through workshop nodes (`vision.md`) therefore carries **3 + 1 + 1 = 5**
 *    generics by the end. (A party that starts at three carries nine, because `startDeckFor` runs
 *    per member — but that is the debug/launch-screen shape, not the ruled progression, and pricing
 *    to it would make removal free for the ordinary run.)
 * 3. **The price**: 150 / 5 = **30 scrap per removal.**
 *
 * Check both ends of the anchor: 5 × 30 = 150, which is 100% of a 450-scrap run's per-visit share
 * and 90% of a 500-scrap run's. "Roughly one market visit's scrap" holds at both.
 *
 * Two consequences worth reading before ratifying:
 *
 * - **You cannot strip them all at one market.** The first visit is poorer than 150, so the five
 *   removals spread across the three markets — one or two per visit, always competing with a card
 *   you also want. That is the sink working: it is a *run-long* commitment costing a visit's income,
 *   not a button you press once.
 * - **It is a flat price, not a rarity-keyed one.** Removal is a deck-size operation and the deck
 *   does not care what it is thinning; a rarity-keyed removal would also make removing your worst
 *   card cost the least, which pays the player for having drafted badly.
 */
export const REMOVAL_PRICE = 30;

/**
 * **PROPOSAL — a reroll costs 20 scrap, flat.**
 *
 * Priced *below* the cheapest card (24) on purpose: a reroll buys nothing but a new set of choices,
 * so it must never be the most expensive thing on the screen. Priced close to it for the opposite
 * reason — at 5 scrap the correct play would be to reroll until the stock is perfect, which is a
 * slot machine, and the market would stop being a choice under scarcity.
 *
 * **Self-limiting rather than escalating.** A 150-scrap visit affords 7 rerolls *and nothing else*,
 * so the greedy line pays for itself in cards not bought; an escalating within-visit price would be
 * the other way to stop it, and it needs a counter that `IRunState` has no field for (ticket 06's
 * shape, which this ticket must not change). Flagged for Henry: if playtesting shows reroll-spam, the
 * cheapest fix is raising this number, not adding state.
 *
 * **A reroll is implemented as a paid re-entry** — it increments the node's `visited` count, which is
 * exactly what walking away and walking back would do (ticket 07). So it cannot be farmed to zero:
 * it only ever spends scrap, and it buys the same thing the player could already have had for the
 * price of re-fighting the wilds in between.
 */
export const REROLL_PRICE = 20;

// =================================================================================================
// Prices
// =================================================================================================

/**
 * What a card costs to buy. **Reads `rarity` and `baseCost` and nothing else** — see the header on
 * why `power` may not appear in this function.
 *
 * An unknown id prices as a Common rather than throwing: a price is asked for by a render, and a
 * screen that crashes on a stale dataId is worse than one that shows a plausible number. `'X'` costs
 * resolve through `numericBaseCost` (the shared 3-energy static budget, ticket 22) rather than being
 * special-cased, so an X card is priced as the expensive card it plays as.
 */
export function cardPrice(dataId: string): number {
    const data = ProgramRegistry[dataId];
    if (!data) return CARD_PRICE_BY_RARITY.Common;
    // `Token` reaches this cast at runtime (the JSON has a rarity the `Rarity` union does not name)
    // and is priced as Common. Tokens are never *offered* — `isRewardable` excludes them from both
    // pools — so this is the degenerate branch, kept total rather than left to produce `NaN`.
    const base = CARD_PRICE_BY_RARITY[data.rarity as Rarity] ?? CARD_PRICE_BY_RARITY.Common;
    return base + ENERGY_PRICE_STEP * numericBaseCost(data.baseCost);
}

// =================================================================================================
// Macro prices — ticket 15
// =================================================================================================

/**
 * **The reference card a macro is priced as: a ONE-ENERGY COMMON.**
 *
 * `macros-and-drivers.md`, RULED: *"Pricing RULED: full 1e-card value, rares 1.5x. Marketplace price
 * follows ticket 13's table."* Both halves are obeyed literally: the base is what
 * `cardPrice` charges for a Common card printed at 1 Energy — `CARD_PRICE_BY_RARITY.Common +
 * ENERGY_PRICE_STEP × 1` = **32** — and it is *derived* from that table rather than copied out of
 * it, so a Henry tuning pass on the rarity base or the energy step moves the macros with the cards.
 *
 * **The reading that was rejected, and why.** One could read "full 1e-card value" as "the 1-Energy
 * price of a card of the MACRO's own rarity", which would put a rare macro at
 * `CARD_PRICE_BY_RARITY.Rare + 8 = 72` and then multiply *that* by 1.5. But the ruling states two
 * things, not one: a value, and a multiplier for rares. Under the rejected reading the multiplier is
 * redundant with the rarity base and rares get charged for their rarity twice (108 scrap — nearly a
 * whole market visit for one consumable). The two-tier reading is the one in which every clause of
 * the sentence does work: **32 for a standard macro, 48 for a rare.**
 *
 * The resulting shape is the intended one. A standard macro costs the same as an ordinary card, so
 * "a card or a macro" is a real choice at every stall; a rare macro costs 1.5 cards, so Revive is a
 * considered purchase and never a reflex.
 */
export const MACRO_REFERENCE_ENERGY = 1;

/** **RULED** — a rare macro costs one and a half times a standard one. `macros-and-drivers.md`. */
export const MACRO_RARE_MULTIPLIER = 1.5;

/**
 * What a macro costs. Keyed on the macro's rarity tier and nothing else — there is no `power` here
 * for the same reason there is none in `cardPrice` (see the module header), and no per-macro price
 * table, because a table is a place for twelve numbers to drift out of the one ruling that governs
 * them.
 *
 * An unknown id prices as a standard macro rather than throwing: a price is asked for by a render.
 */
export function macroPrice(macroId: string): number {
    const base = CARD_PRICE_BY_RARITY.Common + ENERGY_PRICE_STEP * MACRO_REFERENCE_ENERGY;
    const macro = MacroRegistry[macroId];
    return macro?.rarity === 'Rare' ? Math.floor(base * MACRO_RARE_MULTIPLIER) : base;
}

/**
 * What a card sells for. **Strictly less than `cardPrice` for every card, by construction.**
 *
 * The `Math.min(..., buy - 1)` is not decoration: `SELL_MULTIPLIER` is a knob Henry may move, and a
 * multiplier of 1 (or a future price of 1 scrap, where `floor(1 * 0.4)` is 0 and a "minimum 1" floor
 * would tie) would turn the market into a scrap fountain. Clamping below the buy price makes the
 * no-farm law hold for any multiplier anyone can type, which is the only version of the law that
 * survives a tuning pass.
 */
export function sellPrice(dataId: string): number {
    const buy = cardPrice(dataId);
    return Math.max(0, Math.min(Math.floor(buy * SELL_MULTIPLIER), buy - 1));
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
 * from paying an Epic. A shop already has that brake and it is called the price: a Rare costs 2.5
 * Commons (`CARD_PRICE_BY_RARITY`), so weighting the stock *as well* would tax rarity twice — the
 * player would rarely be offered the expensive card and could rarely afford it when they were. The
 * market's job is to let you buy the card you decided you wanted; the rarity gate belongs in the
 * price, where the player can see it and save up for it.
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
 * At 32–48 scrap against a ~150-scrap visit (see `MARKET_VISITS_PER_RUN`), two macros is also
 * roughly one card's worth of the budget — which is the trade the slot is supposed to present.
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
 * Has this offer already been bought? True exactly when its minted instance id is in the deck.
 *
 * Derived rather than stored, which is what lets a sold-out slot survive a resume without a new
 * field in the ratified run shape. Selling the card back un-sells the offer, and that is a loop that
 * loses 60% of the price every lap (`SELL_MULTIPLIER`) rather than a farm.
 */
export function isOfferSold(deck: ReadonlyArray<IRunCard>, offer: IMarketOffer): boolean {
    return deck.some((card) => card.instanceId === offer.card.instanceId);
}
