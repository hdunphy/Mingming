/**
 * The marketplace — ticket 13 (steam-release map).
 *
 * # WHAT THE PLAYER IS LOOKING AT
 *
 * Two verbs over one currency. **Buy** a card out of a stock rolled from the party's own pool (plus
 * one off-pool stranger), and **SELL** one you will never play, from the deck or the collection.
 *
 * **Both of those have flipped once.** Ticket 13 shipped selling; ticket 56 banned it and ticket 57
 * deleted it, making paid removal the only card verb; Henry's 2026-08-26 amendment deleted paid
 * removal and brought selling back at 5/10/15/20 by energy. The pivot is the run collection: when
 * the only way to shrink a deck was to pay, a sale was a rebate on housekeeping and worth banning.
 * Editing is free now, so a sale is what happens to a card that is never going in — *"it doesn't
 * feel bad to grab all the cards even if you don't plan to use them, you can get some scrap."*
 * Every sell rung sits under its own buy rung, so the loop cannot be farmed.
 *
 * Everything about *what things cost* and *what is in the stock* lives in
 * `engine/run/marketplace.ts`. This file renders it and dispatches. That split is the same one
 * `RegionMap` keeps with `regionLayout`, and it is why the prices can be ratified by Henry without
 * anyone opening a `.tsx` file.
 *
 * # THE FOUR THINGS THIS SCREEN HAS TO SHOW, NOT JUST OBEY
 *
 * 1. **The deck count, with the target stated.** Ticket 13's Done-when says so in as many words:
 *    *"the deck count is visible so the 20-25 target is legible"*. A number alone is not legible —
 *    28 is only meaningful next to the 20-25 a good 3v3 deck wants (`economy-session.md`, bite two)
 *    — so the target is printed beside it and the screen says which side of it you are on.
 * 2. **Why a button is dead.** A card you cannot afford is disabled *and says what it is short of*.
 *    Ticket 20 set that precedent (`RunStart`'s party picker prints "Already fielding this species"
 *    rather than ignoring the click), and a silently inert button is indistinguishable from a bug to
 *    whoever is holding the controller.
 * 3. **Scrap, always.** It is the only currency on the screen and every button changes it.
 * 4. **THE CARD SAYS WHAT IT DOES.** This clause used to be the opposite, and the reversal is
 *    Henry's, twice over.
 *
 *    It read: *"`power` NEVER — the offer rows print name, element, rarity and energy cost and not
 *    the card's description, because the descriptions are written for the balance pass and some of
 *    them quote the internal number out loud"* (142 of 216 do). `MarketplaceNode.test.tsx` enforced
 *    it by asserting the rendered markup contained no "power" anywhere.
 *
 *    Then Henry amended the standing law on 2026-08-23: *"I think we need power in the card
 *    descriptions otherwise you can't compare cards in the deck builder."* Power dies at the
 *    surface still holds for the FIGHT — that is where a preview must show true numbers rather than
 *    printed ones — but a shop is a comparison screen, and the card text is the comparison. Then
 *    the 2026-08-24 playtest made it a bug report: *"I don't like the marketplace UI. You can't see
 *    the card descriptions."*
 *
 *    So the rows print the description, and the no-"power" test is gone with the rule it enforced.
 *    A card you are being asked to pay 35 scrap for, described only as "Fire · Rare · 2⚡", is not
 *    an offer — it is a lottery ticket with a price on it.
 *
 * # KEYBOARD
 *
 * Every affordance is a real `<button>`, the same choice `RegionMap`'s travel list makes and for the
 * same reason: ticket 38 (accessibility) should inherit screens that already work without a mouse
 * rather than screens that need retrofitting.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { ProgramRegistry } from '../../engine/data/programRegistry';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import type { IRewardPartyMember } from '../../engine/RewardSystem';
import {
    SELL_PRICE_BY_ENERGY,
    sellPrice,
    REROLL_PRICE,
    isOfferSold,
    rollMacroStock,
    rollMarketStock,
    type IMacroOffer,
    type IMarketOffer,
} from '../../engine/run/marketplace';
import { DECK_TARGET_MAX, DECK_TARGET_MIN } from '../../engine/run/runSummary';
import { getMacro, macroRackBlockFor } from '../../engine/data/macroRegistry';
import { numericBaseCost } from '../../engine/types';
import { MACRO_SLOTS } from '../../engine/runTypes';
import type { IRegionNode, IRunCard, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { buyMacro, buyMarketCard, rerollMarketStock, sellRunCard } from '../store/runSlice';
import './MarketplaceNode.css';

/**
 * `economy-session.md`, bite two: *"the run BUILDS toward the ~20-25 cards a good 3v3 deck wants."*
 * The band is the whole reason a removal price exists, so it is printed rather than implied.
 *
 * **Ticket 19 moved the two numbers into `engine/run/runSummary.ts` and left this re-export.** The
 * run summary quotes the same target — it is the one screen where the player finally learns what
 * the deck-building track was *for* — and an engine module may not import a screen. Re-exported
 * rather than repointed at every call site, so the shop's own readers and tests keep their import.
 */
export { DECK_TARGET_MAX, DECK_TARGET_MIN } from '../../engine/run/runSummary';

interface CardLine {
    readonly name: string;
    readonly element: string;
    readonly rarity: string;
    readonly cost: number;
    /** What the card does, in its own words. Added 2026-08-24 — see clause 4 in the header. */
    readonly description: string;
}

/**
 * What a card shows on this screen: the two fields the price is keyed on (rarity, energy cost), the
 * two that identify it (name, element), and the text that says what you are buying.
 */
function lineFor(dataId: string): CardLine {
    const data = ProgramRegistry[dataId];
    return {
        name: data?.name ?? dataId,
        element: data?.element ?? 'None',
        rarity: (data?.rarity as string) ?? 'Common',
        cost: numericBaseCost(data?.baseCost ?? 0),
        description: data?.description ?? '',
    };
}

export interface MarketplaceNodeProps {
    readonly run: IRunState;
    /** The market being stood in, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    /** The party as it is right now — it decides the pool, exactly as it decides a reward pick. */
    readonly party: ReadonlyArray<IRewardPartyMember>;
}

export default function MarketplaceNode({ run, node, party }: MarketplaceNodeProps): ReactNode {
    const dispatch = useDispatch();

    // Rolled from (run seed, node id, visit count) — never held in component state. A remount, an
    // app close or a resume therefore shows the same stock, and the *only* thing that changes it is
    // a new visit: walking back in, or paying `REROLL_PRICE` for the same increment.
    const stock = useMemo(() => rollMarketStock({ run, node, party }), [run, node, party]);
    // Rolled off its own fork of the same node seed (`market-macros`), so the macro shelf re-rolls
    // per visit exactly as the card shelf does and neither can shift the other.
    const macroStock = useMemo(() => rollMacroStock({ run, node, party }), [run, node, party]);

    const deckSize = run.deck.length;
    const scrap = run.scrap;
    const macrosHeld = run.macros.filter((slot) => slot !== null).length;

    const buy = (offer: IMarketOffer): void => {
        dispatch(buyMarketCard({ card: offer.card, price: offer.price }));
        playSfx('rewardClaim');
    };

    const purchaseMacro = (offer: IMacroOffer): void => {
        dispatch(buyMacro({ macroId: offer.macroId, price: offer.price }));
        playSfx('rewardClaim');
    };

    /**
     * Everything the player could sell, deck first, each tagged with which pile it came from.
     *
     * Both piles on one list rather than two sections: the same card sells for the same price
     * either way, and a screen that split them would make the player think the pile mattered.
     */
    const sellable = useMemo(
        () => [
            ...run.deck.map((card) => ({ card, inDeck: true })),
            ...(run.collection ?? []).map((card) => ({ card, inDeck: false })),
        ],
        [run.deck, run.collection],
    );

    const sell = (card: IRunCard): void => {
        dispatch(sellRunCard({ instanceId: card.instanceId, price: sellPrice(card.dataId) }));
        playSfx('rewardClaim');
    };

    const reroll = (): void => {
        dispatch(rerollMarketStock({ nodeId: node.id, price: REROLL_PRICE }));
        playSfx('uiClick');
    };

    /** The shortfall, in the words the player needs: what they are short, not that they are short. */
    const shortBy = (price: number): number => Math.max(0, price - scrap);

    return (
        <section className="mk">
            <header className="mk-head">
                <h2 className="mk-title">🛒 Marketplace</h2>
                <div className="mk-balance">
                    <span className="mk-scrap" aria-label="Scrap held">{scrap} scrap</span>
                    <span className="mk-deck">
                        deck: {deckSize} cards
                        <span className="mk-deck-target"> · target {DECK_TARGET_MIN}–{DECK_TARGET_MAX}</span>
                    </span>
                </div>
                <p className="mk-note">
                    {deckSize < DECK_TARGET_MIN
                        ? `A good 3v3 deck wants ${DECK_TARGET_MIN}–${DECK_TARGET_MAX} cards — ${DECK_TARGET_MIN - deckSize} short. Buy.`
                        : deckSize > DECK_TARGET_MAX
                            // Ticket 57: this branch used to read "Sell or remove." Removal is the
                            // only way down now (Henry, ticket 56), so it names the one that exists.
                            ? `A good 3v3 deck wants ${DECK_TARGET_MIN}–${DECK_TARGET_MAX} cards — ${deckSize - DECK_TARGET_MAX} over. Move cards to your collection, or sell them.`
                            : `On target: a good 3v3 deck wants ${DECK_TARGET_MIN}–${DECK_TARGET_MAX} cards.`}
                    {' '}Scrap is run-scoped and dies with the run — spend it.
                </p>
            </header>

            {/* --- Stock --- */}

            <div className="mk-section-head">
                <h3>Stock</h3>
                <button
                    type="button"
                    className="mk-button subtle"
                    onClick={reroll}
                    disabled={scrap < REROLL_PRICE}
                >
                    {scrap < REROLL_PRICE
                        ? `Reroll (${REROLL_PRICE}) — ${shortBy(REROLL_PRICE)} scrap short`
                        : `Reroll stock — ${REROLL_PRICE} scrap`}
                </button>
            </div>
            <p className="mk-note">
                Visit {stock.visit}. The stock is drawn from your party&apos;s own card pools — the
                same rule the post-fight pick uses — plus one <strong>off-pool</strong> slot, so a
                one-species team is not offered the same list all run. Walking back in later, or
                paying for a reroll, rolls a fresh stock.
            </p>

            <ul className="mk-stock">
                {stock.offers.map((offer) => {
                    const line = lineFor(offer.card.dataId);
                    const sold = isOfferSold(run.deck, offer);
                    const short = shortBy(offer.price);
                    return (
                        <li key={offer.card.instanceId} className={`mk-offer ${offer.wildcard ? 'wild' : ''}`}>
                            <div className="mk-offer-card">
                                <span className="mk-card-name">{line.name}</span>
                                <span className="mk-card-meta">
                                    {line.element} · {line.rarity} · {line.cost}⚡
                                </span>
                                {line.description && (
                                    <span className="mk-card-text">{line.description}</span>
                                )}
                                {offer.wildcard && <span className="mk-tag">off-pool</span>}
                            </div>
                            <button
                                type="button"
                                className="mk-button"
                                onClick={() => buy(offer)}
                                disabled={sold || short > 0}
                            >
                                {sold
                                    ? 'Bought'
                                    : short > 0
                                        ? `${offer.price} scrap — ${short} short`
                                        : `Buy — ${offer.price} scrap`}
                            </button>
                        </li>
                    );
                })}
                {stock.offers.length === 0 && <li className="mk-empty">The stall is bare.</li>}
            </ul>

            {/*
              * MACROS IN STOCK — TICKET 15, filling the slot ticket 13 marked.
              *
              * `macros-and-drivers.md`: 3 slots, single-use, fired free on your turn, priced at FULL
              * 1-energy-card value (rares 1.5x). They are a separate stock list rather than more
              * rows in the one above, exactly as ticket 13 predicted: they are bought into
              * `IRunState.macros` (a fixed 3-slot tuple) and not into the deck, so it is a different
              * reducer, a different refusal and a different empty state.
              *
              * **The refusal is the part with a rule behind it.** Ticket 15: *"a full rack must
              * refuse a purchase with a reason, not silently drop it."* `macroRackBlockFor` is that
              * reason, produced by the engine and printed on the dead button — a reducer has no
              * error channel, so this is the only place it can be said. `power` never appears here
              * either: a macro row prints its name, its rarity and its own description, and its
              * descriptions are written for the player (`macroRegistry.ts` header).
              */}
            <div className="mk-section-head">
                <h3>Macros</h3>
                <span className="mk-deck">
                    rack: {macrosHeld}/{MACRO_SLOTS} slots
                </span>
            </div>
            <p className="mk-note">
                Three slots, <strong>single use</strong>, fired free on your turn — the map survey
                fires from the map instead. A macro is not a card and never enters your deck.
            </p>

            <ul className="mk-stock">
                {macroStock.map((offer) => {
                    const macro = getMacro(offer.macroId)!;
                    const block = macroRackBlockFor(run.macros, offer.macroId);
                    const short = shortBy(offer.price);
                    const label = block === 'rack-full'
                        ? 'Rack full — fire one or leave it'
                        : short > 0
                            ? `${offer.price} scrap — ${short} short`
                            : `Buy — ${offer.price} scrap`;
                    return (
                        <li key={offer.macroId} className={`mk-offer ${macro.rarity === 'Rare' ? 'wild' : ''}`}>
                            <div className="mk-offer-card">
                                <span className="mk-card-name">{macro.name}</span>
                                <span className="mk-card-meta">
                                    Macro · {macro.rarity} · {macro.description}
                                </span>
                                {macro.rarity === 'Rare' && <span className="mk-tag">rare</span>}
                            </div>
                            <button
                                type="button"
                                className="mk-button"
                                onClick={() => purchaseMacro(offer)}
                                disabled={block !== null || short > 0}
                            >
                                {label}
                            </button>
                        </li>
                    );
                })}
                {macroStock.length === 0 && <li className="mk-empty">No macros this visit.</li>}
            </ul>

            {/*
              * --- The deck: removal, and nothing else ---
              *
              * Ticket 57: this list carried a sell button per row, priced by `sellPrice`. Henry ruled
              * (ticket 56) that cards cannot be sold — removal is a pure sink — so a row now offers
              * exactly one action, and a deck card is a one-way door: scrap goes in, nothing comes
              * back out. The copy below states that outright rather than leaving the player hunting
              * for the buy-back that used to be here.
              */}

            <div className="mk-section-head">
                <h3>Sell cards ({sellable.length})</h3>
                <span className="mk-price-tag">{SELL_PRICE_BY_ENERGY.join(' / ')} by ⚡</span>
            </div>
            <p className="mk-note">
                <strong>A sale pays {SELL_PRICE_BY_ENERGY[0]}–{SELL_PRICE_BY_ENERGY[SELL_PRICE_BY_ENERGY.length - 1]} scrap
                by energy cost</strong>, always under what the same card buys for, so there is no
                loop to farm. Selling is for a card you are never going to play — taking one out of
                your <em>deck</em> is free, at any workshop, biome boundary or here.
            </p>

            <ul className="mk-deck-list">
                {sellable.map(({ card, inDeck }) => {
                    const line = lineFor(card.dataId);
                    const price = sellPrice(card.dataId);
                    return (
                        <li key={card.instanceId} className={`mk-deck-row ${card.dataId === GENERIC_HIT ? 'generic' : ''}`}>
                            <div className="mk-offer-card">
                                <span className="mk-card-name">{line.name}</span>
                                <span className="mk-card-meta">
                                    {line.element} · {line.rarity} · {line.cost}⚡
                                </span>
                                {/* Deciding what to SELL needs the text at least as much as
                                    deciding what to buy does. */}
                                {line.description && (
                                    <span className="mk-card-text">{line.description}</span>
                                )}
                                {card.dataId === GENERIC_HIT && <span className="mk-tag">generic filler</span>}
                                {/* Which pile it is in, because the same card sells for the same
                                    price either way and the player should not have to remember. */}
                                <span className="mk-tag">{inDeck ? 'in deck' : 'collection'}</span>
                            </div>
                            <div className="mk-row-actions">
                                <button
                                    type="button"
                                    className="mk-button"
                                    onClick={() => sell(card)}
                                >
                                    Sell — {price} scrap
                                </button>
                            </div>
                        </li>
                    );
                })}
                {sellable.length === 0 && <li className="mk-empty">Nothing to sell.</li>}
            </ul>
        </section>
    );
}
