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
import { createDefaultSave, createStarterSave, DECK_SIZE, deckGrantKey, OS_SWAP_SCRAP_COST, OS_SWAP_PICK_COUNT } from '../../engine/gameTypes';
import type { IMingmingState, IBattleEntity } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';
import { MingmingRegistry, getDeckForOS } from '../../engine/data/mingmingRegistry';

const initialState: IPlayerSave = createDefaultSave();

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        // --- Roster ---
        addToRoster: (state, action: PayloadAction<IMingmingState>) => {
            (state.roster as IMingmingState[]).push(action.payload);

            // First-time synthesis of a (species, OS) grants that OS's starting kit
            // (ticket 13: per-OS decks; ticket 15: grants are keyed species+OS).
            const definition = MingmingRegistry[action.payload.definitionId];
            if (definition) {
                const compiledOS = action.payload.activeOS ?? definition.availableOS[0];
                const key = deckGrantKey(definition.id, compiledOS);
                if (!state.baseDecksGranted.includes(key)) {
                    for (const dataId of getDeckForOS(definition.id, compiledOS)) {
                        (state.cardInventory as IOwnedProgram[]).push({
                            instanceId: crypto.randomUUID(),
                            dataId
                        });
                    }
                    (state.baseDecksGranted as string[]).push(key);
                }
            }
        },
        removeFromRoster: (state, action: PayloadAction<string>) => {
            const id = action.payload;
            // Also remove from active party if present
            state.activeParty = (state.activeParty as string[]).filter(pid => pid !== id);
            state.roster = (state.roster as IMingmingState[]).filter(m => m.id !== id);
        },

        /**
         * Grants experience to a roster instance and runs the same level-up
         * progression the battle path uses (`handleLevelUp` in effectHandlers),
         * so a grant that crosses several thresholds behaves identically to
         * earning that XP in combat: `experience` is cumulative and is never
         * spent on a level, and levels are taken one threshold at a time.
         *
         * Derived stats (maxHp/attack/defense) are the battle-side half of
         * handleLevelUp and have no roster counterpart to update -- they are
         * recomputed from level + IVs by initializeBattleEntity when the unit
         * next enters battle.
         *
         * This is a general game capability (a future XP relic/card grants it);
         * it is deliberately NOT wired into applyRewardBundle -- see the note
         * there on the rewards-grant-no-XP rule.
         */
        grantExperience: (state, action: PayloadAction<{ mingmingId: string, amount: number }>) => {
            const { mingmingId, amount } = action.payload;
            // Keep the save PlayerSaveSchema-valid: `experience` must remain a
            // non-negative integer, and this action only ever grants XP.
            if (!Number.isFinite(amount)) return;
            const gain = Math.floor(amount);
            if (gain <= 0) return;

            const mm = state.roster.find(m => m.id === mingmingId);
            if (!mm) return;

            mm.experience += gain;
            while (mm.experience >= getExpForLevel(mm.level + 1)) {
                mm.level += 1;
            }
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
        addCardsToDeck: (state, action: PayloadAction<string[]>) => {
            // Mirror DeckTerminal's auto-create behavior when no deck exists yet
            if (!state.activeDeck) {
                state.activeDeck = { id: crypto.randomUUID(), name: 'Main Deck', cards: [] } as any;
            }
            const inventoryIds = new Set(state.cardInventory.map(c => c.instanceId));
            const cards = [...state.activeDeck!.cards];
            for (const instanceId of action.payload) {
                if (cards.length >= DECK_SIZE) break;
                if (!inventoryIds.has(instanceId)) continue;
                if (cards.includes(instanceId)) continue;
                cards.push(instanceId);
            }
            state.activeDeck = { ...state.activeDeck!, cards };
        },
        clearDeck: (state) => {
            if (!state.activeDeck) return;
            state.activeDeck = { ...state.activeDeck, cards: [] };
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

        // --- Sectors ---
        /**
         * Unlocks a sector by element. Same append completeGauntlet performs on
         * a Gym clear, exposed as a standalone capability a relic or reward can
         * grant directly. No-op if the sector is already unlocked.
         */
        unlockSector: (state, action: PayloadAction<string>) => {
            if (state.unlockedSectors.includes(action.payload)) return;
            (state.unlockedSectors as string[]).push(action.payload);
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
        /**
         * Ticket 15: player-facing firmware swap. Costs 1 blueprint of the species
         * (SPENT) + OS_SWAP_SCRAP_COST scrap; the first swap to an OS lets the player
         * pick up to OS_SWAP_PICK_COUNT cards from that OS's starting kit (once ever
         * per species+OS - repeat swaps grant nothing). Silent no-op when any cost
         * or validation fails, matching spendScrap's convention. Debug tools keep
         * using the bare updateMingmingOS above.
         */
        swapOS: (state, action: PayloadAction<{ id: string; targetOS: string; pickedCardIds?: string[] }>) => {
            const { id, targetOS, pickedCardIds } = action.payload;
            const mm = state.roster.find(m => m.id === id);
            if (!mm) return;
            const definition = MingmingRegistry[mm.definitionId];
            if (!definition || !definition.availableOS.includes(targetOS)) return;
            if (mm.activeOS === targetOS) return;

            const blueprintIdx = state.blueprints.findIndex(b => b.architectureId === mm.definitionId);
            if (blueprintIdx === -1) return;
            if (state.scrapCount < OS_SWAP_SCRAP_COST) return;

            // Spend: the species blueprint is consumed, plus scrap.
            (state.blueprints as IBlueprint[]).splice(blueprintIdx, 1);
            state.scrapCount -= OS_SWAP_SCRAP_COST;
            mm.activeOS = targetOS;

            // First swap to this OS: grant the picked cards (validated against the
            // OS's starting deck, copies respected) and record the grant key.
            const key = deckGrantKey(mm.definitionId, targetOS);
            if (!state.baseDecksGranted.includes(key)) {
                const pool = getDeckForOS(mm.definitionId, targetOS);
                const picks = (pickedCardIds ?? []).slice(0, OS_SWAP_PICK_COUNT);
                for (const dataId of picks) {
                    const poolIdx = pool.indexOf(dataId);
                    if (poolIdx === -1) continue; // not in the kit (or copies exhausted)
                    pool.splice(poolIdx, 1);
                    (state.cardInventory as IOwnedProgram[]).push({
                        instanceId: crypto.randomUUID(),
                        dataId
                    });
                }
                (state.baseDecksGranted as string[]).push(key);
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
    grantExperience,
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
    healParty,
    loadSave,
    applyRewardBundle,
    updateGauntlet,
    startGauntlet,
    completeGauntlet,
    unlockSector,
    syncPartyStats,
    startNewGauntlet,
    updateMingmingOS,
    swapOS,
    resetSave,
    addRelic
} = gameSlice.actions;

export default gameSlice.reducer;
