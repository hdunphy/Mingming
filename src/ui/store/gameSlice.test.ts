import { describe, it, expect } from 'vitest';
import gameReducer, {
    addToRoster,
    removeFromRoster,
    setActiveParty,
    addCardToInventory,
    addCardsToInventory,
    removeCardFromInventory,
    setActiveDeck,
    addCardToDeck,
    addCardsToDeck,
    clearDeck,
    removeCardFromDeck,
    addScrap,
    spendScrap,
    addBlueprint,
    loadSave,
    resetSave,
    applyRewardBundle
} from './gameSlice';
import type { IPlayerSave, IOwnedProgram, IActiveDeck, IBlueprint, IRewardBundle } from '../../engine/gameTypes';
import { createDefaultSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';
import { MingmingRegistry, getDeckForOS } from '../../engine/data/mingmingRegistry';

function makeMingming(id: string): IMingmingState {
    return { id, definitionId: 'def_fire', attackIV: 5, defenseIV: 5, hpIV: 5, blueprintsCollected: 0 };
}

function makeCard(instanceId: string, dataId: string = 'flamethrower'): IOwnedProgram {
    return { instanceId, dataId };
}

function makeDeck(id: string, cards: string[] = []): IActiveDeck {
    return { id, name: 'Test Deck', cards };
}

function makeBlueprint(archId: string): IBlueprint {
    return { architectureId: archId, name: `BP-${archId}`, compileCost: 100 };
}

describe('gameSlice', () => {
    const initial = createDefaultSave();

    // --- Roster ---
    describe('roster', () => {
        it('adds a MingMing to the roster', () => {
            const mm = makeMingming('mm1');
            const state = gameReducer(initial, addToRoster(mm));
            expect(state.roster).toHaveLength(1);
            expect(state.roster[0].id).toBe('mm1');
        });

        it('removes a MingMing from the roster', () => {
            let state = gameReducer(initial, addToRoster(makeMingming('mm1')));
            state = gameReducer(state, addToRoster(makeMingming('mm2')));
            state = gameReducer(state, removeFromRoster('mm1'));
            expect(state.roster).toHaveLength(1);
            expect(state.roster[0].id).toBe('mm2');
        });

        it('removes from active party when removed from roster', () => {
            let state = gameReducer(initial, addToRoster(makeMingming('mm1')));
            state = gameReducer(state, addToRoster(makeMingming('mm2')));
            state = gameReducer(state, setActiveParty(['mm1', 'mm2']));
            expect(state.activeParty).toHaveLength(2);
            state = gameReducer(state, removeFromRoster('mm1'));
            expect(state.activeParty).toEqual(['mm2']);
        });
    });

    // --- Base Deck Grants ---
    describe('base deck grants on synthesis', () => {
        function makeSpecies(id: string, definitionId: string): IMingmingState {
            return { ...makeMingming(id), definitionId };
        }

        it('first addToRoster of a species grants exactly its baseDeck cards and records it', () => {
            const state = gameReducer(initial, addToRoster(makeSpecies('mm1', 'fenrir')));
            const expected = getDeckForOS('fenrir').sort();
            expect(state.cardInventory).toHaveLength(9);
            expect(state.cardInventory.map(c => c.dataId).sort()).toEqual(expected);
            expect(state.baseDecksGranted).toEqual(['fenrir:fenrir_v1']);
            // Each granted copy has a unique instance id
            const instanceIds = new Set(state.cardInventory.map(c => c.instanceId));
            expect(instanceIds.size).toBe(9);
        });

        it('second addToRoster of the same species grants nothing', () => {
            let state = gameReducer(initial, addToRoster(makeSpecies('mm1', 'fenrir')));
            state = gameReducer(state, addToRoster(makeSpecies('mm2', 'fenrir')));
            expect(state.roster).toHaveLength(2);
            expect(state.cardInventory).toHaveLength(9);
            expect(state.baseDecksGranted).toEqual(['fenrir:fenrir_v1']);
        });

        it('a different species grants its own kit', () => {
            let state = gameReducer(initial, addToRoster(makeSpecies('mm1', 'fenrir')));
            state = gameReducer(state, addToRoster(makeSpecies('mm2', 'kraken')));
            expect(state.cardInventory).toHaveLength(17); // fenrir 9 + kraken 8 (ticket 28)
            expect(state.baseDecksGranted).toEqual(['fenrir:fenrir_v1', 'kraken:kraken_v1']);
            const krakenCards = state.cardInventory.slice(9).map(c => c.dataId).sort(); // after fenrir's 9
            expect(krakenCards).toEqual(getDeckForOS('kraken').sort());
        });

        it('unknown definitionId grants nothing and does not crash', () => {
            const state = gameReducer(initial, addToRoster(makeSpecies('mm1', 'not_a_species')));
            expect(state.roster).toHaveLength(1);
            expect(state.cardInventory).toHaveLength(0);
            expect(state.baseDecksGranted).toEqual([]);
        });
    });

    // --- Active Party ---
    describe('activeParty', () => {
        it('sets active party up to 3', () => {
            let state = gameReducer(initial, addToRoster(makeMingming('a')));
            state = gameReducer(state, addToRoster(makeMingming('b')));
            state = gameReducer(state, addToRoster(makeMingming('c')));
            state = gameReducer(state, addToRoster(makeMingming('d')));
            state = gameReducer(state, setActiveParty(['a', 'b', 'c', 'd']));
            // Should cap at 3
            expect(state.activeParty).toHaveLength(3);
        });

        it('filters out IDs not in roster', () => {
            let state = gameReducer(initial, addToRoster(makeMingming('a')));
            state = gameReducer(state, setActiveParty(['a', 'ghost']));
            expect(state.activeParty).toEqual(['a']);
        });
    });

    // --- Card Inventory ---
    describe('cardInventory', () => {
        it('adds cards to inventory', () => {
            const card = makeCard('c1');
            const state = gameReducer(initial, addCardToInventory(card));
            expect(state.cardInventory).toHaveLength(1);
            expect(state.cardInventory[0].instanceId).toBe('c1');
        });

        it('adds multiple cards at once', () => {
            const cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')];
            const state = gameReducer(initial, addCardsToInventory(cards));
            expect(state.cardInventory).toHaveLength(3);
        });

        it('removes a card from inventory', () => {
            let state = gameReducer(initial, addCardToInventory(makeCard('c1')));
            state = gameReducer(state, addCardToInventory(makeCard('c2')));
            state = gameReducer(state, removeCardFromInventory('c1'));
            expect(state.cardInventory).toHaveLength(1);
            expect(state.cardInventory[0].instanceId).toBe('c2');
        });

        it('removes card from active deck when removed from inventory', () => {
            let state = gameReducer(initial, addCardToInventory(makeCard('c1')));
            state = gameReducer(state, addCardToInventory(makeCard('c2')));
            state = gameReducer(state, setActiveDeck(makeDeck('d1', ['c1', 'c2'])));
            state = gameReducer(state, removeCardFromInventory('c1'));
            expect(state.activeDeck!.cards).toEqual(['c2']);
        });
    });

    // --- Active Deck ---
    describe('activeDeck', () => {
        it('sets active deck', () => {
            const deck = makeDeck('d1', ['c1']);
            const state = gameReducer(initial, setActiveDeck(deck));
            expect(state.activeDeck).not.toBeNull();
            expect(state.activeDeck!.id).toBe('d1');
        });

        it('adds a card to deck if it exists in inventory', () => {
            let state = gameReducer(initial, addCardToInventory(makeCard('c1')));
            state = gameReducer(state, setActiveDeck(makeDeck('d1')));
            state = gameReducer(state, addCardToDeck('c1'));
            expect(state.activeDeck!.cards).toContain('c1');
        });

        it('rejects adding card not in inventory', () => {
            let state = gameReducer(initial, setActiveDeck(makeDeck('d1')));
            state = gameReducer(state, addCardToDeck('ghost'));
            expect(state.activeDeck!.cards).toHaveLength(0);
        });

        it('rejects adding duplicate card to deck', () => {
            let state = gameReducer(initial, addCardToInventory(makeCard('c1')));
            state = gameReducer(state, setActiveDeck(makeDeck('d1', ['c1'])));
            state = gameReducer(state, addCardToDeck('c1'));
            expect(state.activeDeck!.cards).toHaveLength(1);
        });

        it('removes card from deck', () => {
            let state = gameReducer(initial, setActiveDeck(makeDeck('d1', ['c1', 'c2'])));
            state = gameReducer(state, removeCardFromDeck('c1'));
            expect(state.activeDeck!.cards).toEqual(['c2']);
        });
    });

    // --- Bulk Add / Clear ---
    describe('addCardsToDeck', () => {
        it('adds multiple owned cards to the deck', () => {
            let state = gameReducer(initial, addCardsToInventory([makeCard('c1'), makeCard('c2'), makeCard('c3')]));
            state = gameReducer(state, setActiveDeck(makeDeck('d1')));
            state = gameReducer(state, addCardsToDeck(['c1', 'c2', 'c3']));
            expect(state.activeDeck!.cards).toEqual(['c1', 'c2', 'c3']);
        });

        it('creates the active deck if none exists', () => {
            let state = gameReducer(initial, addCardsToInventory([makeCard('c1')]));
            expect(state.activeDeck).toBeNull();
            state = gameReducer(state, addCardsToDeck(['c1']));
            expect(state.activeDeck).not.toBeNull();
            expect(state.activeDeck!.cards).toEqual(['c1']);
        });

        it('skips ids not in inventory and ids already in the deck', () => {
            let state = gameReducer(initial, addCardsToInventory([makeCard('c1'), makeCard('c2')]));
            state = gameReducer(state, setActiveDeck(makeDeck('d1', ['c1'])));
            state = gameReducer(state, addCardsToDeck(['c1', 'ghost', 'c2', 'c2']));
            expect(state.activeDeck!.cards).toEqual(['c1', 'c2']);
        });

        it('stops at DECK_SIZE (40)', () => {
            const cards: IOwnedProgram[] = [];
            for (let i = 0; i < 45; i++) cards.push(makeCard(`c${i}`));
            let state = gameReducer(initial, addCardsToInventory(cards));
            state = gameReducer(state, setActiveDeck(makeDeck('d1')));
            state = gameReducer(state, addCardsToDeck(cards.map(c => c.instanceId)));
            expect(state.activeDeck!.cards).toHaveLength(40);
            expect(state.activeDeck!.cards[39]).toBe('c39');
        });
    });

    describe('clearDeck', () => {
        it('empties the active deck but keeps its identity', () => {
            let state = gameReducer(initial, setActiveDeck(makeDeck('d1', ['c1', 'c2'])));
            state = gameReducer(state, clearDeck());
            expect(state.activeDeck!.cards).toEqual([]);
            expect(state.activeDeck!.id).toBe('d1');
        });

        it('is a no-op when there is no active deck', () => {
            const state = gameReducer(initial, clearDeck());
            expect(state.activeDeck).toBeNull();
        });
    });

    // --- Scrap ---
    describe('scrap', () => {
        it('adds scrap', () => {
            const state = gameReducer(initial, addScrap(50));
            expect(state.scrapCount).toBe(50);
        });

        it('spends scrap if sufficient', () => {
            let state = gameReducer(initial, addScrap(100));
            state = gameReducer(state, spendScrap(30));
            expect(state.scrapCount).toBe(70);
        });

        it('does not spend scrap if insufficient', () => {
            let state = gameReducer(initial, addScrap(10));
            state = gameReducer(state, spendScrap(50));
            expect(state.scrapCount).toBe(10);
        });
    });

    // --- Blueprints ---
    describe('blueprints', () => {
        it('adds a blueprint', () => {
            const bp = makeBlueprint('arch_fire');
            const state = gameReducer(initial, addBlueprint(bp));
            expect(state.blueprints).toHaveLength(1);
        });

        it('rejects duplicate blueprint', () => {
            const bp = makeBlueprint('arch_fire');
            let state = gameReducer(initial, addBlueprint(bp));
            state = gameReducer(state, addBlueprint(bp));
            expect(state.blueprints).toHaveLength(1);
        });
    });

    // --- Reward Bundle ---
    describe('applyRewardBundle', () => {
        it('applies scrap, cards, and blueprints', () => {
            let state = gameReducer(initial, addToRoster(makeMingming('mm1')));
            state = gameReducer(state, setActiveParty(['mm1']));

            const bundle: IRewardBundle = {
                scraps: 42,
                blueprints: [makeBlueprint('arch_fire')],
                cards: [makeCard('rc1')],
                cardChoices: [],
                totalXP: 500 // even a non-zero value must not be applied to the roster
            };
            state = gameReducer(state, applyRewardBundle(bundle));

            expect(state.scrapCount).toBe(42);
            expect(state.blueprints).toHaveLength(1);
            expect(state.cardInventory).toHaveLength(1);
        });

        it('applies gym-clear draft picks through bundle.cards (draftRounds metadata is inert)', () => {
            let state = gameReducer(initial, addToRoster(makeMingming('mm1')));

            // A gym-clear bundle: the three drafted picks are accumulated into
            // `cards` at claim time; `draftRounds` itself grants nothing.
            const bundle: IRewardBundle = {
                scraps: 30,
                blueprints: [],
                cards: [makeCard('draft1', 'a'), makeCard('draft2', 'b'), makeCard('draft3', 'c')],
                cardChoices: [],
                draftRounds: [
                    { sourceEntityName: 'GYM DRAFT 1', options: [makeCard('o1'), makeCard('o2'), makeCard('o3')] },
                    { sourceEntityName: 'GYM DRAFT 2', options: [makeCard('o4'), makeCard('o5'), makeCard('o6')] },
                    { sourceEntityName: 'GYM DRAFT 3', options: [makeCard('o7'), makeCard('o8'), makeCard('o9')] }
                ],
                totalXP: 0
            };
            state = gameReducer(state, applyRewardBundle(bundle));

            expect(state.scrapCount).toBe(30);
            // Only the picked cards land in the inventory — never the unpicked options
            expect(state.cardInventory.map(c => c.instanceId)).toEqual(['draft1', 'draft2', 'draft3']);
        });
    });

    // --- Save/Load ---
    describe('save/load', () => {
        it('loads a save', () => {
            const save: IPlayerSave = {
                ...createDefaultSave(),
                scrapCount: 999,
                version: 1
            };
            const state = gameReducer(initial, loadSave(save));
            expect(state.scrapCount).toBe(999);
        });

        it('resets to default', () => {
            let state = gameReducer(initial, addScrap(500));
            state = gameReducer(state, resetSave());
            expect(state.scrapCount).toBe(0);
            expect(state.roster).toHaveLength(0);
        });
    });
});
