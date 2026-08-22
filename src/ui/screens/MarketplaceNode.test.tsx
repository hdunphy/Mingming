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
 * - **`power` must not appear at all** (standing law, map § Notes). The cheapest way to break that is
 *   not a price — it is a well-meant "show the card text" patch, since several card descriptions
 *   quote the internal number out loud (`water_slap`: "priced at 12 power to compensate").
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
import { REMOVAL_PRICE, REROLL_PRICE, rollMarketStock } from '../../engine/run/marketplace';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

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
        // The start deck is 8 cards, so the first market's advice is "buy".
        const short = render(makeRun(140));
        expect(short).toContain(`${DECK_TARGET_MIN - 8} short`);

        const run = makeRun(140);
        const bloated = render({ ...run, deck: [...run.deck, ...Array.from({ length: 20 }, (_, i) => ({
            instanceId: `extra_${i}`, dataId: GENERIC_HIT, ownerId: null,
        })) ] });
        expect(bloated).toContain('over. Sell or remove.');
    });

    it('never prints the word “power” anywhere on the surface', () => {
        // Standing law (map § Notes): power is an internal balance instrument. This is the test that
        // catches a "show the card description" patch, not just a price mistake.
        expect(render(makeRun(400))).not.toMatch(/power/i);
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

    it('lists every deck card with a sell price and a removal price', () => {
        const run = makeRun(400);
        const markup = render(run);

        expect(markup).toContain(`Your deck (${run.deck.length})`);
        expect(markup.match(/Sell — \+/g)?.length).toBe(run.deck.length);
        expect(markup.match(new RegExp(`Remove — ${REMOVAL_PRICE} scrap`, 'g'))?.length).toBe(run.deck.length);
    });

    it('tags the generic filler, because it is what removal is for', () => {
        // Henry, 2026-08-21. The three start-deck generics are the sink's stated target, so the
        // screen points at them rather than leaving the player to recognise "Tackle" on sight.
        const run = makeRun(400);
        const markup = render(run);
        expect(markup.match(/generic filler<\/span>/g)?.length)
            .toBe(run.deck.filter((c) => c.dataId === GENERIC_HIT).length);
    });

    it('leaves a marked slot for macros, naming ticket 15', () => {
        expect(render(makeRun(400))).toContain('ticket 15');
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
