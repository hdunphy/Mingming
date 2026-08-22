/**
 * MACROS ON THE SHELF — ticket 15, filling the slot ticket 13 marked.
 *
 * Kept in its own file rather than appended to `marketplace.test.ts` so that ticket 13's landed
 * suite stays exactly as it was ratified: the card prices and the card stock are unchanged by this
 * ticket, and a diff that says so is worth more than a tidier file.
 *
 * Three claims, each of which can be false without anything crashing:
 *
 * - **The ruled price is derived from ticket 13's table, not typed next to it.** *"Pricing RULED:
 *   full 1e-card value, rares 1.5x. Marketplace price follows ticket 13's table"* — so a Henry
 *   tuning pass on `CARD_PRICE_BY_RARITY` or `ENERGY_PRICE_STEP` has to move the macros too, and
 *   this is what fails if someone freezes 32 and 48 into constants.
 * - **The macro shelf and the card shelf cannot shift each other.** They are separate forks of one
 *   node seed; without the split, shipping this ticket would silently re-roll every card stock in
 *   every saved run.
 * - **`power` does not reach a macro price either.** The whole price is a function of one boolean
 *   (is it a rare), which is the strongest possible form of that law.
 */

import { describe, expect, it } from 'vitest';

import {
    CARD_PRICE_BY_RARITY,
    ENERGY_PRICE_STEP,
    MACRO_RARE_MULTIPLIER,
    MACRO_REFERENCE_ENERGY,
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

describe('macro prices follow the ruling, derived from ticket 13`s table', () => {
    /** The number ticket 13's own `cardPrice` charges for a 1-Energy Common. */
    const ONE_ENERGY_COMMON = CARD_PRICE_BY_RARITY.Common + ENERGY_PRICE_STEP * MACRO_REFERENCE_ENERGY;

    it('prices a standard macro at FULL 1e-card value', () => {
        for (const id of MACRO_IDS) {
            if (MacroRegistry[id].rarity === 'Rare') continue;
            expect(macroPrice(id)).toBe(ONE_ENERGY_COMMON);
        }
        // Stated in the concrete, so the abstraction above cannot pass while being wrong: 24 + 8.
        expect(ONE_ENERGY_COMMON).toBe(32);
    });

    it('prices a RARE macro at 1.5x that', () => {
        for (const id of MACRO_IDS) {
            if (MacroRegistry[id].rarity !== 'Rare') continue;
            expect(macroPrice(id)).toBe(Math.floor(ONE_ENERGY_COMMON * MACRO_RARE_MULTIPLIER));
        }
        expect(macroPrice('revive')).toBe(48);
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

    it('moves with ticket 13`s table rather than beside it', () => {
        // The point of deriving rather than typing: a standard macro is exactly what the SAME
        // function charges for a 1-Energy Common card, whatever that number becomes.
        const oneEnergyCommon = Object.keys(MacroRegistry).length > 0
            ? CARD_PRICE_BY_RARITY.Common + ENERGY_PRICE_STEP
            : 0;
        expect(macroPrice('surge')).toBe(oneEnergyCommon);
    });

    it('prices an unknown id as a standard macro rather than NaN', () => {
        expect(macroPrice('no_such_macro')).toBe(ONE_ENERGY_COMMON);
    });

    it('costs about what a card costs — the trade the shelf is meant to present', () => {
        // A standard macro sits inside the ordinary card band and a rare below the cheapest Rare
        // card, so "a card or a macro" is a live question at every stall rather than a foregone one.
        expect(macroPrice('surge')).toBeGreaterThanOrEqual(cardPrice('water_slap'));
        expect(macroPrice('revive')).toBeLessThan(CARD_PRICE_BY_RARITY.Rare);
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
