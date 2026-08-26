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
 * - **and, since ticket 57, "sell" must not appear either.** Henry ruled (ticket 56) that cards
 *   cannot be sold — removal is a pure sink, the market takes scrap and never gives it. That is a
 *   *design ruling*, and a screen that merely happens to have no sell button today obeys it without
 *   pinning it, so `offers no way at all to sell a card` asserts the absence directly. It is the same
 *   shape of test as the `power` one above and it exists for the same reason: the cheap way to break
 *   the rule is a well-meant patch, not a deliberate decision.
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
import { REMOVAL_PRICE, REROLL_PRICE, macroPrice, rollMacroStock, rollMarketStock } from '../../engine/run/marketplace';
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
        // A solo run opens at ticket 60's six — 4 tagged kit cards + 2 generics, down from the 5 + 3
        // that made it 8 — so the first market's advice is "buy", and it is 14 short rather than 12.
        const run = makeRun(140);
        expect(run.deck).toHaveLength(6);

        const short = render(run);
        // Derived from the deck the screen was actually handed, then pinned as the literal the
        // player reads: the shortfall is arithmetic, but 14 is what the first stall will say.
        expect(short).toContain(`${DECK_TARGET_MIN - run.deck.length} short`);
        expect(short).toContain('14 short');

        const bloated = render({ ...run, deck: [...run.deck, ...Array.from({ length: 20 }, (_, i) => ({
            instanceId: `extra_${i}`, dataId: GENERIC_HIT, ownerId: null,
        })) ] });
        // Ticket 57: this line used to read "over. Sell or remove." Removal is the only way down
        // since Henry's ticket-56 ruling, so the advice names the one verb that exists.
        expect(bloated).toContain('over. Pay to remove.');
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
        expect(markup).toContain(`Remove (${REMOVAL_PRICE}) — ${REMOVAL_PRICE} short`);
        expect(markup).toContain(`Reroll (${REROLL_PRICE}) — ${REROLL_PRICE} scrap short`);
        expect(markup).not.toContain(`Buy — `);
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

    it('lists every deck card with a removal price', () => {
        // Ticket 57 dropped this case's companion assertion — one `Sell — +N` per row. Henry ruled
        // cards cannot be sold (ticket 56), so a deck row now offers exactly one action, and the
        // count below is the whole of it.
        const run = makeRun(400);
        const markup = render(run);

        expect(markup).toContain(`Your deck (${run.deck.length})`);
        expect(markup.match(new RegExp(`Remove — ${REMOVAL_PRICE} scrap`, 'g'))?.length).toBe(run.deck.length);
    });

    it('offers no way at all to sell a card — removal is a pure sink', () => {
        // HENRY, TICKET 56: "Cards cannot be sold — removal is a pure sink." Ticket 57 removed the
        // sell button, its price and its copy; this pins the ruling rather than trusting the screen
        // to keep obeying it, exactly as the `power` case above pins the surface law.
        //
        // Asserted as an absence over the whole markup, not as "the button is gone": a sell control
        // could come back as a differently-worded button, a buy-back price in a row, or an "over
        // target — sell some" nudge in the advice line, and any of those is the same broken rule. The
        // states are the ones where a sell affordance would plausibly be reintroduced — a normal
        // shop, a player with no scrap (where "you could always sell something" is the tempting
        // patch), a deck well over target, and an empty deck.
        const rich = makeRun(400);
        const broke = makeRun(0);
        const bloated = makeRun(400);

        const markups = [
            render(rich),
            render(broke),
            render({ ...bloated, deck: [...bloated.deck, ...Array.from({ length: 20 }, (_, i) => ({
                instanceId: `extra_${i}`, dataId: GENERIC_HIT, ownerId: null,
            })) ] }),
            render(makeRun(400, { deck: [] })),
        ];

        for (const markup of markups) {
            expect(markup).not.toMatch(/sell/i);
        }
    });

    it('tags the generic filler, because it is what removal is for', () => {
        // Henry, 2026-08-21. The three start-deck generics are the sink's stated target, so the
        // screen points at them rather than leaving the player to recognise "Tackle" on sight.
        const run = makeRun(400);
        const markup = render(run);
        expect(markup.match(/generic filler<\/span>/g)?.length)
            .toBe(run.deck.filter((c) => c.dataId === GENERIC_HIT).length);
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

    it('renders an empty deck without crashing', () => {
        const markup = render(makeRun(50, { deck: [] }));
        expect(markup).toContain('No cards');
        expect(markup).toContain('deck: 0 cards');
    });
});
