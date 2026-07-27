import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
    IPlayerSave,
    IOwnedProgram,
    IActiveDeck,
    IBlueprint,
    IRewardBundle,
    IGauntletState
} from '../../engine/gameTypes';
import { createDefaultSave, createStarterSave, DECK_SIZE } from '../../engine/gameTypes';
import type { IMingmingState, IBattleEntity } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';

const initialState: IPlayerSave = createDefaultSave();

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        // --- Roster ---
        addToRoster: (state, action: PayloadAction<IMingmingState>) => {
            (state.roster as IMingmingState[]).push(action.payload);
        },
        removeFromRoster: (state, action: PayloadAction<string>) => {
            const id = action.payload;
            // Also remove from active party if present
            state.activeParty = (state.activeParty as string[]).filter(pid => pid !== id);
            state.roster = (state.roster as IMingmingState[]).filter(m => m.id !== id);
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
        applyRewardBundle: (state, action: PayloadAction<IRewardBundle>) => {
            const bundle = action.payload;
            state.scrapCount += bundle.scraps;

            // Blueprints
            for (const bp of bundle.blueprints) {
                const exists = state.blueprints.some(b => b.architectureId === bp.architectureId);
                if (!exists) {
                    (state.blueprints as IBlueprint[]).push(bp);
                }
            }

            // Cards (Guaranteed or Chosen)
            for (const card of bundle.cards) {
                (state.cardInventory as IOwnedProgram[]).push(card);
            }

            // NOTE: The reward bundle intentionally grants NO XP. Roster XP comes
            // exclusively from the in-battle death-XP system, persisted via syncPartyStats.
        },
        updateGauntlet: (state, action: PayloadAction<{ persistedStats: Record<string, { hp: number }> }>) => {
            if (state.gauntlet) {
                state.gauntlet = {
                    ...state.gauntlet,
                    currentBattleIndex: state.gauntlet.currentBattleIndex + 1,
                    persistedStats: action.payload.persistedStats
                };
            }
        },
        startGauntlet: (state, action: PayloadAction<{ type: 'Gym' | 'Sector', element: string, totalBattles: number }>) => {
            state.gauntlet = {
                type: action.payload.type,
                element: action.payload.element,
                currentBattleIndex: 0,
                totalBattles: action.payload.totalBattles,
                persistedStats: {}
            };
        },
        completeGauntlet: (state) => {
            if (state.gauntlet && state.gauntlet.type === 'Gym') {
                const element = state.gauntlet.element;
                if (!state.unlockedSectors.includes(element)) {
                    (state.unlockedSectors as string[]).push(element);
                }
            }
            state.gauntlet = null;
        },
        syncPartyStats: (state, action: PayloadAction<ReadonlyArray<IBattleEntity>>) => {
            const party = action.payload;
            state.roster = state.roster.map(member => {
                const match = party.find(p => p.id === member.id);
                if (match) {
                    return {
                        ...member,
                        level: match.level,
                        experience: match.experience
                        // Note: actual HP/Temp stats aren't persisted to the roster yet in this version,
                        // but level and XP definitely should be.
                    };
                }
                return member;
            });
        },
        startNewGauntlet: (_state, action: PayloadAction<'kraken' | 'fenrir' | 'ratatoskr'>) => {
            return createStarterSave(action.payload);
        },

        // --- OS Management ---
        updateMingmingOS: (state, action: PayloadAction<{ id: string, activeOS: string }>) => {
            const { id, activeOS } = action.payload;
            const mm = state.roster.find(m => m.id === id);
            if (mm) {
                mm.activeOS = activeOS;
            }
        },
        resetSave: (state) => {
            void state;
            return createDefaultSave();
        },
        addRelic: (state, action: PayloadAction<string>) => {
            if (!state.relics.includes(action.payload)) {
                (state.relics as string[]).push(action.payload);
            }
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
    applyRewardBundle,
    updateGauntlet,
    startGauntlet,
    completeGauntlet,
    syncPartyStats,
    startNewGauntlet,
    updateMingmingOS,
    resetSave,
    addRelic
} = gameSlice.actions;

export default gameSlice.reducer;
