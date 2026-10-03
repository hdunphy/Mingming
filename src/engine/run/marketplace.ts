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
import { LAUNCH_SPECIES } from '../data/mingmingRegistry';
import { ProgramRegistry } from '../data/programRegistry';
import { NEUTRAL_UTILITY_IDS } from '../data/speciesPools';
import { resolveProgramId } from '../data/programAliases';
import { hasUpgrade, upgradeIdFor } from '../data/plusRegistry';
import { isRewardable, rewardCardPool, type IRewardPartyMember, usesV2Pool, inV2RunPool } from '../RewardSystem';
import { numericBaseCost } from '../types';
import type { Element } from '../types';
import type { IRegionNode, IRunCard, IRunState, NodeKind } from '../runTypes';
import { shopPrice } from './modifiers/shopPrice';

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
 * **RULED by Henry, 2026-08-28: the stall stocks SEVEN, and the seventh is a second off-pool slot.**
 *
 * Ticket 69 narrowed the one off-pool slot from a 207-card complement to a four-card neutral list,
 * because a 1.4%-per-run draw is not a hedge. That bought reachability and cost the slot its OTHER
 * job — the anti-monotony one written up above, *"three guaranteed strangers across a run"*, which
 * matters most to exactly the player it was written for: a solo party's pool is five cards.
 *
 * Henry's answer keeps both rather than trading one for the other. **Two off-pool slots, doing two
 * different jobs:**
 *
 * - `MARKET_NEUTRAL_SLOTS` draws from `MARKET_NEUTRAL_UTILITY` — the reliable route to a neutral
 *   answer (`hamstring` and friends), which no species pool can ever offer.
 * - `MARKET_WILDCARD_SLOTS` draws from everything else off-pool — the stranger, restored.
 *
 * Both are flagged `wildcard` on the offer and both wear the same `off-pool` tag, because from the
 * player's side they are one idea: *this is not one of your team's cards*. The split is a stocking
 * rule, not a thing the stall explains.
 */
export const MARKET_NEUTRAL_SLOTS = 1;

/** What a visit puts on the shelf, all told. 5 + 1 + 1 = 7. */
export const MARKET_TOTAL_SLOTS = MARKET_STOCK_SIZE + MARKET_NEUTRAL_SLOTS + MARKET_WILDCARD_SLOTS;

/**
 * WHAT THE NEUTRAL SLOT RESERVES — **ticket 69**, off ticket 67's round-4 ruling 3.
 *
 * # THE PROBLEM THIS FIXES IS A PROBABILITY, NOT A MISSING RULE
 *
 * The one off-pool slot always had a source: everything `isRewardable` the party's pool did not
 * contain. For a solo party that complement was **207 cards**, so any *particular* card was a 0.48%
 * draw per visit and **1.4% across a whole run's three markets**. Reachable on paper, unreachable in
 * play.
 *
 * That mattered the moment a specific card became an answer to a specific fight. Research/68 §6:
 * WAR FOOTING is cancelled by Weakened, every launch Weakened source is Nature, and the
 * type-recommended Water counter-team therefore cannot answer the Emberfall Driver. Henry ruled the
 * texture INTENDED — *race it with Water, or answer it with Nature and pay the Fire tax* — with one
 * hedge: **the mechanical answer must be PURCHASABLE by any party, without changing any species
 * pool.** `hamstring` is that answer (None-element, 1e, 20 power, 2 Weakened) and it sits in no
 * playable deck, so the pool rule can never offer it and the 1.4% slot may as well not exist.
 *
 * # THE LIST IS DERIVED, NOT TASTED
 *
 * Every entry satisfies three mechanical conditions, asserted in `marketplace.test.ts`:
 *
 * 1. **`element: 'None'`** — it is *neutral utility*, so it is equally at home in any deck. A
 *    neutral card gains no STAB anywhere, which is the same reason it is priced as it is.
 * 2. **In no LAUNCH species' deck** — the set an Early Access party's pool can never contain, which
 *    is exactly what the hedge is about. LAUNCH rather than PLAYABLE deliberately: all three of the
 *    non-daemon entries below DO appear in a post-launch species' list (hamstring in `hel_v1`,
 *    adrenaline in `sleipnir_v1`, squirrel_away in `fafnir_v2` / `hel_v2`). That is not a conflict —
 *    the draw below keeps its `!pool.includes` filter, so a future party fielding hel is simply not
 *    offered a card it already drafts. Requiring "no playable deck" would forbid three cards today
 *    for a reason that does not exist until those species ship.
 * 3. **Not the control species' calibration content** — see below.
 *
 * # THIS ALSO CLOSED A LIVE BUG: THE FLOOR DECK WAS ON SALE
 *
 * The old complement included `baseline_jab`, `baseline_scuff`, `baseline_strike`, `baseline_snare`,
 * `baseline_slam` and `baseline_purge`. Those six are the **control species'** deck — deliberately
 * *"the worst deck in the game"* (`mingmingRegistry`), the balance corpus's reference floor. `control`
 * is not in `PLAYABLE_SPECIES`, so its cards fell straight through the "not in the party's pool"
 * filter and onto the shelf: roughly a **3% chance per visit of being sold a calibration fixture**.
 * Nothing was watching for it because nothing had a reason to look at what the slot contained. The
 * exclusion now lives in `RewardSystem.isRewardable`, so it covers drops as well and cannot be
 * re-opened by widening a source — which the seventh slot promptly tried to do.
 *
 * # WHAT THIS SLOT IS *NOW*, AFTER HENRY'S ELEMENT RULING
 *
 * Ticket 69 narrowed the single off-pool slot to this list, which bought reachability and cost the
 * slot its anti-monotony job. Henry answered both on 2026-08-28: **a seventh stock slot** restores
 * the stranger (see `MARKET_NEUTRAL_SLOTS`), and **the main five now draw from the party's ELEMENTS**
 * rather than its deck lists.
 *
 * That second ruling changes what this list IS. `getPoolForElement` folds every `None` card into
 * every element's pool, so all four entries are now in every party's main pool already — a solo
 * party's pool went from 5 cards to 33, and these four are among them. **The slot stopped being a
 * way IN and became a RESERVATION**: the answer to a fight is never crowded out by a 33-card draw.
 * That is why the draw below filters on "not already taken" rather than on "not in the pool" — the
 * old filter would now match everything and silently leave the shelf at six.
 *
 * Ordered, not sorted, so the file reads as a curated list and a diff shows an addition as an
 * addition.
 */
/*
 * TICKET 162a moved the IDS to `data/speciesPools.ts` and left the reasoning above where it was
 * written. One list, because the v2 pool gate has to see the same ids this slot offers — a card
 * the shop guarantees and the pool excludes is the disagreement ticket 69 closed from the other
 * side. The notes on each entry are in that file.
 */
export const MARKET_NEUTRAL_UTILITY: ReadonlyArray<string> = NEUTRAL_UTILITY_IDS;

/**
 * THE RULED ANSWER SET PER GYM — ticket 69's standing law, as data rather than as prose.
 *
 * *"Every gym boss ships with at least THREE counter flavors reachable by any party."* Henry's
 * reason is on the ticket: *"otherwise you build the same deck every time and it feels bad if you
 * can't find the one card."*
 *
 * Exported because two separate things need to agree about it and had no shared source: the pin test
 * that guards reachability, and the run gate's `--toolbox` arm, which measures what a player who
 * FOUND these actually does against the boss. A second hand-written copy in the harness would drift
 * from the shop the moment a printing moved.
 *
 * `reactive_plating` answers two gyms on purpose (ruled): a Strengthened aura and a zoo of small
 * hits are the same problem seen from the defender's side.
 *
 * Every id here must also be in `MARKET_NEUTRAL_UTILITY` — an answer that is not stocked is not
 * reachable, which is the same outcome as never printing it. `marketplace.test.ts` asserts that.
 */
export const GYM_COUNTER_ANSWERS: Readonly<Record<string, ReadonlyArray<string>>> = {
    // WAR FOOTING — an escalating Strengthened aura.
    gym_emberfall: ['hamstring', 'discharge', 'reactive_plating'],
    // TIDAL SURGE — a draw-zoo that converts its own card flow into damage twice a turn.
    gym_tidewrack: ['riptide', 'short_circuit', 'reactive_plating'],
    // ROOT ROT — a poison clock.
    gym_rootfall: ['scrubber', 'vent', 'drip_feed'],
};

/**
 * SELECTIVE SHOPPING — at most TWO answers per gym, ruled by Henry on ticket 75 (2026-08-31).
 *
 * # WHY A SECOND, SMALLER TABLE
 *
 * `GYM_COUNTER_ANSWERS` is the buy-EVERYTHING basket, and research/75 measured what buying it costs:
 * **-11.5 points of win rate at every gym**, 540 paired battles, p = 0.0000017. Henry's ruling was
 * *"the toolbox STAYS SHIPPED. No reprice, no pull — diagnose first"*, because that number cannot
 * distinguish two very different failures: **the harness's shopping policy** (a player who buys all
 * three answers has spent three market visits and three deck slots on situational tech) from
 * **specific printings** being bad.
 *
 * This table is the first half of that diagnosis. It is the same gyms, the same ruled answers, cut
 * to the two a player would actually prioritise.
 *
 * # HOW THE TWO WERE PICKED, SO IT IS NOT A JUDGEMENT CALL
 *
 * Ruling 1a names them per gym — *"cleanse tech at Rootfall, riptide/short_circuit at Tidewrack,
 * plating/discharge/hamstring at Emberfall"* — and for Emberfall that names three, so a rule is
 * needed for the cut. The rule applied is **cheapest first**, which is the same order a player short
 * on energy would buy in and happens to agree with the ruling everywhere it is unambiguous:
 *
 *  - **Emberfall** keeps `hamstring` and `discharge` (1e each) and drops `reactive_plating` (2e).
 *  - **Tidewrack** keeps `riptide` and `short_circuit`, exactly as ruled; `reactive_plating` drops.
 *  - **Rootfall** keeps `vent` (0e) and `scrubber` (2e) — the two that actually REMOVE poison, which
 *    is what "cleanse tech" names. `drip_feed` grants Regen rather than cleansing, so it drops.
 *
 * Five of the seven answers are 2-energy Daemons, which is a conspicuous fact about the basket in a
 * 2-energy game. It is **not** asserted as the mechanism here — ruling 1 is explicit that nothing is
 * asserted before the per-card arms land, and this table is one of the arms, not its conclusion.
 */
export const GYM_SELECTIVE_ANSWERS: Readonly<Record<string, ReadonlyArray<string>>> = {
    gym_emberfall: ['hamstring', 'discharge'],
    gym_tidewrack: ['riptide', 'short_circuit'],
    gym_rootfall: ['vent', 'scrubber'],
};

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
    const data = ProgramRegistry[resolveProgramId(dataId)];
    const energy = Math.min(numericBaseCost(data?.baseCost ?? 0), MAX_PRICED_ENERGY);
    return SELL_PRICE_BY_ENERGY[Math.max(0, energy)];
}

/**
 * WHAT IT COSTS TO REMOVE A JUNK CARD — **25 scrap** (ticket 168c).
 *
 * Henry, on the events ticket: *"Yes junk cards. Also you have to pay to remove them instead of
 * selling them for scrap at the shop."* So Corrupted Data is the one card the market does not buy:
 * its row in the sell list reads "Remove — 25 scrap" and the scrap goes the other way. It is not a
 * revival of the deleted paid removal below (which charged to shrink a deck the player could shrink
 * for free); junk is a card the player did not choose, and clearing it is the price of the event
 * that gave it. It is never blocked by the deck floor, because junk does not count toward it.
 */
export const JUNK_REMOVAL_PRICE = 25;

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
 * A REFRESH COSTS 50 SCRAP — **RULED by Henry, ticket 142 §7 (2026-09-11)**, replacing the 10-scrap
 * card reroll that ticket 57 derived.
 *
 * *"You can pay scrap to refresh it."* And, on the number: *"we might need to go higher"* — so it
 * is a constant with this comment rather than a derivation, and the run walker reports scrap-at-gym
 * so it can be retuned against a real run.
 *
 * # WHY THE OLD DERIVATION DOES NOT SURVIVE THE RULING
 *
 * Ticket 13's law was *"priced BELOW the cheapest card, because a reroll buys nothing but a new set
 * of choices"*, and ticket 57 rescaled that to 10 (two thirds of the cheapest card). Both reasoned
 * about a shelf that **re-rolled for free on re-entry** — the paid reroll only bought you the
 * increment early, so it had to be cheap or nobody would ever pay for what walking out gave away.
 *
 * §7 deletes the free version. A refresh is now the ONLY way a shelf ever changes, which makes it a
 * different purchase: not "skip the walk" but "this stall has nothing for me, buy a new one". At 10
 * that is strictly better than saving for a card at almost any moment; at 50 it costs more than the
 * dearest card (45) and is a real alternative to one, which is the shape a last-resort button wants.
 *
 * **It refreshes the WHOLE stall** — cards, macros and the blueprint slot — because they now share
 * one seed (`marketStockSeed`) and a refresh that moved only the cards would leave two thirds of the
 * shelf as the thing you just paid to get away from.
 */
export const MARKET_REFRESH_PRICE = 50;

/**
 * @deprecated Ticket 142 §7 renamed this to `MARKET_REFRESH_PRICE` and repriced it 10 -> 50. Kept
 * as an alias for one release so a stale import fails loudly at review rather than silently
 * charging the old price.
 */
export const REROLL_PRICE = MARKET_REFRESH_PRICE;

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
    const data = ProgramRegistry[resolveProgramId(dataId)];
    // An unknown id prices as the cheapest rung rather than throwing: a price is asked for by a
    // render, and a shop row that crashes is worse than one that is wrong by 30 scrap.
    if (!data) return CARD_PRICE_BY_ENERGY[0];
    const energy = Math.min(Math.max(numericBaseCost(data.baseCost), 0), MAX_PRICED_ENERGY);
    return CARD_PRICE_BY_ENERGY[energy];
}

/**
 * TICKET 163b — **what an upgrade costs**, on Henry's band of 25–40 scrap (163 §2).
 *
 * By the card's ENERGY, exactly as `cardPrice` is, and for the reason that header gives: the cost
 * is the only property of a card this file is allowed to read, because a price that reads power or
 * rarity is a second balance opinion living in a shop. Four rungs across the ruled band:
 *
 *     0e 25   ·   1e 30   ·   2e 35   ·   3e 40
 *
 * IT IS FLATTER THAN BUYING, and that is the design rather than an accident of the band. Buying
 * spans 15–45 — three times — because a 3e card is three times the card a 0e one is. An UPGRADE is
 * roughly the same size of favour whatever it lands on: a rung of stacks, forty percent, one more
 * swing. The band Henry ruled is 25–40, which is 1.6x across the same four rungs, and that ratio is
 * the ruling's content.
 *
 * TUNE FROM THE RUN LOG, which 163b says out loud. `CARD_UPGRADED` records the price paid, so the
 * question *"is 30 scrap a real decision at fight four"* is answerable from a walker run rather
 * than from this comment. Until it is answered these are Henry's numbers and not a derivation.
 */
export const UPGRADE_PRICE_BY_ENERGY: ReadonlyArray<number> = [25, 30, 35, 40];

/** What upgrading this card costs. Unknown ids price at the cheapest rung, as `cardPrice` does. */
export function upgradePrice(dataId: string): number {
    const data = ProgramRegistry[resolveProgramId(dataId)];
    if (!data) return UPGRADE_PRICE_BY_ENERGY[0];
    const energy = Math.min(Math.max(numericBaseCost(data.baseCost), 0), UPGRADE_PRICE_BY_ENERGY.length - 1);
    return UPGRADE_PRICE_BY_ENERGY[energy];
}

/**
 * How many upgrades one visit to the market or the workshop may buy.
 *
 * Henry, 2026-09-30, ticket 174: two per visit at the market and the workshop (was one, 163 §2).
 * Late runs had scrap and upgradeable cards but nowhere to spend it. The gym gate's free upgrade
 * (once) and the Overclock Rig event bench (two, free) keep their own allowances and do not read
 * this.
 */
export const UPGRADES_PER_VISIT = 2;

/**
 * Ticket 176 (M7), Henry: *"maybe make it 2 / 3 / 4. I want the upgrades to be the scrap sink at the
 * end of the run and limit them in the beginning to make players focus on filling out their deck."*
 *
 * How many upgrades one TOWN visit may buy, by the town's biome. One pool for the whole Upgrades tab:
 * it replaces ticket 174's two at the market plus two at the workshop, now that they are one node.
 * Patches are bought in the Shop and do not count against it. Plain `marketplace` and `workshop`
 * nodes (old code paths and tests) keep `UPGRADES_PER_VISIT`.
 */
export const UPGRADES_PER_TOWN_BY_BIOME: ReadonlyArray<number> = [2, 3, 4];

/** How many upgrades a visit to this market, workshop or town may buy. */
export function upgradeAllowanceFor(node: Pick<IRegionNode, 'kind' | 'biomeIndex'>): number {
    if (node.kind !== 'town') return UPGRADES_PER_VISIT;
    return UPGRADES_PER_TOWN_BY_BIOME[Math.min(node.biomeIndex, UPGRADES_PER_TOWN_BY_BIOME.length - 1)];
}

/** The once-per-visit key the upgrade bench spends against (`IRunState.upgradesTaken`). */
export function upgradeBenchKeyFor(node: Pick<IRegionNode, 'id' | 'kind' | 'visited'>): string {
    return node.kind === 'town' ? `${node.id}:upgrades:${node.visited}` : `${node.id}:${node.visited}`;
}

/** The patch bench's once-per-visit key at a town. */
export function patchBenchKeyFor(node: Pick<IRegionNode, 'id' | 'visited'>): string {
    return `${node.id}:patch:${node.visited}`;
}

/**
 * The gym gate's upgrade is FREE — 163 §2, *"and a free upgrade at the gym gate (the rest-site
 * venue). Both answer 153's 'scrap is not scarce'."*
 *
 * A named constant rather than a literal 0 at the call site, so the reducer that charges it is the
 * same reducer that charges the bench and there is no second code path to keep honest.
 */
export const GYM_GATE_UPGRADE_PRICE = 0;

/**
 * TICKET 163f (Henry, 2026-09-23) — **ONE `+` CARD IN THE STALL, AND THE ONLY EXCEPTION TO THE RULE
 * THAT `+` CARDS ARE NEVER OFFERED.**
 *
 * > *"An upgraded card may be found in the market stall for sale, priced below buying the base and
 * > upgrading it — less than buying then upgrading the card, like 10–20% discount."*
 *
 * `isRewardable` refuses every `+` everywhere else — rewards, enemy decks, the stranger slot, the
 * codex denominator — because the only way to hold one is to UPGRADE the base (163a). This shelf is
 * the single door that is allowed to skip the bench, and it is a door rather than a hole: **at most
 * one per run**, on the static stock, drawn from the party's own v2 pool.
 *
 * # THE PRICE IS DERIVED, NOT TASTED
 *
 * Henry's rule is *"less than buying then upgrading"*, with a 10–20% discount. Buying then upgrading
 * is `CARD_PRICE_BY_ENERGY + UPGRADE_PRICE_BY_ENERGY` — 40 / 55 / 70 / 85 — and 0.85 of that, to
 * the nearest five, is:
 *
 *     0e 35   ·   1e 45   ·   2e 60   ·   3e 70
 *
 * A 15% discount, the middle of the ruled band, and the only multiplier in 5%-steps that keeps all
 * four rungs on a multiple of five without rounding two of them the wrong way. Derived here rather
 * than written as a literal table, so a move to either price table carries this one with it — the
 * discount is the ruling, not the four numbers.
 */
export const UPGRADED_CARD_DISCOUNT = 0.85;

/** At most one `+` on the shelf per RUN, not per visit. 163f: a door, not a hole. */
export const UPGRADED_STOCK_PER_RUN = 1;

export function upgradedCardPrice(dataId: string): number {
    const base = resolveProgramId(dataId).endsWith('+')
        ? resolveProgramId(dataId).slice(0, -1)
        : resolveProgramId(dataId);
    const full = cardPrice(base) + upgradePrice(base);
    return Math.round((full * UPGRADED_CARD_DISCOUNT) / 5) * 5;
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
    // Ticket 176: a town is a market and a workshop in one node. 'marketplace' stays for old code paths and tests.
    return kind === 'marketplace' || kind === 'town';
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
     * Which of the three stocking slots put this on the shelf.
     *
     * A named slot rather than a boolean, because Henry's 2026-08-28 element ruling made the old
     * boolean untrue. Under the species rule, "not from the party's pool" described BOTH extra slots
     * and `wildcard` said it in one word. Under the element rule a neutral card **is** in every
     * party's pool (`getPoolForElement` folds `None` cards into every element), so the neutral slot
     * is no longer off-pool at all — it is a *guarantee*, not an outsider.
     *
     * - `pool` — one of the five drawn from your party's elements.
     * - `neutral` — the guaranteed neutral-utility slot (`MARKET_NEUTRAL_UTILITY`). In your pool,
     *   but reserved, so the answer to a fight is never crowded out by a 33-card draw.
     * - `stranger` — the genuinely off-pool slot: a card of an element nobody in your party runs.
     */
    readonly slot: MarketSlot;
    /**
     * True for the `stranger` slot only. Kept as a derived convenience because it is what the screen
     * tags and what "off-pool" means to a player — see `slot` for why it stopped covering two slots.
     */
    readonly wildcard: boolean;
}

/** Where an offer came from. See `IMarketOffer.slot`. */
export type MarketSlot = 'pool' | 'neutral' | 'stranger' | 'upgraded';

/** The stall's single blueprint slot (ticket 142 §7). One option, or none on a bare route. */
export interface IBlueprintOffer {
    readonly speciesId: string;
    readonly price: number;
}
export interface IMarketStock {
    readonly offers: ReadonlyArray<IMarketOffer>;
    /** `marketStockSeed(run, node)` — handed back so a test can prove what the roll depended on. */
    readonly seed: string;
    /**
     * The REFRESH this stock belongs to. Ticket 142 §7 renamed the axis: two visits are one
     * stock now, and two refreshes are two stocks.
     */
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
/**
 * THE SHELF'S SEED — ticket 142 §7 (Henry, 2026-09-11).
 *
 * *"Make it static per run so whenever you come back it has the same stock, which doesn't get
 * replenished — once you buy the card it's gone from the shop."*
 *
 * `nodeSeed` folds `node.visited` into its key, which is exactly right for a wild (a re-entered
 * node should roll a different fight) and exactly wrong for a shelf: walking out and back in was a
 * FREE re-roll, and the module header's no-farm rule was enforced only by the visit cap. The stock
 * is now keyed on the node's REFRESH count instead — a number only a paid refresh moves (142f) —
 * so the no-farm rule holds by construction rather than by a ceiling on visits.
 *
 * The purpose string keeps `market` so that a run saved before this change, with no refreshes,
 * resumes on the same shelf it had at visit 0. Runs saved mid-visit-2 get a different shelf on
 * resume; that is a one-time cost of the ruling and cheaper than a save migration for a field
 * whose whole point is that it is derived.
 */
/**
 * A BLUEPRINT ON THE SHELF — ticket 142 §7, RULED by Henry 2026-09-11.
 *
 * *"Add blueprints to the shop, but they should be expensive and only offer 1 random option."*
 *
 * **50 scrap, the same as a refresh, and that equality is the design.** The two are the only
 * things at a stall that are not a card, and they are the two ways to answer a shelf that has
 * nothing for you: buy a body, or buy a different shelf. Pricing them alike makes that a choice
 * rather than an ordering. It is also above the dearest card (45), which is what Henry asked for -
 * a blueprint is a whole mingming, and it should cost more than any single card on the wall.
 */
export const MARKET_BLUEPRINT_PRICE = 50;

/**
 * Every species the shop may sell a blueprint for — the WHOLE Early Access roster.
 *
 * # THIS WAS ROUTE-RESTRICTED, AND THAT WAS MY MISREADING OF 142d
 *
 * The first version derived the pool from `run.biomes` and argued that a stall selling a kraken
 * blueprint on the Rootfall road would hand back the thing the route was built to withhold.
 * **The route was never built to withhold anything.** Henry, 2026-09-12:
 *
 * > *"We aren't intentionally withholding blueprints. The stall can sell a kraken blueprint, it
 * > just felt bad trying to prepare for a NNW deck by going through an entire water biome when you
 * > want to focus on your fire team ... It's not about limiting, it was about avoiding having to
 * > drop your fire starters to get through the biome then last minute switch back to FFN party."*
 *
 * The complaint 142d answers is about being FORCED to walk a biome you have no team for, and the
 * shop is the opposite of that problem: it is how you reach an off-route body **without** the
 * detour. Restricting it turned a fix for a routing annoyance into a content lock, which is a
 * different game — Henry names the play it would have deleted: *"maybe you want to try a certain
 * deck archetype and take the type disadvantage, or maybe it's an achievement to beat a grass boss
 * with water mingmings."*
 *
 * `LAUNCH_SPECIES` rather than `PLAYABLE_SPECIES`: the other ten live in the registry for the
 * balance harness and are not Early Access content, so a stall must not sell one.
 */
export function blueprintPool(): string[] {
    return [...LAUNCH_SPECIES];
}

/**
 * The one blueprint this shelf is selling, or `null` where the route offers nothing.
 *
 * Its own fork of the shelf seed, for the reason every fork here has one: adding the slot must not
 * shift which cards or macros the other slots drew. It therefore holds and refreshes exactly as
 * they do, which is what makes *"once you buy the card it's gone"* true of the blueprint too.
 */
export function rollBlueprintOffer(run: IRunState, node: IRegionNode): IBlueprintOffer | null {
    const pool = blueprintPool();
    if (pool.length === 0) return null;
    const stream = new SeedStream(new SeedStream(marketStockSeed(run, node)).fork('market-blueprint'));
    return { speciesId: pool[stream.nextInt(0, pool.length - 1)], price: shopPrice(run, MARKET_BLUEPRINT_PRICE) };
}

/**
 * Has this shelf's blueprint already been bought?
 *
 * A card offer answers this from OWNERSHIP (`isOfferSold` looks for its minted instance id), and a
 * blueprint cannot: blueprints are a persistent COUNT on the ranch, so "I own a kraken blueprint"
 * says nothing about whether this stall is where it came from. So the run records the purchase,
 * keyed by node AND refresh - which means a refresh makes the slot available again for free, with
 * no clearing step and nothing to forget to clear.
 */
export function blueprintSlotKey(run: IRunState, node: IRegionNode): string {
    return `${node.id}:${run.marketRefreshes?.[node.id] ?? 0}`;
}

export function isBlueprintSlotSold(run: IRunState, node: IRegionNode): boolean {
    return (run.boughtBlueprints ?? []).includes(blueprintSlotKey(run, node));
}
export function marketStockSeed(run: IRunState, node: IRegionNode): string {
    const refreshes = run.marketRefreshes?.[node.id] ?? 0;
    return new SeedStream(run.seed).fork(`market:${node.id}:${refreshes}`);
}
/**
 * TICKET 163f — **which market carries the run's one `+` card, and which card it is.**
 *
 * Returns the `+` id for the ONE market node in this run that carries the slot, and `null` for every
 * other market and every other visit to that one.
 *
 * **Chosen by a draw over the run's own market nodes**, off a fork of the run seed, rather than by
 * counting how many have been visited. A counter would need run state that survives a save and would
 * make "have I already seen it" a thing the shop has to remember; a draw over the graph is a
 * property of the RUN and is the same answer every time it is asked, which is also what stops a
 * refresh farming for it — `marketStockSeed` moves with `marketRefreshes` and this does not.
 *
 * The card is an upgrade of something in the PARTY's pool, so the slot is an offer this team can
 * use. A pool with nothing upgradable yields `null`, which is honest: the alternative is reaching
 * outside the pool for a `+`, and a stranger you cannot bench is the shape 163a refused.
 */
export function upgradedOfferFor(
    run: IRunState,
    node: IRegionNode,
    pool: ReadonlyArray<string>,
): string | null {
    const markets = run.nodes.filter((candidate) => isMarketNode(candidate.kind)).map((candidate) => candidate.id);
    if (markets.length === 0 || !markets.includes(node.id)) return null;

    const stream = new SeedStream(new SeedStream(run.seed).fork('market-upgraded'));
    const chosen = markets[stream.nextInt(0, markets.length - 1)];
    if (chosen !== node.id) return null;

    const upgradable = pool
        .filter((dataId) => hasUpgrade(dataId))
        .map((dataId) => upgradeIdFor(dataId))
        .filter((dataId): dataId is string => dataId !== undefined);
    if (upgradable.length === 0) return null;
    // One draw, from a stream forked off the same label, so which market and which card move
    // together and neither can shift the other's answer.
    return upgradable[stream.nextInt(0, upgradable.length - 1)];
}

export function rollMarketStock(input: MarketStockInput): IMarketStock {
    const { run, node, party, fallbackElement = 'None' } = input;

    const seed = marketStockSeed(run, node);
    const poolStream = new SeedStream(new SeedStream(seed).fork('market-pool'));
    const wildStream = new SeedStream(new SeedStream(seed).fork('market-wildcard'));
    // Its own fork, for the reason every fork here has one: adding or removing the neutral slot must
    // not shift which STRANGER the wildcard slot draws, or which cards the pool slots show.
    const neutralStream = new SeedStream(new SeedStream(seed).fork('market-neutral'));
    const idStream = new SeedStream(new SeedStream(seed).fork('market-card-ids'));

    // **The same pool rule as rewards, by ticket 13's own words.** Not a copy of the rule — the
    // function itself, so that when Henry rules on `economy-session.md`'s last open economy item the
    // shop and the drops move together instead of one of them being forgotten.
    const pool = rewardCardPool(party, fallbackElement);

    /*
     * TICKET 69: the off-pool slot draws from the curated neutral-utility list, not from the whole
     * set complement. See `MARKET_NEUTRAL_UTILITY` for why — the short version is that a complement
     * 207 cards wide makes any *particular* card a 1.4%-per-run draw, which is not a hedge.
     *
     * `isRewardable` is still applied, and the `!pool.includes` filter is kept even though no entry
     * can currently be in a party pool (condition 2 of the list). It costs nothing and it means a
     * future entry that IS in some deck degrades to "not offered twice" rather than to a duplicate
     * row on the same shelf.
     */
    /*
     * THE THREE SLOTS ARE DRAWN IN ORDER AND EACH EXCLUDES WHAT THE ONES BEFORE IT TOOK.
     *
     * That sequencing is what Henry's element ruling forced. Under the old species rule the three
     * sources were disjoint by construction — the pool was your deck lists, the neutral list was in
     * no deck, and the stranger was the complement of both. Under the element rule the pool is your
     * elements plus every `None` card, **so the neutral list is now a SUBSET of the pool**, and a
     * `!pool.includes` filter on the neutral slot would empty it and silently drop the shelf to six.
     *
     * Excluding what has already been drawn is the rule that survives both, and it is the one the
     * player would state: a shelf never shows the same card twice.
     */
    const taken = new Set<string>();
    const take = (source: ReadonlyArray<string>, count: number, stream: SeedStream): string[] => {
        const picked = drawDistinct(source.filter((id) => !taken.has(id)), count, stream);
        for (const id of picked) taken.add(id);
        return picked;
    };

    // The neutral slot is a RESERVATION, not an outsider: `hamstring` and friends are in every
    // party's pool now, and the point of the slot is that a 33-card draw cannot crowd them out.
    // Ticket 162a keeps that true under the v2 pool gate by putting this list IN the pool — see
    // `NEUTRAL_UTILITY_IDS` in `speciesPools.ts`, which is where these ids now live.
    const neutral = MARKET_NEUTRAL_UTILITY.filter((id) => isRewardable(id));

    /*
     * The stranger: a card of an element nobody in your party runs. This is the slot that stops a
     * mono-species run seeing one element all game, and it is the only one still honestly "off-pool".
     *
     * `isRewardable` carries the calibration exclusion (`RewardSystem.CALIBRATION_ONLY`) — which
     * this slot is the reason for. The control species' six `baseline_*` cards are real, non-token
     * registry entries in no playable deck, so they sit squarely in this complement; they reached
     * the shelf at ~3% a visit before ticket 69, and restoring this slot would have put them back.
     */
    /*
     * TICKET 25-pre (Henry, 2026-09-24) — **THE STRANGER IS STILL A CARD THE GAME SHIPS.**
     *
     * This slot drew from `ProgramRegistry` entire, so an all-EA party could be sold a card from the
     * archived v1 collection or from one of the ten post-EA species — on the one shelf whose whole
     * job is *"this is not one of your team's cards"*. It is: it is not anyone's.
     *
     * Narrowed exactly as `rewardCardPool` narrows the reward pool, and gated on the same
     * `usesV2Pool` test, so a party with a post-EA member keeps the full complement rather than
     * being handed a shelf that cannot speak for it. `inV2RunPool` already carries the neutral and
     * run-only ids, so nothing reachable before is lost.
     */
    const eaOnly = usesV2Pool(party);
    const stranger = Object.keys(ProgramRegistry)
        .filter((id) => isRewardable(id) && !pool.includes(id) && !MARKET_NEUTRAL_UTILITY.includes(id))
        .filter((id) => !eaOnly || inV2RunPool(id));

    /*
     * TICKET 163f — **THE ONE `+` CARD, AT ONE MARKET, ONCE A RUN.**
     *
     * Henry ruled an upgraded card may be found in the stall, *"priced below buying the base and
     * upgrading it"*. `isRewardable` refuses `+` cards everywhere else and keeps doing so: this is
     * the single explicit exception, and it is bounded on three sides at once —
     *
     *   - **one market per run carries it**, chosen by a seeded draw over the run's own market nodes
     *     rather than by a counter, so it needs no new run state and cannot be farmed by refreshing
     *     (the choice does not read `marketRefreshes`);
     *   - **it is drawn from the PARTY's pool**, so it is an upgrade of a card this team can use,
     *     which is what stops the slot being a second stranger;
     *   - **it is an extra slot**, not one of the five, so a run that meets it loses nothing.
     *
     * `upgradedOfferFor` is separated out so the "which market" decision is testable on its own —
     * it is the half that is easy to get subtly wrong and impossible to see in a stall.
     */
    const upgraded = upgradedOfferFor(run, node, pool);

    const drawn: Array<{ dataId: string; slot: MarketSlot }> = [
        ...take(pool, MARKET_STOCK_SIZE, poolStream).map((dataId) => ({ dataId, slot: 'pool' as const })),
        ...take(neutral, MARKET_NEUTRAL_SLOTS, neutralStream).map((dataId) => ({ dataId, slot: 'neutral' as const })),
        ...take(stranger, MARKET_WILDCARD_SLOTS, wildStream).map((dataId) => ({ dataId, slot: 'stranger' as const })),
        ...(upgraded === null ? [] : [{ dataId: upgraded, slot: 'upgraded' as const }]),
    ];

    const offers: IMarketOffer[] = drawn.map(({ dataId, slot }) => ({
        card: {
            instanceId: idStream.nextId('bought'),
            dataId,
            // `ownerId: null` — "bought, drafted, or granted by an event" (`runTypes.IRunCard`). A
            // purchased card belongs to the shared deck and to no member, which is also what keeps
            // `RunScreen`'s per-member card counts honest.
            ownerId: null,
        },
        // 163f: the `+` slot is priced by its own rule (base + bench, less 15%), not by the card
        // table — an upgraded card's `baseCost` is its base's, so `cardPrice` would sell it for the
        // price of the card it improves on.
        price: shopPrice(run, slot === 'upgraded' ? upgradedCardPrice(dataId) : cardPrice(dataId)),
        slot,
        wildcard: slot === 'stranger',
    }));

    return { offers, seed, visit: run.marketRefreshes?.[node.id] ?? 0 };
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
    const seed = marketStockSeed(run, node);
    const macroStream = new SeedStream(new SeedStream(seed).fork('market-macros'));

    return drawDistinct([...MACRO_IDS], MACRO_STOCK_SIZE, macroStream)
        .map((macroId) => ({ macroId, price: shopPrice(run, macroPrice(macroId)) }));
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
