/**
 * The marketplace, rendered — ticket 13, re-pointed at ticket 63's ruled stall.
 *
 * `engine/run/marketplace.test.ts` covers the prices and the stock; `runSlice.marketplace.test.ts`
 * covers what the buttons do. What is left, and is a different failure, is whether the screen
 * **says** any of it. The screen was rebuilt from scratch against `market_G_stall.html`, so every
 * case below is the old claim re-aimed at the new markup — a tile with a price plate on its face
 * rather than a row with a `Buy — N scrap` label — and three of the claims are inverted, which is
 * the part worth reading before editing anything here:
 *
 * - **The 20–25 target copy is gone, and its test is inverted rather than deleted.** Ticket 13's
 *   Done-when was *"the deck count is visible so the 20-25 target is legible"*, and this file used
 *   to pin the literal `target 20` beside the count. Ticket 61 §5 replaced the aspiration with a
 *   hard floor — `minimumActiveDeck(party)`, 8/13/18 — and the screen now prints that instead. A
 *   floor is the number that actually greys a row out; a target is advice. Printing both would
 *   invite the player to read the advice as the rule, so the case now asserts the band is **absent**
 *   and the floor is present. `DECK_TARGET_MIN`/`MAX` are still re-exported from the module for
 *   `RunSummary`, which is the one screen that scores the deck-building track, so the import stays.
 * - **Every stocked card must print what it does.** This clause was the exact opposite until
 *   2026-08-24 — *"`power` must not appear at all"*, which the screen satisfied by showing no card
 *   text whatsoever. Henry amended the standing law on 2026-08-23 (power stays in card descriptions,
 *   because otherwise cards cannot be compared) and then filed the missing text as a playtest bug:
 *   *"I don't like the marketplace UI. You can't see the card descriptions."* The assertion is
 *   inverted rather than dropped, and it is stricter: it compares the tile's whole `rs-desc` against
 *   the registry string, so a truncated, partial or hover-only implementation fails it.
 * - **"Sell" must APPEAR — priced, and priced under the buy.** Ticket 56 banned selling and this
 *   file pinned the ban by asserting the markup never contained the word; Henry repealed it on
 *   2026-08-26 in the same pass that deleted paid removal, because the run collection makes leaving
 *   the deck free and a sale is now what happens to a card you are never going to play. So the sell
 *   cases are that ban INVERTED: the panel is on screen in every state, every row carries its own
 *   `sellPrice`, and the price sits under what the same card buys for — the no-loop law, visible to
 *   the player.
 *
 * The through-line in all three: the cheap way to break a ruling is a well-meant patch, not a
 * deliberate decision, so a repealed law leaves a test behind facing the other way.
 *
 * Two claims are new with ticket 63 and have no ancestor here. A **sold offer stays on the shelf**,
 * greyed, reading SOLD — *"the greyed gap is what tells you the stock was finite and what you took
 * out of it"* — and **sold is now asked of both piles**, deck and collection, because a bought card
 * lands in the deck and the free editor can move it to the collection a second later. A stall that
 * asked the deck alone would call that offer unsold and sell the same minted instance twice, which
 * is a card duplicated out of nothing.
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
import { createRun, minimumActiveDeck } from '../../engine/run/createRun';
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
import type { IRunCard, IRunState } from '../../engine/runTypes';

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

/** The registry's printed name, read directly rather than through the screen's own `cardFace` —
 *  a test that looked the name up the way the component does could not catch the component looking
 *  it up wrongly. */
const nameOf = (dataId: string): string => ProgramRegistry[dataId]?.name ?? dataId;

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

function render(run: IRunState, biomeName?: string): string {
    const store = configureStore({
        reducer: { run: runReducer },
        preloadedState: { run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return renderToStaticMarkup(
        <Provider store={store}>
            {/*
              * `onEditLoadout` and `onLeave` are required props now (ticket 61 §3: the stall is one
              * of the four doors into the shared editor). Static markup cannot click, so what these
              * fixtures prove is that the two doors are *rendered* as real buttons — `RunScreen`
              * owns where they lead.
              */}
            <MarketplaceNode
                run={run}
                node={node}
                party={RANCH_PARTY}
                biomeName={biomeName}
                onEditLoadout={() => undefined}
                onLeave={() => undefined}
            />
        </Provider>,
    );
}

function stockFor(run: IRunState) {
    return rollMarketStock({ run, node: run.nodes.find((n) => n.id === run.currentNodeId)!, party: RANCH_PARTY });
}

function macrosFor(run: IRunState) {
    return rollMacroStock({ run, node: run.nodes.find((n) => n.id === run.currentNodeId)!, party: RANCH_PARTY });
}

/**
 * The mockup's stall put the price ON the card face, so most of what this file used to assert as a
 * button label (`Buy — 25 scrap`) is now one `<span>` inside a tile that also carries a gem, a
 * banner, a name, the rules text and a tag line. Asserting `markup.toContain('25 scrap')` against that
 * would be a much weaker test than the one it replaces: it would pass for a plate printed on the
 * WRONG tile, or printed twice, or left on a sold tile that should read SOLD.
 *
 * So the markup is parsed back into the tiles and rows it is made of, and the cases assert whole
 * tiles. `[\s\S]*?` up to the first `</button>` is exact rather than approximate here because
 * nothing on this screen nests a control inside a control — which is itself the keyboard law from
 * the screen's header, and `every affordance is a real <button>` below pins it.
 */
interface Tile {
    readonly html: string;
    readonly gem: string;
    readonly banner: string;
    readonly name: string;
    readonly description: string;
    readonly tags: string;
    /** The price plate on the card face: `35 scrap`, `35 scrap · 12 SHORT`, `SOLD`, or `RACK FULL`. */
    readonly plate: string;
    readonly disabled: boolean;
    /** The `sold` class the CSS greys the whole tile with — a state, not just a word on the plate. */
    readonly greyed: boolean;
}

/** The text of the first span whose class attribute matches `classPattern` — a pattern rather than
 *  a literal because several of these classes carry a state suffix (`rs-price sold`, `rs-typ MACRO`). */
const spanText = (html: string, classPattern: string): string => {
    const found = new RegExp(`<span class="${classPattern}">([\\s\\S]*?)</span>`).exec(html);
    return found === null ? '' : found[1];
};

const tilesIn = (markup: string, grid: 'mk-grid' | 'mk-macros' = 'mk-grid'): Tile[] => {
    // The two grids are the same tile markup, so a case about macros has to scope itself to the
    // macro grid or it will happily assert about a card. `mk-macros` is the second grid's extra
    // class; slicing at it splits the stock shelf from the macro shelf.
    const cut = markup.indexOf('mk-macros');
    const scoped = grid === 'mk-macros' ? markup.slice(cut) : markup.slice(0, cut);
    return [...scoped.matchAll(/<button[^>]*class="rs-card[^"]*"[\s\S]*?<\/button>/g)].map(([html]) => ({
        html,
        gem: spanText(html, 'rs-gem'),
        banner: spanText(html, 'rs-typ [A-Z]+'),
        name: spanText(html, 'rs-cnm'),
        description: spanText(html, 'rs-desc'),
        tags: spanText(html, 'rs-tags[^"]*'),
        plate: spanText(html, 'rs-price[^"]*'),
        disabled: /<button[^>]*disabled=""/.test(html),
        greyed: /class="rs-card [^"]*sold/.test(html),
    }));
};

/** One line of the sell panel, as the player reads it: a unique card in one pile. */
interface SellRow {
    readonly name: string;
    /** Every `rs-t` chip on the row — the pile, plus `generic` on the filler. */
    readonly tags: ReadonlyArray<string>;
    /** `×3` when the pile holds three of them; absent markup means one, which is the mockup's rule. */
    readonly count: number;
    readonly price: number;
    readonly disabled: boolean;
}

const rowsIn = (markup: string): SellRow[] =>
    [...markup.matchAll(/<button[^>]*class="rs-row"[\s\S]*?<\/button>/g)].map(([html]) => ({
        name: spanText(html, 'rs-rnm'),
        tags: [...html.matchAll(/<span class="rs-t">([\s\S]*?)<\/span>/g)].map((m) => m[1]),
        count: Number(spanText(html, 'rs-x').replace('×', '') || 1),
        // Ticket 34: the sell plate is `+10 <svg …/>` now, and an SVG path is mostly digits — so the
        // markup is stripped of tags BEFORE the number is read. Reading digits out of raw HTML was
        // safe only while the plate held no elements, which is the sort of assumption a test should
        // not quietly carry.
        price: Number(spanText(html, 'rs-sellp').replace(/<[^>]*>/g, '').replace(/[^\d]/g, '')),
        disabled: /<button[^>]*disabled=""/.test(html),
    }));

/** The reroll chip, which is a filter chip (`rs-f`) rather than a `.btn` so it never competes with
 *  LEAVE. Its label carries the whole of what this file asserts about it. */
const rerollChip = (markup: string): string =>
    /<button[^>]*class="rs-f"[^>]*>([\s\S]*?)<\/button>/.exec(markup)?.[1] ?? '';

/** What the sell panel SHOULD list, derived from the piles rather than from the screen: one entry
 *  per unique dataId per pile, which is Henry's *"one tile per unique card, everywhere"* applied at
 *  render while the run keeps every instance (a sale keys on `instanceId`). */
const expectedStacks = (run: IRunState): Array<{ name: string; pile: string; count: number; price: number }> => {
    const build = (cards: ReadonlyArray<IRunCard>, pile: string) => {
        const byData = new Map<string, number>();
        for (const card of cards) byData.set(card.dataId, (byData.get(card.dataId) ?? 0) + 1);
        return [...byData.entries()].map(([dataId, count]) => ({
            name: nameOf(dataId), pile, count, price: sellPrice(dataId),
        }));
    };
    return [...build(run.deck, 'deck'), ...build(run.collection ?? [], 'collection')];
};

const byName = <T extends { name: string; pile?: string }>(rows: ReadonlyArray<T>): T[] =>
    [...rows].sort((a, b) => `${a.pile ?? ''}${a.name}`.localeCompare(`${b.pile ?? ''}${b.name}`));

describe('MarketplaceNode', () => {
    it('shows the scrap balance and the deck floor, both readable at a glance', () => {
        // Two numbers, and the screen is illegible without either: scrap is the only currency here
        // and every button on the stall changes it, and the floor is the number that decides whether
        // a sell row is alive. The scrap readout carries `aria-label="Scrap held"` because the icon
        // is a glyph a screen reader cannot name — ticket 38's standing concern.
        const run = makeRun(140);
        const markup = render(run);
        const floor = minimumActiveDeck(run.partyIds.length);

        // Ticket 34: the scrap glyph is an inline SVG now (it was `\u26C1`, which is a tofu box on
        // several Linux font stacks). The `aria-label` matters MORE for the same reason it always
        // did — an icon reads as nothing aloud — so that is what this pins, plus a drawn icon.
        expect(markup).toContain('<span class="rs-scrap" aria-label="Scrap held">140 <svg');
        expect(markup).toContain(`DECK <b>${run.deck.length}</b> / floor ${floor}`);
        // And the floor is READ from the party, not written down: `minimumActiveDeck` is 3 + 5 per
        // member, so a second member moves the pill to 13. A hard-coded 8 would pass the line above
        // and fail every run with a recruit in it.
        expect(floor).toBe(8);
        expect(render(makeRun(140, { partyIds: ['mm1', 'mm2'] })))
            .toContain(`/ floor ${minimumActiveDeck(2)}`);
    });

    it('no longer prints the 20–25 deck target, because a floor replaced it', () => {
        /*
         * THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is ticket 61 §5's.
         *
         * It read *"shows the scrap balance and the deck count with the 20–25 target beside it"* and
         * pinned `target 20` and the literal `12 short` advice line, on the strength of ticket 13's
         * Done-when: *"the deck count is visible so the 20-25 target is legible."* The band is not
         * the rule any more. `minimumActiveDeck` is enforced — the editor and this panel both grey
         * rows out at it — and an aspiration printed beside an enforced minimum is read as the
         * enforced number by whoever is holding the controller.
         *
         * So the case is inverted rather than deleted, which is this file's habit for a repealed
         * law: the band must be ABSENT from the surface, and the constants must still be importable,
         * because `RunSummary` quotes them where the deck-building track is finally scored. Deleting
         * the case outright would leave nothing to fail when someone helpfully puts the target back.
         */
        const run = makeRun(140);
        const markup = render(run);

        expect(typeof DECK_TARGET_MIN).toBe('number');
        expect(typeof DECK_TARGET_MAX).toBe('number');
        expect(markup).not.toContain(`target ${DECK_TARGET_MIN}`);
        expect(markup).not.toContain(`${DECK_TARGET_MIN}–${DECK_TARGET_MAX}`);
        expect(markup).not.toContain(`${DECK_TARGET_MIN}-${DECK_TARGET_MAX}`);
        // The two lines of advice the band used to generate are gone with it. `Pay to remove` names
        // a verb that no longer exists at all (Henry deleted paid removal on 2026-08-26), and
        // `12 short` counted the deck towards an aspiration.
        expect(markup).not.toContain('Pay to remove');
        expect(markup).not.toContain(`${DECK_TARGET_MIN - run.deck.length} short`);
        // What stands in its place, in the pill the CSS reddens at the limit.
        expect(markup).toContain(`floor ${minimumActiveDeck(run.partyIds.length)}`);
    });

    it('prints what every stocked card DOES, in full, not just what it costs', () => {
        /*
         * THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is Henry's.
         *
         * It read: *"never prints the word 'power' anywhere on the surface — power is an internal
         * balance instrument. This is the test that catches a 'show the card description' patch,
         * not just a price mistake."* It did its job: the screen shipped with no card text, and 142
         * of 216 descriptions quote a power figure, so printing them would have failed it.
         *
         * Then Henry amended the standing law (2026-08-23): *"we need power in the card descriptions
         * otherwise you can't compare cards in the deck builder."* Power dies at the surface still
         * governs the FIGHT, where a preview must show true numbers rather than printed ones — see
         * `damagePreview.ts`. A shop is a comparison screen, and withholding the rules text there is
         * what the 2026-08-24 playtest reported as a bug.
         *
         * The inverted assertion is stronger than a `toContain` on each string, because ticket 63's
         * tile has a fixed height and the tempting patch is a truncation: the tile's WHOLE `rs-desc`
         * is compared against the registry's whole description, so an ellipsis fails it.
         */
        const run = makeRun(400);
        const stock = stockFor(run);
        const tiles = tilesIn(render(run));

        expect(tiles).toHaveLength(stock.offers.length);
        stock.offers.forEach((offer, i) => {
            const description = ProgramRegistry[offer.card.dataId]?.description ?? '';
            expect(description).not.toBe('');
            expect([offer.card.dataId, tiles[i].description]).toEqual([offer.card.dataId, escapeHtml(description)]);
        });
    });

    it('offers the rolled stock as one real tile each, with the off-pool slot marked', () => {
        const run = makeRun(400);
        const stock = stockFor(run);
        const tiles = tilesIn(render(run));

        stock.offers.forEach((offer, i) => {
            // Name, cost gem and banner are the mockup's three identifiers, and the price plate is
            // the affordance's whole label — there is no `Buy —` verb on a stall tile, because the
            // tile IS the button.
            expect(tiles[i].name).toBe(nameOf(offer.card.dataId));
            expect(tiles[i].plate).toBe(`${offer.price} scrap`);
            expect(tiles[i].disabled).toBe(false);
            expect(['ATTACK', 'SKILL', 'DAEMON']).toContain(tiles[i].banner);
        });
        // The off-pool slot is the one row with news in it (`MARKET_WILDCARD_SLOTS`): the player is
        // meant to SEE something arrive from outside their party's lists, so the tag is counted
        // against the roll rather than merely looked for.
        expect(tiles.filter((t) => t.tags === 'off-pool')).toHaveLength(
            stock.offers.filter((o) => o.wildcard).length,
        );
    });

    it('disables what the player cannot afford AND says what they are short', () => {
        // Ticket 20's precedent, which this screen's header restates: a disabled control says what
        // it is short of, because a silently inert button is indistinguishable from a bug to
        // whoever is holding the controller. At zero scrap every plate on the stall owes the player
        // a number, and the shortfall is the price itself.
        const run = makeRun(0);
        const stock = stockFor(run);
        const markup = render(run);
        const tiles = tilesIn(markup);

        stock.offers.forEach((offer, i) => {
            expect(tiles[i].plate).toBe(`${offer.price} scrap · ${offer.price} SHORT`);
            expect(tiles[i].disabled).toBe(true);
        });
        // The reroll owes the same explanation, and it is the one control on the screen that buys
        // nothing but a new set of choices, so a silent dead chip there is the easiest to miss.
        expect(rerollChip(markup)).toBe(`REROLL ${REROLL_PRICE} scrap — ${REROLL_PRICE} SHORT`);
        expect(markup).toContain(`<button type="button" class="rs-f" disabled="">REROLL ${REROLL_PRICE} scrap`);
        // The sell rows are the one thing on this screen a broke player can still use, and that is
        // the point of them: a sale is never short of anything. This line used to assert a disabled
        // `Remove (20) — 20 short`, which was the same screen charging the player to tidy up.
        expect(rowsIn(markup).every((row) => row.price > 0)).toBe(true);
    });

    it('offers the reroll at its ruled price once the player can pay it', () => {
        // The chip is not in the mockup and is kept deliberately (see the screen's comment on it):
        // `rerollMarketStock` buys exactly the visit-increment that walking out and back in buys, so
        // without it the context line's "stock re-rolls each visit" is a claim with no reachable
        // second visit at a dead-end market.
        expect(rerollChip(render(makeRun(REROLL_PRICE)))).toBe(`REROLL STOCK — ${REROLL_PRICE} scrap`);
    });

    it('leaves a sold offer on the shelf, greyed and reading SOLD, rather than letting it be bought twice', () => {
        // Ticket 63, ruled: *"a SOLD card stays on the shelf — the greyed gap is what tells you the
        // stock was finite and what you took out of it. A vanished card reads as a bug."* So the
        // count of tiles is part of the assertion: a stall that filtered the offer out would still
        // satisfy "cannot be bought twice" and would be exactly the regression the ruling names.
        const run = makeRun(400);
        const bought = stockFor(run).offers[0];
        const tiles = tilesIn(render({ ...run, deck: [...run.deck, bought.card] }));

        expect(tiles).toHaveLength(stockFor(run).offers.length);
        expect(tiles[0].name).toBe(nameOf(bought.card.dataId));
        expect(tiles[0].plate).toBe('SOLD');
        expect(tiles[0].greyed).toBe(true);
        expect(tiles[0].disabled).toBe(true);
        // And only that one: the shelf is finite, not closed. Every other tile is still buyable at
        // 400 scrap, which is what makes the grey gap read as "you took that one".
        expect(tiles.slice(1).every((t) => !t.disabled && !t.greyed)).toBe(true);
    });

    it('counts a card the player moved to the COLLECTION as sold, not as unsold stock', () => {
        /*
         * THE NEW CLAUSE IN `isOfferSold`, AND THE DUPLICATION BUG IT EXISTS TO PREVENT.
         *
         * "Sold" is derived, not stored — an offer's `instanceId` is a pure function of the run
         * seed, the node and the visit count, which is what lets a sold-out slot survive a resume
         * without a new field in the ratified run shape. Until ticket 61 it was derived from the
         * DECK alone, which was exact while the deck was the only place a card could be.
         *
         * It is not any more. A bought card lands in the active deck (ticket 63, ruled: *"a bought
         * card goes straight to the active deck, always"*) and the free editor can move it to the
         * run collection a second later. Asked about the deck alone, the stall would then call the
         * offer unsold and sell the same minted instance a SECOND time — a card duplicated out of
         * nothing, and a real cards-for-scrap farm rather than the drain the no-loop law allows.
         *
         * The fixture is that exact sequence, and the assertion that the deck does NOT hold the
         * instance is load-bearing: without it the case would pass against the old deck-only rule.
         */
        const run = makeRun(400);
        const bought = stockFor(run).offers[0];
        const moved = { ...run, collection: [bought.card] };

        expect(moved.deck.some((c) => c.instanceId === bought.card.instanceId)).toBe(false);

        const tiles = tilesIn(render(moved));
        expect(tiles[0].plate).toBe('SOLD');
        expect(tiles[0].disabled).toBe(true);
        expect(tiles[0].greyed).toBe(true);
    });

    /**
     * TICKET 15 RETIRED THE PLACEHOLDER THIS TEST USED TO PIN.
     *
     * Ticket 13 left a marked slot here and this case asserted the marker said "ticket 15" — a test
     * whose whole job was to fail the day the feature arrived. It has arrived, so the case asserts
     * the real shelf: the rolled stock, at the ruled prices, with a real tile each.
     * `marketplace.macros.test.ts` owns the prices themselves; what is checked here is that the
     * screen prints the same number the reducer will charge, and that macros are legible AS macros —
     * they are bought into `IRunState.macros`, never into the deck, so a tile that looked like a card
     * tile would be promising the wrong thing.
     */
    it('stocks macros at the ruled price, one real tile each, banded apart from the cards', () => {
        const run = makeRun(400);
        const macros = macrosFor(run);
        const markup = render(run);
        const tiles = tilesIn(markup, 'mk-macros');

        expect(macros.length).toBeGreaterThan(0);
        expect(tiles).toHaveLength(macros.length);
        macros.forEach((offer, i) => {
            expect(tiles[i].name).toBe(MacroRegistry[offer.macroId].name);
            expect(tiles[i].description).toBe(escapeHtml(MacroRegistry[offer.macroId].description));
            expect(tiles[i].plate).toBe(`${offer.price} scrap`);
            expect(tiles[i].disabled).toBe(false);
            // The banner and the `◈` gem are the whole of what distinguishes a macro tile from a
            // card tile at a glance — a macro has no energy cost to print in the gem, because it is
            // fired free on your turn.
            expect(tiles[i].banner).toBe('MACRO');
            expect(tiles[i].gem).toBe('◈');
            expect(offer.price).toBe(macroPrice(offer.macroId));
        });
        // The rack is the brake on buying them, so the rack's state is on the shelf's own heading.
        expect(markup).toContain(`MACROS · ${MACRO_SLOTS}/${MACRO_SLOTS} slots free`);
    });

    it('refuses a macro purchase with a REASON when the rack is full', () => {
        // Ticket 15: *"a full rack must refuse a purchase with a reason, not silently drop it."* The
        // reducer's refusal is silent by the slice's convention — a reducer has no error channel —
        // so the sentence has to be here, on the dead tile itself, where the player is pressing.
        const run = makeRun(400, { macros: ['surge', 'mend', 'kindle'] });
        const markup = render(run);
        const tiles = tilesIn(markup, 'mk-macros');

        expect(tiles.length).toBeGreaterThan(0);
        expect(tiles.every((t) => t.plate === 'RACK FULL')).toBe(true);
        expect(tiles.every((t) => t.disabled)).toBe(true);
        expect(markup).toContain(`MACROS · 0/${MACRO_SLOTS} slots free`);
    });

    it('lists the deck AND the collection under one sell header, one row per unique card per pile', () => {
        // Ticket 57 replaced this case's per-row sale with a removal price; the 2026-08-26 amendment
        // puts the sale back and widens the list, because *"a card you will never play is the same
        // card whether you already moved it out of the deck or not."* A screen that listed only the
        // deck would make the player edit a card back IN in order to sell it.
        //
        // One header, two tags — not two sections. The same card pays the same either way, so a
        // split list would tell the player the pile mattered to the price. It matters only to the
        // floor, which is why the pile is a tag on the row.
        const collection = [
            { instanceId: 'stored_1', dataId: 'hydro_blast', ownerId: null },
            { instanceId: 'stored_2', dataId: GENERIC_HIT, ownerId: null },
        ];
        const run = makeRun(400, { collection });
        const markup = render(run);
        const rows = rowsIn(markup);

        expect(markup).toContain('SELL — YOUR CARDS');
        expect(markup).toContain('(deck + collection)');
        // The whole list, compared as a whole: names, piles, ×N counts and prices together. A list
        // that rendered the deck twice, dropped the collection, or grouped ACROSS the two piles
        // would still contain every word this case names, and would fail this line.
        expect(byName(rows.map((r) => ({
            name: r.name,
            pile: r.tags.includes('deck') ? 'deck' : 'collection',
            count: r.count,
            price: r.price,
        })))).toEqual(byName(expectedStacks(run)));
        // And the stacking is real: the starter's three generics are ONE row reading ×3, not three
        // rows — Henry's *"one tile per unique card, everywhere"* — while a single copy prints no
        // count at all, because `×1` on every other row is noise.
        const generics = rows.filter((r) => r.name === nameOf(GENERIC_HIT) && r.tags.includes('deck'));
        expect(generics).toHaveLength(1);
        expect(generics[0].count).toBe(run.deck.filter((c) => c.dataId === GENERIC_HIT).length);
        expect(generics[0].count).toBeGreaterThan(1);
        expect(markup.match(/class="rs-x"/g)).toHaveLength(rows.filter((r) => r.count > 1).length);
    });

    it('prices every sell row at sellPrice, strictly under what the same card buys for', () => {
        // The no-loop law, as the player can read it off the screen: *"prices must not be farmable
        // to zero"* (Henry, 2026-08-21). `marketplace.test.ts` proves it of the tables; this proves
        // the screen prints the paying half of that pair and not the charging half, on real cards.
        // The failure mode is a row wired to the wrong price function, which is invisible until
        // someone farms it.
        const collection = [{ instanceId: 'stored_1', dataId: 'hydro_blast', ownerId: null }];
        const run = makeRun(400, { collection });
        const markup = render(run);
        const rows = rowsIn(markup);

        const priceByName = new Map(rows.map((r) => [r.name, r.price]));
        for (const card of [...run.deck, ...collection]) {
            const paid = sellPrice(card.dataId);
            expect(paid).toBeLessThan(cardPrice(card.dataId));
            expect(priceByName.get(nameOf(card.dataId))).toBe(paid);
        }
        // Every printed number is on the ruled sell table and never on the buy table — the check
        // that survives a fixture whose cards happen to sit on one rung.
        for (const row of rows) expect(SELL_PRICE_BY_ENERGY).toContain(row.price);
        // The band is printed as well as applied, so the player can price a card they are not
        // looking at, and it is printed AGAINST the buy band, rung by rung, which is the law itself
        // rather than a claim about it.
        expect(markup).toContain(`Sell ${SELL_PRICE_BY_ENERGY.join('/')} by cost against buy ${CARD_PRICE_BY_ENERGY.join('/')}`);
        SELL_PRICE_BY_ENERGY.forEach((paid, energy) => {
            expect([energy, paid < CARD_PRICE_BY_ENERGY[energy]]).toEqual([energy, true]);
        });
    });

    it('kills the deck rows at the floor while the collection rows stay live', () => {
        /*
         * THE FLOOR IS THE ONE PLACE THE TWO PILES DIFFER, AND IT IS WHY THE PILE IS A TAG.
         *
         * `minimumActiveDeck` (3 + 5 a member) is enforced, not advised: a deck at the floor cannot
         * be sold below it, or the player would trade themselves into a run they cannot legally
         * field. The collection has no floor — nothing is played out of it — so those rows must stay
         * live in exactly the state that kills the deck rows. A screen that greyed the whole panel
         * would be the obvious wrong fix, and it is the one this case exists to catch, which is why
         * both halves are asserted in the SAME render.
         *
         * The fixture's solo run opens AT its floor: 5 tagged kit cards plus the starter's 3
         * generics (Henry, 2026-08-26) is 8, and `minimumActiveDeck(1)` is 8. That coincidence is
         * the real opening state of every run, not a contrivance — the first stall genuinely cannot
         * buy scrap with deck cards.
         */
        const collection = [{ instanceId: 'stored_1', dataId: 'hydro_blast', ownerId: null }];
        const atFloor = makeRun(400, { collection });
        expect(atFloor.deck).toHaveLength(minimumActiveDeck(atFloor.partyIds.length));

        const rows = rowsIn(render(atFloor));
        expect(rows.filter((r) => r.tags.includes('deck')).every((r) => r.disabled)).toBe(true);
        expect(rows.filter((r) => r.tags.includes('collection')).every((r) => !r.disabled)).toBe(true);
        // And the panel says WHY, rather than leaving a wall of dead rows to be read as a bug —
        // ticket 20's precedent again, applied to a refusal that is about the deck's size instead of
        // the player's purse.
        expect(render(atFloor)).toContain(`At the floor (${minimumActiveDeck(1)})`);

        // One card above the floor, the same rows are alive. Without this half the case would pass
        // against a panel whose deck rows were disabled unconditionally.
        const spare = makeRun(400, {
            collection,
            deck: [...atFloor.deck, { instanceId: 'spare_1', dataId: GENERIC_HIT, ownerId: null }],
        });
        expect(rowsIn(render(spare)).every((r) => !r.disabled)).toBe(true);
    });

    it('tags the generic filler, in the deck and in the collection alike', () => {
        // Henry, 2026-08-21: the start-deck generics are the cards this panel is most often pointed
        // at, so the screen tags them rather than leaving the player to recognise "Tackle" on sight.
        // The count is read off the piles rather than written down — it was three a member under
        // ticket 08, two a member under ticket 60, and is three for the whole run since the STARTER
        // took the allowance — and the claim that survives all of them is this one: every generic
        // ROW is tagged (one row per pile, because the rows stack per pile), and nothing else is.
        const collection = [
            { instanceId: 'stored_1', dataId: GENERIC_HIT, ownerId: null },
            { instanceId: 'stored_2', dataId: 'hydro_blast', ownerId: null },
        ];
        const run = makeRun(400, { collection });
        const rows = rowsIn(render(run));

        const tagged = rows.filter((r) => r.tags.includes('generic'));
        expect(tagged.map((r) => r.name)).toEqual([nameOf(GENERIC_HIT), nameOf(GENERIC_HIT)]);
        expect(tagged.map((r) => (r.tags.includes('deck') ? 'deck' : 'collection')).sort())
            .toEqual(['collection', 'deck']);
        expect(rows.filter((r) => r.name !== nameOf(GENERIC_HIT)).some((r) => r.tags.includes('generic')))
            .toBe(false);
    });

    it('says which biome and which visit this stock belongs to, so a re-roll reads as a re-entry', () => {
        // The stock is a pure function of (run seed, node id, visit count), so "the shelf changed"
        // and "you are standing here again" are the same event. If the screen did not print the
        // visit, a player who rerolled and a player who walked back in would see the same unexplained
        // new stock. The biome is in the same line because what a party pool is worth depends on it.
        const run = makeRun(400);
        expect(render(run, 'Cinder Flats')).toContain('CINDER FLATS BIOME · VISIT 1 · stock re-rolls each visit');

        // A second visit says two, which is what makes the number a fact about the node rather than
        // a decoration: `nodeSeed` reads exactly this counter.
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const returned = {
            ...run,
            nodes: run.nodes.map((n) => (n.id === node.id ? { ...n, visited: n.visited + 1 } : n)),
        };
        expect(render(returned)).toContain('VISIT 2');
        // The optional prop's fallback still produces a sentence rather than an empty word — the
        // biome name is `RunScreen`'s to supply and a debug or test mount may not have one.
        expect(render(run)).toContain('THIS BIOME · VISIT 1');
    });

    it('renders an empty deck and an empty collection without crashing', () => {
        // Reachable, not hypothetical: a player can move their whole deck to the collection in the
        // editor and walk in here, and the sell panel is always visible, so it has to have an empty
        // state rather than a hole. The pill still prints the floor it is under, which is the only
        // screen telling that player they cannot start the next fight.
        const markup = render(makeRun(50, { deck: [], collection: [] }));

        expect(markup).toContain('Nothing to sell.');
        expect(rowsIn(markup)).toHaveLength(0);
        expect(markup).toContain(`DECK <b>0</b> / floor ${minimumActiveDeck(1)}`);
        // The stall itself is unaffected — an empty deck is not an empty shop, and 50 scrap still
        // buys the cheap rung.
        expect(tilesIn(markup).length).toBeGreaterThan(0);
    });

    it('makes every affordance a real <button>', () => {
        // The standing keyboard law, ticket 38: `RegionMap`'s travel list set the precedent and
        // ticket 38 inherits screens that already work without a mouse rather than screens that need
        // retrofitting. The stall's card TILE is the tempting exception — it looks like art, and the
        // mockup draws it as a panel — which is why it carries `text-align: center` in CSS instead of
        // inheriting a div's. The count is exact rather than a lower bound: a control added without
        // a `<button>` under it fails here, and so does one added as a div beside the real ones.
        const collection = [{ instanceId: 'stored_1', dataId: 'hydro_blast', ownerId: null }];
        const run = makeRun(400, { collection });
        const markup = render(run);

        const offers = stockFor(run).offers.length;
        const macros = macrosFor(run).length;
        const rows = rowsIn(markup).length;
        // Every tile, every macro, every sell row, the reroll chip, EDIT LOADOUT and LEAVE.
        expect(markup.match(/<button/g)).toHaveLength(offers + macros + rows + 3);
        // And each of the four affordance classes appears ONLY on a button — the check that catches
        // a `<div class="rs-row">` that looks and styles identically and cannot be tabbed to.
        for (const cls of ['rs-card', 'rs-row', 'rs-f', 'rs-btn']) {
            const all = markup.match(new RegExp(`class="${cls}`, 'g'))?.length ?? 0;
            const onButtons = markup.match(new RegExp(`<button[^>]*class="${cls}`, 'g'))?.length ?? 0;
            // Both counts, not just their equality: `undefined === undefined` would let a class that
            // vanished from the screen entirely pass this loop silently.
            expect([cls, all, onButtons]).toEqual([cls, onButtons, onButtons]);
            expect(onButtons).toBeGreaterThan(0);
        }
    });

    it('puts EDIT LOADOUT and LEAVE on the top bar as real buttons', () => {
        // Ticket 61 §3: the stall is one of the four doors into the shared `LoadoutEditor`, and it
        // is the door that matters most, because *"a player deciding whether 35 scrap is worth it is
        // deciding it against what they could sell to raise it"* — a decision that needs the deck.
        // LEAVE is the other half: `RunScreen` treats leaving a node as a UI state rather than a
        // move, so if the button is missing the player is standing in a shop they cannot exit.
        const markup = render(makeRun(400));

        expect(markup).toContain('<button type="button" class="rs-btn">EDIT LOADOUT</button>');
        expect(markup).toContain('<button type="button" class="rs-btn primary">LEAVE</button>');
        expect(markup).toContain('<span class="rs-title">MARKETPLACE</span>');
    });
});
