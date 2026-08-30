/**
 * THE MARKETPLACE — ticket 13, rebuilt to ticket 63's ruled mockup.
 *
 * `research/63-market-proto/market_G_stall.html` is the spec: a stall. Stock on card faces with the
 * price stamped on the art, sold cards left in place and greyed, and the sell panel **always
 * visible** down the right rather than folded behind a mode switch. Option H offered BUY and SELL as
 * two modes; Henry took G, and the reason is the whole design of ticket 61 — a player deciding
 * whether 35 scrap is worth it is deciding it *against what they could sell to raise it*, and a mode
 * switch puts a click between the two halves of one thought.
 *
 * # THE THREE VERBS, AND WHAT EACH OF THEM IS FOR
 *
 * **Buy** puts a card straight into the ACTIVE DECK — ticket 63, ruled: *"a bought card goes
 * straight to the active deck, always."* Not the collection. You paid for it because you want to
 * play it, and a purchase that landed in a side pile would make every purchase two steps.
 *
 * **Sell** pays 5/10/15/20 by energy cost, from either pile. This verb has flipped twice: ticket 13
 * shipped it, ticket 56 banned it and 57 deleted it, and Henry's 2026-08-26 amendment brought it
 * back. The pivot is the run collection. When the only way to shrink a deck was to *pay* for a
 * removal, a sale was a rebate on housekeeping and worth banning. Editing is free now, so a sale is
 * what happens to a card that was never going in — *"it doesn't feel bad to grab all the cards even
 * if you don't plan to use them, you can get some scrap for them."* Every sell rung sits under its
 * own buy rung (5/10/15/20 against 15/25/35/45), so the loop cannot be farmed.
 *
 * **Edit loadout** opens the one editor all four surfaces share (`LoadoutEditor`). Paid removal is
 * gone entirely; moving a card out of the deck is free and happens there.
 *
 * # WHAT THE SCREEN HAS TO SHOW, NOT JUST OBEY
 *
 * 1. **Scrap, always.** It is the only currency here and every button changes it.
 * 2. **The deck count against its floor**, in the pill under the sell panel. The old header printed
 *    a 20-25 *target*; ticket 61 §5 replaced the aspiration with a hard floor (8/13/18 by party
 *    size), and a floor is the number that actually greys a row out.
 * 3. **Why a button is dead.** Ticket 20's precedent: a disabled control says what it is short of.
 *    A silently inert button is indistinguishable from a bug to whoever is holding the controller.
 * 4. **The card says what it does.** 142 of 216 descriptions quote the internal power number, and
 *    the old rule here was that they must therefore never be printed. Henry reversed it — *"we need
 *    power in the card descriptions otherwise you can't compare cards in the deck builder"* — and
 *    then the 2026-08-24 playtest made it a bug report. Power dies at the surface still holds for
 *    the FIGHT. A shop is a comparison screen, and the card text is the comparison.
 * 5. **A SOLD card stays on the shelf.** Ticket 63: the greyed gap is what tells you the stock was
 *    finite and what you took out of it. A vanished card reads as a bug.
 *
 * # KEYBOARD
 *
 * Every affordance is a real `<button>` — the card tile included, which is why it carries
 * `text-align: center` in CSS rather than inheriting it. `RegionMap` set that precedent so ticket 38
 * inherits screens that already work without a mouse rather than screens that need retrofitting.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import { minimumActiveDeck } from '../../engine/run/createRun';
import type { IRewardPartyMember } from '../../engine/RewardSystem';
import {
    CARD_PRICE_BY_ENERGY,
    SELL_PRICE_BY_ENERGY,
    sellPrice,
    REROLL_PRICE,
    isOfferSold,
    rollMacroStock,
    rollMarketStock,
    type IMacroOffer,
    type IMarketOffer,
} from '../../engine/run/marketplace';
import { getMacro, macroRackBlockFor } from '../../engine/data/macroRegistry';
import { MACRO_SLOTS } from '../../engine/runTypes';
import type { IRegionNode, IRunCard, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { buyMacro, buyMarketCard, rerollMarketStock, sellRunCard } from '../store/runSlice';
import { cardFace, colorFor, groupByData } from './runShell';
import './runShell.css';
import './MarketplaceNode.css';
import { Icon } from '../theme/Icon';
import { ElementMark, EnergyPips, TypeMark } from './CardChassis';

/**
 * Ticket 19's deck-band constants, re-exported because this module's readers and tests import them
 * from here. The SCREEN no longer prints the band: ticket 61 §5 replaced "a good 3v3 deck wants
 * 20-25" with a hard floor, and printing an aspiration beside an enforced minimum invites the
 * player to read the aspiration as the rule. `RunSummary` still quotes the band, which is the one
 * screen where the deck-building track finally gets scored.
 */
export { DECK_TARGET_MAX, DECK_TARGET_MIN } from '../../engine/run/runSummary';

/** The stall's card tile — smaller than the editor's book, larger than a row. Mockup G's grid. */
const STALL_TILE = { ['--cw' as string]: '170px', ['--ch' as string]: '216px', ['--ah' as string]: '56px' };

/** One line in the sell panel: a unique card in one pile, with its count and its price. */
interface SellStack {
    readonly key: string;
    readonly instances: ReadonlyArray<IRunCard>;
    readonly inDeck: boolean;
    readonly price: number;
}

export interface MarketplaceNodeProps {
    readonly run: IRunState;
    /** The market being stood in, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    /** The party as it is right now — it decides the pool, exactly as it decides a reward pick. */
    readonly party: ReadonlyArray<IRewardPartyMember>;
    /** For the context line. The biome you are shopping in changes what the pool is worth. */
    readonly biomeName?: string;
    /** Opens the shared `LoadoutEditor`. One of ticket 61 §3's four doors. */
    readonly onEditLoadout: () => void;
    /** Closes the stall back to the map. See `RunScreen` for why leaving is a UI state and not a move. */
    readonly onLeave: () => void;
}

export default function MarketplaceNode({
    run, node, party, biomeName, onEditLoadout, onLeave,
}: MarketplaceNodeProps): ReactNode {
    const dispatch = useDispatch();

    // Rolled from (run seed, node id, visit count) — never held in component state. A remount, an
    // app close or a resume therefore shows the same stock, and the *only* thing that changes it is
    // a new visit: walking back in, or paying `REROLL_PRICE` for the same increment.
    const stock = useMemo(() => rollMarketStock({ run, node, party }), [run, node, party]);
    // Rolled off its own fork of the same node seed (`market-macros`), so the macro shelf re-rolls
    // per visit exactly as the card shelf does and neither can shift the other.
    const macroStock = useMemo(() => rollMacroStock({ run, node, party }), [run, node, party]);

    const scrap = run.scrap;
    const floor = minimumActiveDeck(run.partyIds.length);
    const atFloor = run.deck.length <= floor;
    const macrosHeld = run.macros.filter((slot) => slot !== null).length;

    /**
     * Everything the player owns, one row per unique card per pile.
     *
     * Both piles in one list rather than two sections: the same card sells for the same price
     * either way, and a screen that split them would make the player think the pile mattered. The
     * pile is a tag on the row instead — which it has to be, because the floor only bites on one of
     * them.
     */
    const sellable = useMemo<SellStack[]>(() => {
        const build = (cards: ReadonlyArray<IRunCard>, inDeck: boolean): SellStack[] =>
            groupByData(cards).map(({ dataId, instances }) => ({
                key: `${inDeck ? 'deck' : 'coll'}:${dataId}`,
                instances,
                inDeck,
                price: sellPrice(dataId),
            }));
        return [...build(run.deck, true), ...build(run.collection ?? [], false)]
            .sort((a, b) => a.price - b.price
                || cardFace(a.instances[0].dataId).name.localeCompare(cardFace(b.instances[0].dataId).name));
    }, [run.deck, run.collection]);

    /**
     * Owned instances, for the SOLD check. Deck **and** collection: a bought card lands in the deck,
     * but the editor can move it to the collection a moment later, and a stall that only looked at
     * the deck would offer to sell the same instance a second time.
     */
    const owned = useMemo(
        () => [...run.deck, ...(run.collection ?? [])],
        [run.deck, run.collection],
    );

    const buy = (offer: IMarketOffer): void => {
        dispatch(buyMarketCard({ card: offer.card, price: offer.price }));
        playSfx('rewardClaim');
    };

    const purchaseMacro = (offer: IMacroOffer): void => {
        dispatch(buyMacro({ macroId: offer.macroId, price: offer.price }));
        playSfx('rewardClaim');
    };

    const sell = (stack: SellStack): void => {
        if (stack.inDeck && atFloor) { playSfx('uiError'); return; }
        dispatch(sellRunCard({ instanceId: stack.instances[0].instanceId, price: stack.price }));
        playSfx('rewardClaim');
    };

    const reroll = (): void => {
        dispatch(rerollMarketStock({ nodeId: node.id, price: REROLL_PRICE }));
        playSfx('uiClick');
    };

    /** The shortfall, in the words the player needs: what they are short, not that they are short. */
    const shortBy = (price: number): number => Math.max(0, price - scrap);

    return (
        <section className="mk rs-frame rs-fixed">
            <div className="rs-top">
                <span className="rs-title">MARKETPLACE</span>
                <span className="rs-ctx">
                    {(biomeName ?? 'THIS').toUpperCase()} BIOME · VISIT {stock.visit} · stock re-rolls each visit
                </span>
                <span className="rs-spacer" />
                <span className="rs-scrap" aria-label="Scrap held">{scrap} <Icon name="scrap" size={12} /></span>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onEditLoadout(); }}>
                    EDIT LOADOUT
                </button>
                <button type="button" className="rs-btn primary" onClick={() => { playSfx('uiClick'); onLeave(); }}>
                    LEAVE
                </button>
            </div>

            <div className="mk-body">
                <div className="rs-panel mk-center">
                    <div className="mk-merchant">
                        <span className="mk-face" aria-hidden="true"><Icon name="roster" size={22} /></span>
                        <span className="mk-merchant-text">
                            <span className="mk-merchant-nm">SALVAGE BROKER v2.3</span>
                            <span className="mk-say">&ldquo;Fresh firmware, honest prices. Mostly.&rdquo;</span>
                        </span>
                        <span className="rs-spacer" />
                        {/*
                          * The re-roll is not in the mockup, and it is kept because it is not
                          * decoration: `rerollMarketStock` buys exactly the visit-increment that
                          * walking out and back in would buy (ticket 13), and deleting the button
                          * would leave the ctx line's "re-rolls each visit" as a claim with no
                          * reachable second visit at a dead-end market. It sits as a filter chip
                          * rather than a `.btn` so it never competes with LEAVE.
                          */}
                        <button
                            type="button"
                            className="rs-f"
                            onClick={reroll}
                            disabled={scrap < REROLL_PRICE}
                        >
                            {scrap < REROLL_PRICE
                                ? `REROLL ${REROLL_PRICE} scrap — ${shortBy(REROLL_PRICE)} SHORT`
                                : `REROLL STOCK — ${REROLL_PRICE} scrap`}
                        </button>
                    </div>

                    <h2 className="mk-h">STOCK — CARDS (your elements + one off-pool)</h2>
                    <div className="mk-grid" style={STALL_TILE}>
                        {stock.offers.map((offer) => {
                            const face = cardFace(offer.card.dataId);
                            const sold = isOfferSold(owned, offer);
                            const short = shortBy(offer.price);
                            return (
                                <button
                                    key={offer.card.instanceId}
                                    type="button"
                                    className={`rs-card ${sold ? 'sold' : ''}`}
                                    style={{ ['--el' as string]: colorFor(face.element) }}
                                    disabled={sold || short > 0}
                                    onClick={() => buy(offer)}
                                >
                                    <EnergyPips cost={face.cost} />
                                    <TypeMark banner={face.banner} />
                                    <span className="rs-art" />
                                    <span className="rs-cnm">{face.name}</span>
                                    <span className="rs-desc">{face.description}</span>
                                    <span className="rs-tags mk-tags">
                                        <ElementMark element={face.element} />
                                        {offer.wildcard && <span className="rs-tg">off-pool</span>}
                                    </span>
                                    <span className={`rs-price ${sold ? 'sold' : ''}`}>
                                        {sold ? 'SOLD' : short > 0 ? `${offer.price} scrap · ${short} SHORT` : `${offer.price} scrap`}
                                    </span>
                                    <span className="rs-elbar" />
                                </button>
                            );
                        })}
                        {stock.offers.length === 0 && <span className="mk-empty">The stall is bare.</span>}
                    </div>

                    {/*
                      * MACROS — ticket 15. `macros-and-drivers.md`: 3 slots, single-use, fired free
                      * on your turn, priced at full 1-energy-card value (rares 1.5x). They are a
                      * separate shelf rather than more tiles above, because they are bought into
                      * `IRunState.macros` (a fixed 3-slot tuple) and never into the deck — a
                      * different reducer, a different refusal and a different empty state.
                      *
                      * **The refusal is the part with a rule behind it.** Ticket 15: *"a full rack
                      * must refuse a purchase with a reason, not silently drop it."*
                      * `macroRackBlockFor` is that reason, produced by the engine and printed on the
                      * dead tile — a reducer has no error channel, so this is the only place it can
                      * be said.
                      */}
                    <h2 className="mk-h">
                        MACROS · {MACRO_SLOTS - macrosHeld}/{MACRO_SLOTS} slots free
                    </h2>
                    <div className="mk-grid mk-macros" style={STALL_TILE}>
                        {macroStock.map((offer) => {
                            const macro = getMacro(offer.macroId)!;
                            const block = macroRackBlockFor(run.macros, offer.macroId);
                            const short = shortBy(offer.price);
                            return (
                                <button
                                    key={offer.macroId}
                                    type="button"
                                    className={`rs-card ${macro.rarity === 'Rare' ? 'rare' : ''}`}
                                    style={{ ['--el' as string]: '#c9a2f0' }}
                                    disabled={block !== null || short > 0}
                                    onClick={() => purchaseMacro(offer)}
                                >
                                    {/* A macro costs no energy — it is free and single-use — so its
                                        rack is a single unfilled slot, the same shape a 0-cost card
                                        shows. Ticket 66 gives it its own mark instead. */}
                                    <EnergyPips cost={0} />
                                    <TypeMark banner="MACRO" />
                                    <span className="rs-art" />
                                    <span className="rs-cnm">{macro.name}</span>
                                    <span className="rs-desc">{macro.description}</span>
                                    <span className="rs-tags mk-tags">{macro.rarity === 'Rare' ? 'rare' : ''}</span>
                                    <span className="rs-price">
                                        {block === 'rack-full'
                                            ? 'RACK FULL'
                                            : short > 0 ? `${offer.price} scrap · ${short} SHORT` : `${offer.price} scrap`}
                                    </span>
                                    <span className="rs-elbar" />
                                </button>
                            );
                        })}
                        {macroStock.length === 0 && <span className="mk-empty">No macros this visit.</span>}
                    </div>
                </div>

                <div className="rs-panel mk-sell">
                    <h2>SELL — YOUR CARDS <span className="mk-sub">(deck + collection)</span></h2>
                    <div className="mk-rows">
                        {sellable.map((stack) => {
                            const face = cardFace(stack.instances[0].dataId);
                            const blocked = stack.inDeck && atFloor;
                            return (
                                <button
                                    key={stack.key}
                                    type="button"
                                    className="rs-row"
                                    style={{ ['--el' as string]: colorFor(face.element) }}
                                    disabled={blocked}
                                    onClick={() => sell(stack)}
                                >
                                    <span className="rs-g">{face.cost}</span>
                                    <ElementMark element={face.element} compact />
                                    <span className="rs-rnm">{face.name}</span>
                                    {stack.instances[0].dataId === GENERIC_HIT && <span className="rs-t">generic</span>}
                                    <span className="rs-t">{stack.inDeck ? 'deck' : 'collection'}</span>
                                    {stack.instances.length > 1 && <span className="rs-x">×{stack.instances.length}</span>}
                                    <span className="rs-sellp">+{stack.price} <Icon name="scrap" size={11} /></span>
                                </button>
                            );
                        })}
                        {sellable.length === 0 && <span className="mk-empty">Nothing to sell.</span>}
                    </div>

                    <p className="rs-hint mk-foot">
                        {atFloor
                            ? `At the floor (${floor}) — deck rows are dead until you add cards or bench a member. Collection rows still sell.`
                            : `Selling from the deck respects the floor (${floor}) — rows grey out at the limit.`}
                        {' '}Sell {SELL_PRICE_BY_ENERGY.join('/')} by cost against buy{' '}
                        {CARD_PRICE_BY_ENERGY.join('/')}; always less than buy, so there is no loop to farm.
                    </p>
                    <div className={`rs-pill mk-pill ${atFloor ? 'at-floor' : ''}`}>
                        DECK <b>{run.deck.length}</b> / floor {floor}
                    </div>
                </div>
            </div>
        </section>
    );
}
