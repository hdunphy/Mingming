/**
 * The marketplace — ticket 13 (steam-release map).
 *
 * # WHAT THE PLAYER IS LOOKING AT
 *
 * Two verbs over one currency. **Buy** a card out of a stock rolled from the party's own pool (plus
 * one off-pool stranger), and **pay to remove** one — the sink `economy-session.md` asks for, and by
 * Henry's 2026-08-21 amendment the answer to the generic filler that three start-deck slots and
 * every recruit keep adding.
 *
 * **Ticket 13 shipped a third verb — sell a specific card back — and ticket 57 removed it.** Henry
 * ruled (ticket 56) that cards cannot be sold: removal is a *pure sink*, so the market takes scrap
 * and never gives it. That amends `economy-session.md`'s "selling cards" income line, so this screen
 * offers no control, no price and no copy that turns a deck card back into scrap —
 * `MarketplaceNode.test.tsx` asserts the rendered markup contains no "sell" at all, which pins the
 * ruling rather than trusting this file to keep obeying it.
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
 *    — so the target is printed beside it and the screen says which side of it you are on. That
 *    sentence is what turns the removal price from a tax into a decision.
 * 2. **Why a button is dead.** A card you cannot afford is disabled *and says what it is short of*.
 *    Ticket 20 set that precedent (`RunStart`'s party picker prints "Already fielding this species"
 *    rather than ignoring the click), and a silently inert button is indistinguishable from a bug to
 *    whoever is holding the controller.
 * 3. **Scrap, always.** It is the only currency on the screen and every button changes it.
 * 4. **`power` NEVER.** Standing law (map § Notes): power dies at the surface. The offer rows print
 *    name, element, rarity and **energy cost** — the two inputs the price is actually keyed on — and
 *    not the card's description, because the descriptions are written for the balance pass and some
 *    of them quote the internal number out loud (`water_slap`: *"priced at 12 power to
 *    compensate"*). `MarketplaceNode.test.tsx` asserts the rendered markup contains no "power" at
 *    all, which is a test that would catch a well-meant "show the card text" patch.
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
    REMOVAL_PRICE,
    REROLL_PRICE,
    isOfferSold,
    rollMacroStock,
    rollMarketStock,
    type IMacroOffer,
    type IMarketOffer,
} from '../../engine/run/marketplace';
// Ticket 57: `sellPrice` was imported here (and `cardPrice`, only to print the buy-back a sell was
// measured against). Henry ruled cards cannot be sold (ticket 56) — removal is a pure sink, so there
// is no sell price to show and this screen must not reach for one.
import { DECK_TARGET_MAX, DECK_TARGET_MIN } from '../../engine/run/runSummary';
import { getMacro, macroRackBlockFor } from '../../engine/data/macroRegistry';
import { numericBaseCost } from '../../engine/types';
import { MACRO_SLOTS } from '../../engine/runTypes';
import type { IRegionNode, IRunCard, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { buyMacro, buyMarketCard, removeRunCardForScrap, rerollMarketStock } from '../store/runSlice';
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
}

/**
 * What a card shows on this screen. Deliberately four fields: the two the price is keyed on (rarity,
 * energy cost) plus the two that identify it (name, element). No description, and no `power` — see
 * the header.
 */
function lineFor(dataId: string): CardLine {
    const data = ProgramRegistry[dataId];
    return {
        name: data?.name ?? dataId,
        element: data?.element ?? 'None',
        rarity: (data?.rarity as string) ?? 'Common',
        cost: numericBaseCost(data?.baseCost ?? 0),
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

    // Ticket 57: a `sell` handler dispatching `sellRunCard` stood here. Henry ruled cards cannot be
    // sold (ticket 56) — removal is the only card sink, so the market takes scrap and never gives it.

    const scrapCard = (card: IRunCard): void => {
        dispatch(removeRunCardForScrap({ instanceId: card.instanceId, price: REMOVAL_PRICE }));
        playSfx('uiClick');
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
                            ? `A good 3v3 deck wants ${DECK_TARGET_MIN}–${DECK_TARGET_MAX} cards — ${deckSize - DECK_TARGET_MAX} over. Pay to remove.`
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
                <h3>Your deck ({deckSize})</h3>
            </div>
            <p className="mk-note">
                <strong>Removal costs {REMOVAL_PRICE} scrap and pays nothing back</strong> — it buys
                you a thinner deck, which is the point, and it is the only way a card leaves the deck.
                The generic <em>Tackle</em> filler every member and recruit brings is what removal is
                for.
            </p>

            <ul className="mk-deck-list">
                {run.deck.map((card) => {
                    const line = lineFor(card.dataId);
                    const shortForRemoval = shortBy(REMOVAL_PRICE);
                    return (
                        <li key={card.instanceId} className={`mk-deck-row ${card.dataId === GENERIC_HIT ? 'generic' : ''}`}>
                            <div className="mk-offer-card">
                                <span className="mk-card-name">{line.name}</span>
                                <span className="mk-card-meta">
                                    {line.element} · {line.rarity} · {line.cost}⚡
                                </span>
                                {card.dataId === GENERIC_HIT && <span className="mk-tag">generic filler</span>}
                            </div>
                            <div className="mk-row-actions">
                                <button
                                    type="button"
                                    className="mk-button danger"
                                    onClick={() => scrapCard(card)}
                                    disabled={shortForRemoval > 0}
                                >
                                    {shortForRemoval > 0
                                        ? `Remove (${REMOVAL_PRICE}) — ${shortForRemoval} short`
                                        : `Remove — ${REMOVAL_PRICE} scrap`}
                                </button>
                            </div>
                        </li>
                    );
                })}
                {deckSize === 0 && <li className="mk-empty">No cards. Nothing to strip.</li>}
            </ul>
        </section>
    );
}
