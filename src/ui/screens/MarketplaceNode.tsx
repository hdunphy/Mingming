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

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import { isJunkCard } from '../../engine/run/junk';
import type { IRewardPartyMember } from '../../engine/RewardSystem';
import {
    CARD_PRICE_BY_ENERGY,
    SELL_PRICE_BY_ENERGY,
    JUNK_REMOVAL_PRICE,
    sellPrice,
    MARKET_REFRESH_PRICE,
    isOfferSold,
    type IBlueprintOffer,
    rollBlueprintOffer,
    isBlueprintSlotSold,
    rollMacroStock,
    rollMarketStock,
    type IMacroOffer,
    type IMarketOffer,
    UPGRADES_PER_VISIT,
} from '../../engine/run/marketplace';
import { getMacro, macroOfferBlockFor } from '../../engine/data/macroRegistry';
import { MACRO_SLOTS } from '../../engine/runTypes';
import type { IRanchState, IRegionNode, IRunCard, IRunState } from '../../engine/runTypes';
import { shopPrice } from '../../engine/run/modifiers/shopPrice';
import { playSfx } from '../audio/AudioEngine';
import { buyMacro, buyMarketBlueprint, buyMarketCard, freezeMarketParty, removeJunkCard, rerollMarketStock, sellRunCard } from '../store/runSlice';
import { frozenMarketParty, marketPartyFor } from '../../engine/run/marketParty';
import { junkNote, readDeckFloor } from './deckFloor';
import { addBlueprint } from '../store/gameSlice';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { cardFace, colorFor, groupByData } from './runShell';
import './runShell.css';
import './MarketplaceNode.css';
import { Icon } from '../theme/Icon';
import { UpgradeBench } from './UpgradeBench';
import { PatchBench } from './PatchBench';
import { introRules } from '../../engine/run/intro/introRules';
import { CardFace, ElementMark } from './CardChassis';
import { CardPeek } from './CardPeek';
import { useCardPeek } from '../hooks/useCardPeek';

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
    /** TICKET 168c: junk is removed for a price, not sold, and the floor never blocks it. */
    readonly junk: boolean;
}

export interface MarketplaceNodeProps {
    readonly run: IRunState;
    /** The market being stood in, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    /** The party as it is right now — it decides the pool, exactly as it decides a reward pick. */
    readonly party: ReadonlyArray<IRewardPartyMember>;
    /** For the context line. The biome you are shopping in changes what the pool is worth. */
    readonly biomeName?: string;
    /**
     * TICKET 163d — the roster, for the patch shelf: a patch is fitted to a NAMED body, and
     * `party` here is reward vocabulary (`definitionId` + `activeOS`) with no nickname on it.
     * Optional so the debug scenarios that mount this screen without a ranch keep working — they
     * see the stall minus one shelf, which is the same thing a run with nothing to patch sees.
     */
    readonly ranch?: IRanchState;
    /** Opens the shared `LoadoutEditor`. One of ticket 61 §3's four doors. */
    readonly onEditLoadout: () => void;
    /** Closes the stall back to the map. See `RunScreen` for why leaving is a UI state and not a move. */
    readonly onLeave: () => void;
}

export default function MarketplaceNode({
    run, node, party, biomeName, ranch, onEditLoadout, onLeave,
}: MarketplaceNodeProps): ReactNode {
    const dispatch = useDispatch();
    const { peek, at, peekHandlers } = useCardPeek();

    // Rolled from (run seed, node id, REFRESH count) — never held in component state, so a remount,
    // an app close or a resume shows the same stock. Ticket 142 §7 took the visit count out of that
    // key: walking back in no longer changes anything, and a paid refresh is the only thing that does.
    //
    // TICKET 171b: and rolled for the team this shop was FIRST visited with, not the live one, so a
    // recruit or a bench (even from the loadout editor opened here) cannot restock it. The first
    // visit writes the snapshot; until that lands, the live team IS the snapshot.
    const hasSnapshot = frozenMarketParty(run, node.id) !== undefined;
    useEffect(() => {
        if (!hasSnapshot) dispatch(freezeMarketParty({ nodeId: node.id, party }));
    }, [dispatch, hasSnapshot, node.id, party]);
    const shelfParty = useMemo(() => marketPartyFor(run, node.id, party), [run, node.id, party]);
    const stock = useMemo(() => rollMarketStock({ run, node, party: shelfParty }), [run, node, shelfParty]);
    // Its own fork of the same seed (`market-macros`), so the macro shelf holds and refreshes with
    // the card shelf and neither can shift the other.
    const macroStock = useMemo(() => rollMacroStock({ run, node, party: shelfParty }), [run, node, shelfParty]);
    // Ticket 142 §7: one blueprint, from the species this ROUTE can recruit. Same seed, so it holds
    // and refreshes with the rest of the stall.
    const blueprintOffer = useMemo(() => rollBlueprintOffer(run, node), [run, node]);
    const blueprintSold = isBlueprintSlotSold(run, node);
    // TICKET 182c: what this run's market shows. The card stall and the upgrade bench are in every market.
    const marketRules = introRules(run).market;

    const scrap = run.scrap;
    const reading = readDeckFloor(run);
    const { floor, atFloor } = reading;
    const macrosHeld = run.macros.filter((slot) => slot !== null).length;

    /** TICKET 169g: junk removal is a price the player pays, so Tight Budget raises it; the sell prices beside it are income and do not move. */
    const junkRemovalPrice = shopPrice(run, JUNK_REMOVAL_PRICE);

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
                junk: isJunkCard(dataId),
                price: isJunkCard(dataId) ? junkRemovalPrice : sellPrice(dataId),
            }));
        return [...build(run.deck, true), ...build(run.collection ?? [], false)]
            .sort((a, b) => a.price - b.price
                || cardFace(a.instances[0].dataId).name.localeCompare(cardFace(b.instances[0].dataId).name));
    }, [run.deck, run.collection, junkRemovalPrice]);

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

    /*
     * TWO SLICES, RANCH FIRST — the workshop's recruit makes the same split for the same reason.
     * If the app dies between the dispatches, a player who paid and got nothing has lost scrap; a
     * player who got the blueprint and was not charged has been given a present. Only one of those
     * is a bug report.
     */
    const purchaseBlueprint = (offer: IBlueprintOffer): void => {
        dispatch(addBlueprint(offer.speciesId));
        dispatch(buyMarketBlueprint({ nodeId: node.id, price: offer.price }));
        playSfx('rewardClaim');
    };

    const sell = (stack: SellStack): void => {
        if (stack.junk) {
            if (scrap < stack.price) { playSfx('uiError'); return; }
            dispatch(removeJunkCard({ instanceId: stack.instances[0].instanceId, price: stack.price }));
            playSfx('uiClick');
            return;
        }
        if (stack.inDeck && atFloor) { playSfx('uiError'); return; }
        dispatch(sellRunCard({ instanceId: stack.instances[0].instanceId, price: stack.price }));
        playSfx('rewardClaim');
    };

    /** TICKET 169g: the stall refresh, at Tight Budget's rate when that is on. */
    const refreshPrice = shopPrice(run, MARKET_REFRESH_PRICE);

    const reroll = (): void => {
        dispatch(rerollMarketStock({ nodeId: node.id, price: refreshPrice, party }));
        playSfx('uiClick');
    };

    /** The shortfall, in the words the player needs: what they are short, not that they are short. */
    const shortBy = (price: number): number => Math.max(0, price - scrap);

    return (
        <section className="mk rs-frame rs-fixed">
            <div className="rs-top">
                <span className="rs-title">MARKETPLACE</span>
                <span className="rs-ctx">
                    {/*
                      * TICKET 142 §7: this line used to read "VISIT n · stock re-rolls each visit",
                      * and both halves are now wrong. `stock.visit` counts REFRESHES, not visits,
                      * and the shelf does not re-roll on re-entry at all - which is the fact the
                      * player most needs, because it is what makes "buy it now or lose it" true.
                      */}
                    {(biomeName ?? 'THIS').toUpperCase()} BIOME · VISIT {node.visited} · this stock is fixed for the run
                </span>
                <span className="rs-spacer" />
                <span className="rs-scrap" aria-label="Scrap held">{scrap} <Icon name="scrap" size={12} /></span>
                {marketRules.editLoadout && (
                    <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onEditLoadout(); }}>
                        EDIT LOADOUT
                    </button>
                )}
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
                          * TICKET 142 §7 — THE REFRESH IS NOW THE ONLY WAY A SHELF CHANGES.
                          *
                          * It used to buy the visit-increment that walking out and back in gave
                          * away free, which is why it was cheap (10) and why the ctx line promised
                          * a re-roll each visit. Both are gone: the stock is fixed for the run, so
                          * this button is not a shortcut any more, it is the whole mechanism -
                          * *"You can pay scrap to refresh it"* - and it refreshes the WHOLE stall.
                          *
                          * Still a filter chip rather than a `.btn`, so it never competes with
                          * LEAVE. At 50 it costs more than the dearest card, which is the point:
                          * it should read as an alternative to a purchase, not as a free look.
                          */}
                        {marketRules.refresh && (
                            <button
                                type="button"
                                className="rs-f"
                                onClick={reroll}
                                disabled={scrap < refreshPrice}
                            >
                                {scrap < refreshPrice
                                    ? `REFRESH ${refreshPrice} scrap — ${shortBy(refreshPrice)} SHORT`
                                    : `REFRESH STALL — ${refreshPrice} scrap`}
                            </button>
                        )}
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
                                    <CardFace face={face} tags={offer.wildcard ? 'off-pool' : undefined} />
                                    <span className={`rs-price ${sold ? 'sold' : ''}`}>
                                        {sold ? 'SOLD' : short > 0 ? `${offer.price} scrap · ${short} SHORT` : `${offer.price} scrap`}
                                    </span>
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
                    {/*
                      * TICKET 142 §7 — ONE BLUEPRINT, and one is the ruling: *"only offer 1 random
                      * option."* It sits between the cards and the macros because that is its price
                      * order (50, above the dearest card) and because it is the shelf's one
                      * non-card body. Absent entirely on a route that can recruit nothing, rather
                      * than drawn as a dead slot - an empty heading is a bug report waiting.
                      */}
                    {marketRules.blueprint && blueprintOffer && (
                        <>
                            <h2 className="mk-h">BLUEPRINT — one body, this route only</h2>
                            <div className="mk-grid" style={STALL_TILE}>
                                <button
                                    type="button"
                                    className={`rs-card mk-bp ${blueprintSold ? "sold" : ""}`}
                                    style={{ ["--el" as string]: colorFor(GetMingmingData(blueprintOffer.speciesId).primaryElement) }}
                                    disabled={blueprintSold || shortBy(blueprintOffer.price) > 0}
                                    onClick={() => purchaseBlueprint(blueprintOffer)}
                                >
                                    <CardFace
                                        face={{
                                            name: GetMingmingData(blueprintOffer.speciesId).name,
                                            description: 'A blueprint. Spend it at a workshop or the ranch to assemble one.',
                                            element: GetMingmingData(blueprintOffer.speciesId).primaryElement,
                                        }}
                                    />
                                    <span className={`rs-price ${blueprintSold ? "sold" : ""}`}>
                                        {blueprintSold
                                            ? "SOLD"
                                            : shortBy(blueprintOffer.price) > 0
                                                ? `${blueprintOffer.price} scrap · ${shortBy(blueprintOffer.price)} SHORT`
                                                : `${blueprintOffer.price} scrap`}
                                    </span>
                                </button>
                            </div>
                        </>
                    )}

                    {marketRules.macros && (
                    <>
                    <h2 className="mk-h">
                        MACROS · {MACRO_SLOTS - macrosHeld}/{MACRO_SLOTS} slots free
                    </h2>

                    {/*
                      * YOUR RACK, ON THE SHELF — the 2026-09-04 playtest. Henry: *"I bought a macro
                      * at the shop ... I also don't see it on the screen in my inventory."*
                      *
                      * He was right and the purchase was fine: `buyMacro` had put it in slot 1. The
                      * shop simply never showed him. A bought CARD lands in a list he is already
                      * looking at and its tile goes SOLD; a bought macro left the tile identical,
                      * decremented a number in a heading, and put the thing itself on a screen he
                      * would not see again until he closed the shop. That is indistinguishable from
                      * a purchase that failed, and a consumable you cannot confirm you own is one
                      * you stop buying.
                      *
                      * So the rack is drawn here, all three slots, empty ones included — the same
                      * argument `MacroRack` makes for the battle rack: the empties are what tell you
                      * how much room you have, and they are where the next purchase visibly lands.
                      */}
                    <ul className="mk-rack" aria-label="Your macro rack">
                        {run.macros.map((macroId, slot) => {
                            const held = getMacro(macroId);
                            return (
                                <li key={slot} className={`mk-rack-slot ${held ? 'full' : 'empty'}`}>
                                    <span className="mk-rack-i">{slot + 1}</span>
                                    <span className="mk-rack-nm">{held ? held.name : 'empty'}</span>
                                </li>
                            );
                        })}
                    </ul>

                    {/*
                      * A MACRO IS NOT A CARD, AND THE TILE MUST NOT SAY IT IS.
                      *
                      * Henry, same playtest: *"first it looks like a card, it needs a different
                      * style."* It wore `rs-card` — ticket 66's card chassis — which promises four
                      * things a macro does not have: an energy cost (it printed one unfilled pip,
                      * which reads as "0 energy" rather than "no energy"), card art, a place in your
                      * DECK, and a draw. A macro is a consumable in a three-slot rack, fired free,
                      * gone after one use. The type mark alone could not carry that against a
                      * silhouette the player had already learned means "card".
                      *
                      * So it gets a rack-slot shape instead: landscape, a violet rail, the ● mark,
                      * and the two facts that actually govern it printed on the face.
                      */}
                    <div className="mk-macros">
                        {macroStock.map((offer) => {
                            const macro = getMacro(offer.macroId)!;
                            const block = macroOfferBlockFor(run.macros, offer.macroId);
                            const short = shortBy(offer.price);
                            const inRack = run.macros.filter((held) => held === offer.macroId).length;
                            return (
                                <button
                                    key={offer.macroId}
                                    type="button"
                                    className={`mk-macro ${macro.rarity === 'Rare' ? 'rare' : ''} ${block === 'already-held' ? 'sold' : ''}`}
                                    disabled={block !== null || short > 0}
                                    onClick={() => purchaseMacro(offer)}
                                >
                                    {/*
                                      * FLAT, not nested, because the layout is a GRID of named areas
                                      * (see the CSS). Wrapping the text in a `body` span made it one
                                      * middle column between the mark and the price, so a long
                                      * description — `echo`'s is the longest in the registry — was
                                      * squeezed into a ribbon barely a third of the tile wide.
                                      * The description spans the full width now; only the NAME
                                      * shares a row with the price.
                                      */}
                                    <span className="mk-macro-mark" aria-hidden>●</span>
                                    <span className="mk-macro-nm">{macro.name}</span>
                                    <span className="mk-macro-price">
                                        {/*
                                          * SOLD is the CARD shelf's word for the same state, and
                                          * using it here is the point: one copy of each thing, gone
                                          * once you take it (Henry, 2026-09-04). The stock re-rolls
                                          * on the next visit, so a sold slot is this visit's answer.
                                          */}
                                        {block === 'already-held'
                                            ? 'SOLD'
                                            : block === 'rack-full'
                                                ? 'RACK FULL'
                                                : short > 0 ? `${offer.price} scrap · ${short} SHORT` : `${offer.price} scrap`}
                                    </span>
                                    <span className="mk-macro-desc">{macro.description}</span>
                                    <span className="mk-macro-tags">
                                        {/* The two ruled facts (`macros-and-drivers.md`), printed
                                            rather than implied: no Energy, and it is gone after one
                                            use. */}
                                        <span className="mk-macro-use">SINGLE USE · FIRES FREE</span>
                                        {macro.rarity === 'Rare' && <span className="mk-macro-rare">RARE</span>}
                                        {inRack > 0 && (
                                            <span className="mk-macro-held">
                                                IN RACK{inRack > 1 ? ` ×${inRack}` : ''}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                        {macroStock.length === 0 && <span className="mk-empty">No macros this visit.</span>}
                    </div>
                    </>
                    )}
                </div>

                {/*
                  * TICKET 163b — the upgrade bench, above the sell panel because it is the verb
                  * that IMPROVES a deck and selling is the one that shrinks it. Henry ruled the
                  * bench appears at both stops (2026-09-24), so the same component is mounted in
                  * `WorkshopNode` and at the gym gate; the only thing this call site decides is
                  * whose once-per-visit allowance is being spent.
                  */}
                {/* TICKET 163d — the stall stocks AMPLIFIER (163 §3: "the boring one every OS can
                    take and the workshop's default stock"). One rider, every body, for scrap. */}
                {ranch && marketRules.patchBench && <PatchBench run={run} ranch={ranch} venue="shop" />}

                <UpgradeBench
                    run={run}
                    benchKey={`${node.id}:${node.visited}`}
                    allowance={UPGRADES_PER_VISIT}
                    heading="UPGRADE — UP TO TWO CARDS IN YOUR DECK"
                />

                {marketRules.sell && (
                <div className="rs-panel mk-sell">
                    <h2>SELL — YOUR CARDS <span className="mk-sub">(deck + collection)</span></h2>
                    <div className="mk-rows">
                        {sellable.map((stack) => {
                            const face = cardFace(stack.instances[0].dataId);
                            const blocked = stack.junk ? scrap < stack.price : stack.inDeck && atFloor;
                            return (
                                <div
                                    key={stack.key}
                                    className="rs-wrap"
                                    tabIndex={blocked ? 0 : undefined}
                                    {...peekHandlers({ face, count: stack.instances.length })}
                                >
                                    <button
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
                                        {stack.junk
                                            ? <span className="rs-sellp mk-remove">Remove — {stack.price} <Icon name="scrap" size={11} /></span>
                                            : <span className="rs-sellp">+{stack.price} <Icon name="scrap" size={11} /></span>}
                                    </button>
                                </div>
                            );
                        })}
                        {sellable.length === 0 && <span className="mk-empty">Nothing to sell.</span>}
                    </div>

                    <CardPeek peek={peek} at={at} className="sell-peek" />

                    {/* TICKET 182a: the foot paragraph is the pill's hover - the pill already says DECK n / floor. */}
                    <div
                        className={`rs-pill mk-pill ${atFloor ? 'at-floor' : ''}`}
                        title={`${atFloor
                            ? `At the floor (${floor}) - deck rows are dead until you add cards or bench a member. Collection rows still sell.`
                            : `Selling from the deck respects the floor (${floor}) - rows grey out at the limit.`} Sell ${SELL_PRICE_BY_ENERGY.join('/')} by cost against buy ${CARD_PRICE_BY_ENERGY.join('/')}.`}
                    >
                        DECK <b>{reading.counted}</b> / floor {floor}{junkNote(reading)}
                    </div>
                </div>
                )}
            </div>
        </section>
    );
}
