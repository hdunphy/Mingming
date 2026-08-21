import { describe, it, expect } from 'vitest';
import { suggestDeckFill } from './deckSuggest';
import type { DeckSuggestInput } from './deckSuggest';
import type { IOwnedProgram, IActiveDeck } from './gameTypes';
import type { IMingmingState } from './types';
import { MingmingRegistry, getDeckForOS } from './data/mingmingRegistry';

// --- Helpers -------------------------------------------------------------

function makeMember(id: string, definitionId: string): IMingmingState {
    return {
        id,
        definitionId,
        blueprintsCollected: 0,
        attackIV: 10,
        defenseIV: 10,
        hpIV: 10
    };
}

let seq = 0;
function makeCard(dataId: string): IOwnedProgram {
    return { instanceId: `inst_${dataId}_${seq++}`, dataId };
}

function makeCards(dataIds: string[]): IOwnedProgram[] {
    return dataIds.map(makeCard);
}

function makeDeck(cards: string[] = []): IActiveDeck {
    return { id: 'deck1', name: 'Test Deck', cards };
}

function makeInput(partial: Partial<DeckSuggestInput>): DeckSuggestInput {
    return {
        cardInventory: [],
        activeDeck: null,
        roster: [],
        activeParty: [],
        ...partial
    };
}

const FENRIR_BASE = getDeckForOS('fenrir'); // Fire cards (v1 slot)
const KRAKEN_BASE = getDeckForOS('kraken'); // Water cards (v1 slot)

// --- Tests ---------------------------------------------------------------

describe('suggestDeckFill', () => {
    it('fills to MIN_DECK_SIZE * partySize (8, per the ticket-04 template) when enough cards are owned', () => {
        const inventory = [...makeCards(FENRIR_BASE), ...makeCards(KRAKEN_BASE)];
        const result = suggestDeckFill(makeInput({
            cardInventory: inventory,
            activeDeck: makeDeck(),
            roster: [makeMember('m1', 'fenrir'), makeMember('m2', 'kraken')],
            activeParty: ['m1', 'm2']
        }));
        expect(result).toHaveLength(16);
        // All returned ids are real owned instances, no duplicates
        const ownedIds = new Set(inventory.map(c => c.instanceId));
        expect(result.every(id => ownedIds.has(id))).toBe(true);
        expect(new Set(result).size).toBe(16);
    });

    it('prioritizes owned copies of the party species baseDeck, in baseDeck order', () => {
        // Own the fenrir base kit plus some off-species water cards
        const baseCards = makeCards(FENRIR_BASE);
        const filler = makeCards(['water_slap', 'water_slap', 'ink_cloud']);
        const result = suggestDeckFill(makeInput({
            cardInventory: [...filler, ...baseCards], // filler first: order must not matter
            activeDeck: makeDeck(),
            roster: [makeMember('m1', 'fenrir')],
            activeParty: ['m1']
        }));
        expect(result).toHaveLength(8);
        // Suggested dataIds match the deck listing in order, truncated at the
        // 8-card fill target (legacy 10-card decks shrink to 8-12 in the passes).
        const byInstance = new Map([...filler, ...baseCards].map(c => [c.instanceId, c.dataId]));
        expect(result.map(id => byInstance.get(id))).toEqual(FENRIR_BASE.slice(0, 8));
    });

    it('skips cards already in the deck and respects baseDeck copy counts', () => {
        const baseCards = makeCards(FENRIR_BASE);
        // blood_rite appears twice in fenrir's baseDeck (ticket 28 deck pass); put ONE in the deck
        const firePokes = baseCards.filter(c => c.dataId === 'blood_rite');
        expect(firePokes.length).toBe(2);
        const deck = makeDeck([firePokes[0].instanceId]);

        const result = suggestDeckFill(makeInput({
            cardInventory: baseCards,
            activeDeck: deck,
            roster: [makeMember('m1', 'fenrir')],
            activeParty: ['m1']
        }));
        // 9 more cards to reach the target of 10
        expect(result).toHaveLength(7);
        // Never suggests an instance already in the deck
        expect(result).not.toContain(firePokes[0].instanceId);
        // Only ONE more blood_rite copy is suggested (deck copy counts toward the 2 listed)
        const byInstance = new Map(baseCards.map(c => [c.instanceId, c.dataId]));
        const suggestedPokes = result.filter(id => byInstance.get(id) === 'blood_rite');
        expect(suggestedPokes).toEqual([firePokes[1].instanceId]);
    });

    it('never includes token cards', () => {
        // hoof_strike and feedback_token are Token rarity / isToken
        const inventory = [
        ...makeCards(['hoof_strike', 'feedback_token']),
        ...makeCards(FENRIR_BASE.slice(0, 4))
        ];
        const result = suggestDeckFill(makeInput({
            cardInventory: inventory,
            activeDeck: makeDeck(),
            roster: [makeMember('m1', 'fenrir')],
            activeParty: ['m1']
        }));
        const byInstance = new Map(inventory.map(c => [c.instanceId, c.dataId]));
        const suggestedDataIds = result.map(id => byInstance.get(id));
        expect(suggestedDataIds).not.toContain('hoof_strike');
        expect(suggestedDataIds).not.toContain('feedback_token');
        // Only the 4 owned non-token cards get suggested
        expect(result).toHaveLength(4);
    });

    it('returns [] when the deck is already at or above target', () => {
        const baseCards = makeCards(FENRIR_BASE);
        const extra = makeCards(['fury_strike']);
        const deck = makeDeck(baseCards.map(c => c.instanceId)); // 10 cards, party of 1 => target 10
        const result = suggestDeckFill(makeInput({
            cardInventory: [...baseCards, ...extra],
            activeDeck: deck,
            roster: [makeMember('m1', 'fenrir')],
            activeParty: ['m1']
        }));
        expect(result).toEqual([]);
    });

    it('handles an empty party with a target of 10 (falls through to None-element cards)', () => {
        // With no party there are no baseDecks and no matching elements;
        // only element 'None' cards qualify for the fill.
        const noneCards = makeCards(['harden_daemon', 'harden_daemon', 'harden_daemon']);
        const fireCards = makeCards(['fury_strike', 'fury_strike']);
        const result = suggestDeckFill(makeInput({
            cardInventory: [...fireCards, ...noneCards],
            activeDeck: makeDeck(),
            roster: [],
            activeParty: []
        }));
        const byInstance = new Map([...fireCards, ...noneCards].map(c => [c.instanceId, c.dataId]));
        expect(result.map(id => byInstance.get(id))).toEqual([
            'harden_daemon', 'harden_daemon', 'harden_daemon'
        ]);
        expect(result.length).toBeLessThanOrEqual(10);
    });

    it('handles a null activeDeck as an empty deck', () => {
        const baseCards = makeCards(FENRIR_BASE);
        const result = suggestDeckFill(makeInput({
            cardInventory: baseCards,
            activeDeck: null,
            roster: [makeMember('m1', 'fenrir')],
            activeParty: ['m1']
        }));
        expect(result).toHaveLength(8);
    });

    it('fills remaining slots with party-element cards by lowest cost first', () => {
        // Party of 2 fenrir (one baseDeck kit owned) => target 20, baseDeck covers 10
        const baseCards = makeCards(FENRIR_BASE);
        // Extra fire cards of differing costs (fury_strike cost 1, flame_burst higher)
        const extras = makeCards(['fury_strike', 'fury_strike', 'desperate_strike']);
        const result = suggestDeckFill(makeInput({
            cardInventory: [...baseCards, ...extras],
            activeDeck: makeDeck(),
            roster: [makeMember('m1', 'fenrir'), makeMember('m2', 'fenrir')],
            activeParty: ['m1', 'm2']
        }));
        // 9 base + 3 extras = 12 owned usable cards, target 20 => all 12 suggested
        expect(result).toHaveLength(12);
        const byInstance = new Map([...baseCards, ...extras].map(c => [c.instanceId, c.dataId]));
        // The base kit comes first, then extras ordered cost-asc (desperate_strike cost 0 first)
        expect(result.slice(0, 9).map(id => byInstance.get(id))).toEqual(FENRIR_BASE);
        expect(result.slice(9).map(id => byInstance.get(id))).toEqual([
            'desperate_strike', 'fury_strike', 'fury_strike'
        ]);
    });

    it('ignores activeParty ids that are not in the roster', () => {
        const baseCards = makeCards(FENRIR_BASE);
        const result = suggestDeckFill(makeInput({
            cardInventory: baseCards,
            activeDeck: makeDeck(),
            roster: [makeMember('m1', 'fenrir')],
            activeParty: ['m1', 'ghost1', 'ghost2'] // partySize = 1 => target 10
        }));
        expect(result).toHaveLength(8);
    });
});
