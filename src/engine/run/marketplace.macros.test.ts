/**
 * MACROS ON THE SHELF — ticket 15, filling the slot ticket 13 marked, repriced by ticket 57.
 *
 * Kept in its own file rather than appended to `marketplace.test.ts` so that the card prices and the
 * card stock stay one diff away from the macro shelf, in both directions.
 *
 * Three claims, each of which can be false without anything crashing:
 *
 * - **The ruled price is 32/48, and it is NO LONGER a function of the card table.** Ticket 15
 *   *computed* *"full 1e-card value, rares 1.5x"* off ticket 13's table so a card retune would carry
 *   the macros with it. Ticket 56 broke that: a 1-energy card now costs **25**, and Henry ruled the
 *   collision explicitly — *"Macro prices keep the older 'full 1e-card value' ruling — commons 32,
 *   rares 48 — superseding this ticket's 25/40."* So the derivation is cut on purpose, and the test
 *   below is the one that fails if anyone re-derives it: a re-derivation produces 25 and 37 today,
 *   and silently overturns the ruling that won.
 * - **The macro shelf and the card shelf cannot shift each other.** They are separate forks of one
 *   node seed; without the split, shipping ticket 15 would have silently re-rolled every card stock
 *   in every saved run.
 * - **`power` does not reach a macro price either.** The whole price is a function of one boolean
 *   (is it a rare), which is the strongest possible form of that law.
 */

import { describe, expect, it } from 'vitest';

import {
    CARD_PRICE_BY_ENERGY,
    MACRO_PRICE_RARE,
    MACRO_PRICE_STANDARD,
    MACRO_STOCK_SIZE,
    cardPrice,
    macroPrice,
    rollMacroStock,
    rollMarketStock,
} from './marketplace';
import { createRun } from './createRun';
import { offerGyms } from './gyms';
import { MACRO_IDS, MacroRegistry } from '../data/macroRegistry';
import type { IMingmingState } from '../types';
import type { IRegionNode, IRunState } from '../runTypes';

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});

const SOLO = [member('mm1', 'kraken', 'kraken_v1')];

function makeRun(seed = 'macro-market-run'): IRunState {
    return createRun({ seed, offer: offerGyms('offer-seed')[0], party: SOLO, startedAt: 1_700_000_000_000 });
}

const RUN = makeRun();
const MARKETS = RUN.nodes.filter((n) => n.kind === 'marketplace');
const visited = (node: IRegionNode, visit: number): IRegionNode => ({ ...node, visited: visit });
const MARKET = visited(MARKETS[0], 1);

const macrosAt = (node: IRegionNode, run = RUN) => rollMacroStock({ run, node, party: SOLO });

// =================================================================================================
// The ruled price
// =================================================================================================

describe('macro prices are Henry’s ruled 32 and 48, and are no longer a function of the card table', () => {
    it('charges 32 for a standard macro and 48 for a rare one', () => {
        // The two ruled literals, quoted rather than computed — see this file's header for why the
        // computation had to go. Written out here as numbers so that editing the constants means
        // editing a restatement of the ruling too.
        expect(MACRO_PRICE_STANDARD).toBe(32);
        expect(MACRO_PRICE_RARE).toBe(48);
        for (const id of MACRO_IDS) {
            const expected = MacroRegistry[id].rarity === 'Rare' ? 32 * 1.5 : 32;
            expect([id, macroPrice(id)]).toEqual([id, expected]);
        }
    });

    it('keeps the RULED 1.5x between the tiers, which survived the reprice intact', () => {
        // *"full 1e-card value, rares 1.5x"* — ticket 56 overturned what the base is quoted against,
        // not the ratio on top of it, so the ratio is still asserted as a relation and not as 48.
        expect(MACRO_PRICE_RARE).toBe(MACRO_PRICE_STANDARD * 1.5);
    });

    it('is NOT what re-deriving it from the card table would produce — the ticket 57 collision', () => {
        // THE test this file exists for. Ticket 15 computed the standard price as "full 1e-card
        // value" off ticket 13's table; the same computation on ticket 56's table yields 25, and
        // 1.5x of that yields 37. Henry ruled that the macro numbers win the disagreement, so a
        // future tidy-up that restores the derivation must fail here rather than quietly reprice
        // every macro in the game downward by a fifth.
        const ifReDerived = CARD_PRICE_BY_ENERGY[1];                 // "full 1e-card value" = 25
        const ifReDerivedRare = Math.floor(ifReDerived * 1.5);       // 37
        expect(ifReDerived).toBe(25);
        expect(MACRO_PRICE_STANDARD).not.toBe(ifReDerived);
        expect(MACRO_PRICE_RARE).not.toBe(ifReDerivedRare);
        // Stronger, and independent of which rung a derivation would pick: neither macro price is a
        // card price at all. Nothing in the card table can be tuned into 32 or 48 by accident.
        expect(CARD_PRICE_BY_ENERGY).not.toContain(MACRO_PRICE_STANDARD);
        expect(CARD_PRICE_BY_ENERGY).not.toContain(MACRO_PRICE_RARE);
    });

    it('is a function of the rarity tier and NOTHING else', () => {
        // The behavioural form of "power dies at the surface", and of "no per-macro price table":
        // every macro of a tier prices identically, however far apart their effects are. Surge is a
        // damage burst and Salve is three Regen; they cost the same because they are the same tier.
        const standard = new Set(MACRO_IDS.filter((id) => MacroRegistry[id].rarity !== 'Rare').map(macroPrice));
        const rare = new Set(MACRO_IDS.filter((id) => MacroRegistry[id].rarity === 'Rare').map(macroPrice));
        expect(standard.size).toBe(1);
        expect(rare.size).toBe(1);
    });

    it('prices an unknown id as a standard macro rather than NaN', () => {
        expect(macroPrice('no_such_macro')).toBe(MACRO_PRICE_STANDARD);
    });

    it('costs more than most of the shelf and less than the dearest card — the trade the slot presents', () => {
        // The shape the reprice was meant to keep: a macro is a considered purchase rather than
        // spare change, so a standard one outprices every card up to and including the 1-energy
        // rung (25) — but it is not the dearest thing at the stall, or "a card or a macro" would
        // stop being a live question at every visit.
        expect(macroPrice('surge')).toBeGreaterThan(cardPrice('water_slap'));
        expect(macroPrice('surge')).toBeGreaterThan(CARD_PRICE_BY_ENERGY[1]);
        expect(macroPrice('surge')).toBeLessThan(Math.max(...CARD_PRICE_BY_ENERGY));
        // A rare macro is dearer than any single card, which is what "most of a market visit" means
        // at ticket 56's income — and it is the only thing on the stall that is.
        expect(macroPrice('revive')).toBeGreaterThan(Math.max(...CARD_PRICE_BY_ENERGY));
    });
});

// =================================================================================================
// The shelf
// =================================================================================================

describe('the macro shelf', () => {
    it('stocks MACRO_STOCK_SIZE distinct macros, each at its ruled price', () => {
        const offers = macrosAt(MARKET);
        expect(offers).toHaveLength(MACRO_STOCK_SIZE);
        expect(new Set(offers.map((o) => o.macroId)).size).toBe(offers.length);
        for (const offer of offers) {
            expect(MacroRegistry[offer.macroId]).toBeDefined();
            expect(offer.price).toBe(macroPrice(offer.macroId));
        }
    });

    it('is deterministic in (run seed, node, visit) — a resumed run restocks nothing', () => {
        expect(macrosAt(MARKET)).toEqual(macrosAt(MARKET));
    });

    it('re-rolls on the second visit, exactly as the card stock does', () => {
        // Ticket 07's re-entry rule and Henry's amendment ("stock re-rolls per visit") apply to the
        // whole stall, not only to its card half. Sampled across the three markets rather than
        // asserted on one, because two visits CAN legitimately draw the same two of thirteen macros.
        const differs = MARKETS.some((node) =>
            JSON.stringify(macrosAt(visited(node, 1))) !== JSON.stringify(macrosAt(visited(node, 2))));
        expect(differs).toBe(true);
    });

    it('does not shift the CARD stock — the two shelves are forked apart', () => {
        // The regression this guards is invisible and enormous: if the macro roll drew from the
        // stream the cards use, landing ticket 15 would re-roll every stall in every saved run.
        const cards = rollMarketStock({ run: RUN, node: MARKET, party: SOLO });
        const cardsAgain = rollMarketStock({ run: RUN, node: MARKET, party: SOLO });
        macrosAt(MARKET);
        expect(cardsAgain.offers.map((o) => o.card.instanceId)).toEqual(cards.offers.map((o) => o.card.instanceId));
    });

    it('can offer the map-reveal, which is priced like the others by ticket 07`s amendment', () => {
        // Sampled across every market of several runs: the map-reveal is one of thirteen, so any
        // single stall may or may not carry it.
        const seen = new Set<string>();
        for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
            const run = makeRun(seed);
            for (const node of run.nodes.filter((n) => n.kind === 'marketplace')) {
                for (const visit of [1, 2, 3]) {
                    for (const offer of rollMacroStock({ run, node: visited(node, visit), party: SOLO })) {
                        seen.add(offer.macroId);
                    }
                }
            }
        }
        expect(seen.has('ping_sweep')).toBe(true);
        expect(macroPrice('ping_sweep')).toBe(macroPrice('surge'));
    });
});
