/**
 * The marketplace, rendered — ticket 13.
 *
 * `engine/run/marketplace.test.ts` covers the prices and the stock; `runSlice.marketplace.test.ts`
 * covers what the buttons do. What is left, and is a different failure, is whether the screen
 * **says** any of it:
 *
 * - ticket 13's Done-when is *"the deck count is visible so the 20-25 target is legible"*, and a
 *   bare number is not legible — the target has to be on screen next to it;
 * - a button the player cannot press has to say what it is short of (ticket 20's precedent), because
 *   a silently inert control is indistinguishable from a bug;
 * - **every stocked card must print what it does.** This clause was the exact opposite until
 *   2026-08-24 — "`power` must not appear at all", which the screen satisfied by showing no card
 *   text whatsoever. Henry amended the standing law on 2026-08-23 (power stays in card descriptions,
 *   because otherwise cards cannot be compared) and then filed the missing text as a playtest bug.
 *   The assertion is inverted rather than dropped, and it is stricter: a partial or hover-only
 *   implementation fails it;
 * - **and, since the 2026-08-26 amendment, "sell" must APPEAR — priced, and priced under the buy.**
 *   Ticket 56 banned selling and this file pinned the ban by asserting the markup never contained
 *   the word; Henry repealed it in the same pass that deleted paid removal, because the run
 *   collection makes leaving the deck free and a sale is now what happens to a card you are never
 *   going to play. So `offers a priced sell control` is that test INVERTED rather than deleted: the
 *   control has to be on screen, every row has to carry its own `sellPrice`, and the price has to sit
 *   under what the same card buys for, which is the no-loop law visible to the player. It is the
 *   same shape of test as the `power` one above and it exists for the same reason: the cheap way to
 *   break a ruling is a well-meant patch, not a deliberate decision.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import MarketplaceNode, { DECK_TARGET_MAX, DECK_TARGET_MIN } from './MarketplaceNode';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import {
    CARD_PRICE_BY_ENERGY,
    REROLL_PRICE,
    SELL_PRICE_BY_ENERGY,
    cardPrice,
    macroPrice,
    rollMacroStock,
    rollMarketStock,
    sellPrice,
} from '../../engine/run/marketplace';
import { MacroRegistry } from '../../engine/data/macroRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import type { IMingmingState } from '../../engine/types';
import { MACRO_SLOTS } from '../../engine/runTypes';
import type { IRunState } from '../../engine/runTypes';

/**
 * `renderToStaticMarkup` escapes text, and several card descriptions carry apostrophes and
 * ampersands. Comparing raw registry strings against the markup without this passes for most cards
 * and silently skips exactly the ones with punctuation.
 */
const escapeHtml = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

const RANCH_PARTY = [{ definitionId: 'kraken', activeOS: 'kraken_v1' }];

function makeRun(scrap: number, over: Partial<IRunState> = {}): IRunState {
    const run = createRun({
        seed: 'market-render-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    const market = run.nodes.find((n) => n.kind === 'marketplace')!;
    return {
        ...run,
        scrap,
        currentNodeId: market.id,
        nodes: run.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
        ...over,
    };
}

function render(run: IRunState): string {
    const store = configureStore({
        reducer: { run: runReducer },
        preloadedState: { run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return renderToStaticMarkup(
        <Provider store={store}>
            <MarketplaceNode run={run} node={node} party={RANCH_PARTY} />
        </Provider>,
    );
}

function stockFor(run: IRunState) {
    return rollMarketStock({ run, node: run.nodes.find((n) => n.id === run.currentNodeId)!, party: RANCH_PARTY });
}

describe('MarketplaceNode', () => {
    it('shows the scrap balance and the deck count with the 20–25 target beside it', () => {
        const run = makeRun(140);
        const markup = render(run);

        expect(markup).toContain('140 scrap');
        expect(markup).toContain(`deck: ${run.deck.length} cards`);
        expect(markup).toContain(`target ${DECK_TARGET_MIN}`);
        expect(markup).toContain(String(DECK_TARGET_MAX));
    });

    it('says which side of the target the deck is on', () => {
        // A SOLO run opens at eight — 5 tagged kit cards plus the STARTER's 3 generics (Henry,
        // 2026-08-26; ticket 60's 4 + 2 was per member, and the 2026-08-25 table made it 6) — so the
        // first market's advice is "buy", and it is 12 short rather than 14. A bigger party opens
        // at 13 or 18 and the same screen says a smaller number; eight is this fixture's party, not
        // a constant of the game.
        const run = makeRun(140);
        expect(run.deck).toHaveLength(8);

        const short = render(run);
        // Derived from the deck the screen was actually handed, then pinned as the literal the
        // player reads: the shortfall is arithmetic, but 12 is what the first stall will say.
        expect(short).toContain(`${DECK_TARGET_MIN - run.deck.length} short`);
        expect(short).toContain('12 short');

        const bloated = render({ ...run, deck: [...run.deck, ...Array.from({ length: 20 }, (_, i) => ({
            instanceId: `extra_${i}`, dataId: GENERIC_HIT, ownerId: null,
        })) ] });
        // The over-target advice has to name a verb that EXISTS. It read "Pay to remove." until
        // 2026-08-26, when paid removal was deleted; it now names the two things an over-target
        // player can actually do — move cards to the collection for free, or sell them here.
        expect(bloated).toContain('over. Move cards to your collection, or sell them.');
        expect(bloated).not.toContain('Pay to remove');
    });

    it('prints what every stocked card DOES, not just what it costs', () => {
        /*
         * THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is Henry's.
         *
         * It read: *"never prints the word 'power' anywhere on the surface — power is an internal
         * balance instrument. This is the test that catches a 'show the card description' patch,
         * not just a price mistake."* It did its job: the screen shipped with no card text, and 142
         * of 216 descriptions quote a power figure, so printing them would have failed it.
         *
         * Then Henry amended the standing law (2026-08-23): *"we need power in the card
         * descriptions otherwise you can't compare cards in the deck builder."* Power dies at the
         * surface still governs the FIGHT, where a preview must show true numbers rather than
         * printed ones — see `damagePreview.ts`. A shop is a comparison screen, and withholding the
         * rules text there is what the 2026-08-24 playtest reported as a bug: *"I don't like the
         * marketplace UI. You can't see the card descriptions."*
         *
         * So the assertion is inverted rather than deleted, and it is stronger: every stocked card
         * must print its own text, which a partial or hover-only implementation would fail.
         */
        const run = makeRun(400);
        const markup = render(run);
        for (const offer of stockFor(run).offers) {
            const description = ProgramRegistry[offer.card.dataId]?.description;
            if (!description) continue;
            expect(markup).toContain(escapeHtml(description));
        }
    });

    it('offers the rolled stock, one real button per card, with the off-pool slot marked', () => {
        const run = makeRun(400);
        const stock = stockFor(run);
        const markup = render(run);

        for (const offer of stock.offers) {
            expect(markup).toContain(`Buy — ${offer.price} scrap`);
        }
        expect(markup.match(/off-pool<\/span>/g)?.length).toBe(stock.offers.filter((o) => o.wildcard).length);
        // Everything actionable is a <button>: the map's travel list set that precedent and ticket 38
        // inherits a screen that already works without a mouse.
        expect(markup.match(/<button/g)?.length).toBeGreaterThan(stock.offers.length);
    });

    it('disables what the player cannot afford AND says what they are short', () => {
        const run = makeRun(0);
        const stock = stockFor(run);
        const markup = render(run);

        expect(markup).toContain('disabled');
        for (const offer of stock.offers) {
            expect(markup).toContain(`${offer.price} scrap — ${offer.price} short`);
        }
        expect(markup).toContain(`Reroll (${REROLL_PRICE}) — ${REROLL_PRICE} scrap short`);
        expect(markup).not.toContain(`Buy — `);
        // The sell rows are the one thing on this screen a broke player can still use, and that is
        // the point of them: this line used to assert a disabled `Remove (20) — 20 short`, and a
        // sale is never short of anything. Every row is live at zero scrap.
        const target = run.deck[0];
        expect(markup).toContain(`Sell — ${sellPrice(target.dataId)} scrap`);
    });

    it('offers the reroll at its price once the player can pay it', () => {
        expect(render(makeRun(REROLL_PRICE))).toContain(`Reroll stock — ${REROLL_PRICE} scrap`);
    });

    it('marks an offer already bought rather than letting it be bought twice', () => {
        const run = makeRun(400);
        const bought = stockFor(run).offers[0];
        const markup = render({ ...run, deck: [...run.deck, bought.card] });

        expect(markup).toContain('Bought');
        expect(markup).not.toContain(`Buy — ${bought.price} scrap`);
    });

    it('lists the deck AND the collection under one sell header, one button per card', () => {
        // Ticket 57 replaced this case's `Sell — +N` per row with a removal price; the 2026-08-26
        // amendment puts the sale back and widens the list, because *"a card you will never play is
        // the same card whether you already moved it out of the deck or not."* A screen that listed
        // only the deck would make the player edit a card back IN to sell it.
        const collection = [
            { instanceId: 'stored_1', dataId: 'hydro_blast', ownerId: null },
            { instanceId: 'stored_2', dataId: GENERIC_HIT, ownerId: null },
        ];
        const run = makeRun(400, { collection });
        const markup = render(run);

        const sellable = [...run.deck, ...collection];
        expect(markup).toContain(`Sell cards (${sellable.length})`);
        // One priced button per card in BOTH piles — the count is the assertion, because a list that
        // rendered the deck twice or the collection not at all would still contain the words.
        expect(markup.match(/Sell — \d+ scrap/g)?.length).toBe(sellable.length);
        for (const card of sellable) {
            expect(markup).toContain(`Sell — ${sellPrice(card.dataId)} scrap`);
        }
        // And which pile each row came from, since the same card pays the same either way and the
        // player should not have to remember where they left it.
        expect(markup.match(/>in deck</g)?.length).toBe(run.deck.length);
        expect(markup.match(/>collection</g)?.length).toBe(collection.length);
    });

    it('prices every sell row at sellPrice, strictly under what the same card buys for', () => {
        // The no-loop law, as the player can read it off the screen: *"prices must not be farmable
        // to zero"* (Henry, 2026-08-21). `marketplace.test.ts` proves it of the tables; this proves
        // the screen prints the paying half of that pair and not the charging half, on real cards.
        const collection = [{ instanceId: 'stored_1', dataId: 'hydro_blast', ownerId: null }];
        const run = makeRun(400, { collection });
        const markup = render(run);

        for (const card of [...run.deck, ...collection]) {
            const paid = sellPrice(card.dataId);
            expect(paid).toBeLessThan(cardPrice(card.dataId));
            expect(markup).toContain(`Sell — ${paid} scrap`);
            // The number the row shows is never the BUY number for that card — the failure mode is
            // a row wired to the wrong price function, which is invisible until someone farms it.
            expect(markup).not.toContain(`Sell — ${cardPrice(card.dataId)} scrap`);
        }
        // The band is printed as well as applied, so the player can price a card they are not
        // looking at: "5 / 10 / 15 / 20 by ⚡". And the band the screen advertises is the one that
        // obeys the law — rung against its own rung, which is the form `marketplace.test.ts` proves
        // of the constants and this proves of what the player is actually shown.
        expect(markup).toContain(SELL_PRICE_BY_ENERGY.join(' / '));
        SELL_PRICE_BY_ENERGY.forEach((paid, energy) => {
            expect([energy, paid < CARD_PRICE_BY_ENERGY[energy]]).toEqual([energy, true]);
        });
    });

    it('offers a priced sell control in every state a player reaches', () => {
        // THIS TEST USED TO ASSERT THE OPPOSITE. It read *"offers no way at all to sell a card —
        // removal is a pure sink"* and pinned Henry's ticket-56 ban by requiring that the markup
        // never matched /sell/i anywhere. Henry repealed that ban on 2026-08-26 and deleted paid
        // removal with it: *"now it doesn't feel bad to grab all the cards even if you don't plan to
        // use them, you can get some scrap for them."*
        //
        // So the assertion is inverted rather than dropped, and it is checked in the same four
        // states the ban was checked in — a normal shop, a player with no scrap, a deck well over
        // target, and an empty deck — because the failure mode has flipped too: a sale that
        // quietly disappears when the player is broke, or when the deck is empty but the collection
        // is not, is the shape of regression this now catches.
        const bloated = makeRun(400);
        const stored = [{ instanceId: 'stored_1', dataId: 'hydro_blast', ownerId: null }];

        const states = [
            makeRun(400),
            makeRun(0),
            { ...bloated, deck: [...bloated.deck, ...Array.from({ length: 20 }, (_, i) => ({
                instanceId: `extra_${i}`, dataId: GENERIC_HIT, ownerId: null,
            })) ] },
            // An empty DECK is not an empty screen any more: the collection is sellable on its own.
            makeRun(400, { deck: [], collection: stored }),
        ];

        for (const run of states) {
            const markup = render(run);
            const sellable = [...run.deck, ...(run.collection ?? [])];

            expect(markup).toContain(`Sell cards (${sellable.length})`);
            // Exactly the prices `sellPrice` gives for exactly those cards, as a multiset — a row
            // wired to `cardPrice`, or a pile silently dropped, changes this list.
            const printed = [...markup.matchAll(/Sell — (\d+) scrap/g)].map((m) => Number(m[1]));
            expect(printed.sort()).toEqual(sellable.map((c) => sellPrice(c.dataId)).sort());
            // And every printed number is on the ruled sell table, never on the buy table.
            for (const price of printed) expect(SELL_PRICE_BY_ENERGY).toContain(price);
        }
    });

    it('tags the generic filler, in the deck and in the collection alike', () => {
        // Henry, 2026-08-21: the start-deck generics are the cards this section is most often
        // pointed at, so the screen tags them rather than leaving the player to recognise "Tackle"
        // on sight. The count is read off the piles rather than written down — it was three a member
        // under ticket 08, two a member under ticket 60, and is three for the whole run since the
        // STARTER took the allowance — and the claim that survives all of them is the one this
        // asserts: every generic on the sell list is tagged, and nothing else is.
        const collection = [
            { instanceId: 'stored_1', dataId: GENERIC_HIT, ownerId: null },
            { instanceId: 'stored_2', dataId: 'hydro_blast', ownerId: null },
        ];
        const run = makeRun(400, { collection });
        const markup = render(run);
        expect(markup.match(/generic filler<\/span>/g)?.length)
            .toBe([...run.deck, ...collection].filter((c) => c.dataId === GENERIC_HIT).length);
    });

    /**
     * TICKET 15 RETIRED THE PLACEHOLDER THIS TEST USED TO PIN.
     *
     * Ticket 13 left a marked slot here and this case asserted the marker said "ticket 15" — a test
     * whose whole job was to fail the day the feature arrived. It has arrived, so the case now
     * asserts the real shelf: the rolled stock, at the ruled prices, with a real button each.
     * `marketplace.macros.test.ts` owns the prices themselves; what is checked here is that the
     * screen prints the same number the reducer will charge.
     */
    it('stocks macros at the ruled price, one real button each', () => {
        const run = makeRun(400);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const macros = rollMacroStock({ run, node, party: RANCH_PARTY });
        const markup = render(run);

        expect(macros.length).toBeGreaterThan(0);
        for (const offer of macros) {
            expect(markup).toContain(MacroRegistry[offer.macroId].name);
            expect(markup).toContain(`Buy — ${offer.price} scrap`);
            expect(offer.price).toBe(macroPrice(offer.macroId));
        }
        expect(markup).toContain(`rack: 0/${MACRO_SLOTS} slots`);
    });

    it('refuses a macro purchase with a REASON when the rack is full', () => {
        // Ticket 15: "a full rack must refuse a purchase with a reason, not silently drop it." The
        // reducer's refusal is silent by the slice's convention, so the sentence has to be here.
        const run = makeRun(400, { macros: ['surge', 'mend', 'kindle'] });
        const markup = render(run);
        expect(markup).toContain('Rack full');
    });

    it('says which visit this stock belongs to, so a re-roll is legible as a re-entry', () => {
        expect(render(makeRun(400))).toContain('Visit 1');
    });

    it('renders an empty deck and an empty collection without crashing', () => {
        const markup = render(makeRun(50, { deck: [] }));
        expect(markup).toContain('Nothing to sell.');
        expect(markup).toContain('deck: 0 cards');
        expect(markup).toContain('Sell cards (0)');
    });
});
