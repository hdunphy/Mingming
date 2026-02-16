import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
    IPlayerSave,
    IMingmingInstance,
    IOwnedProgram,
    IActiveDeck,
    IBlueprint
} from '../../engine/gameTypes';
import { createDefaultSave, DECK_SIZE } from '../../engine/gameTypes';

const initialState: IPlayerSave = createDefaultSave();

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        // --- Roster ---
        addToRoster: (state, action: PayloadAction<IMingmingInstance>) => {
            (state.roster as IMingmingInstance[]).push(action.payload);
        },
        removeFromRoster: (state, action: PayloadAction<string>) => {
            const id = action.payload;
            // Also remove from active party if present
            state.activeParty = (state.activeParty as string[]).filter(pid => pid !== id);
            state.roster = (state.roster as IMingmingInstance[]).filter(m => m.id !== id);
        },

        // --- Active Party (max 3) ---
        setActiveParty: (state, action: PayloadAction<string[]>) => {
            const ids = action.payload.slice(0, 3);
            // Validate all IDs exist in roster
            const rosterIds = new Set(state.roster.map(m => m.id));
            state.activeParty = ids.filter(id => rosterIds.has(id));
        },

        // --- Card Inventory ---
        addCardToInventory: (state, action: PayloadAction<IOwnedProgram>) => {
            (state.cardInventory as IOwnedProgram[]).push(action.payload);
        },
        addCardsToInventory: (state, action: PayloadAction<IOwnedProgram[]>) => {
            for (const card of action.payload) {
                (state.cardInventory as IOwnedProgram[]).push(card);
            }
        },
        removeCardFromInventory: (state, action: PayloadAction<string>) => {
            const instanceId = action.payload;
            state.cardInventory = (state.cardInventory as IOwnedProgram[]).filter(
                c => c.instanceId !== instanceId
            );
            // Also remove from active deck if present
            if (state.activeDeck) {
                state.activeDeck = {
                    ...state.activeDeck,
                    cards: (state.activeDeck.cards as string[]).filter(id => id !== instanceId)
                };
            }
        },

        // --- Active Deck ---
        setActiveDeck: (state, action: PayloadAction<IActiveDeck>) => {
            state.activeDeck = action.payload as any;
        },
        addCardToDeck: (state, action: PayloadAction<string>) => {
            if (!state.activeDeck) return;
            if (state.activeDeck.cards.length >= DECK_SIZE) return;
            // Verify card exists in inventory
            const exists = state.cardInventory.some(c => c.instanceId === action.payload);
            if (!exists) return;
            // Verify not already in deck
            if (state.activeDeck.cards.includes(action.payload)) return;
            state.activeDeck = {
                ...state.activeDeck,
                cards: [...state.activeDeck.cards, action.payload]
            };
        },
        removeCardFromDeck: (state, action: PayloadAction<string>) => {
            if (!state.activeDeck) return;
            state.activeDeck = {
                ...state.activeDeck,
                cards: (state.activeDeck.cards as string[]).filter(id => id !== action.payload)
            };
        },

        // --- Scrap Economy ---
        addScrap: (state, action: PayloadAction<number>) => {
            state.scrapCount += action.payload;
        },
        spendScrap: (state, action: PayloadAction<number>) => {
            if (state.scrapCount >= action.payload) {
                state.scrapCount -= action.payload;
            }
        },

        // --- Blueprints ---
        addBlueprint: (state, action: PayloadAction<IBlueprint>) => {
            // Don't add duplicates
            const exists = state.blueprints.some(
                b => b.architectureId === action.payload.architectureId
            );
            if (!exists) {
                (state.blueprints as IBlueprint[]).push(action.payload);
            }
        },

        // --- Heal Party ---
        healParty: (state) => {
            // This is a meta-action that sets a flag; actual HP restoration
            // happens when transitioning into battle via battleFactories
            // For now, it's a no-op placeholder since HP is on IBattleEntity, not IMingmingInstance
            void state;
        },

        // --- Load Save ---
        loadSave: (_state, action: PayloadAction<IPlayerSave>) => {
            return action.payload;
        },

        // --- Reset ---
        resetSave: () => {
            return createDefaultSave();
        }
    }
});

export const {
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
    healParty,
    loadSave,
    resetSave
} = gameSlice.actions;

export default gameSlice.reducer;
