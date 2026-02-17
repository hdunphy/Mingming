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
    removeCardFromDeck,
    addScrap,
    spendScrap,
    addBlueprint,
    loadSave,
    resetSave
} from './gameSlice';
import type { IPlayerSave, IOwnedProgram, IActiveDeck, IBlueprint } from '../../engine/gameTypes';
import { createDefaultSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';

function makeMingming(id: string): IMingmingState {
    return { id, definitionId: 'def_fire', level: 5, experience: 0, attackIV: 5, defenseIV: 5, hpIV: 5 };
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
