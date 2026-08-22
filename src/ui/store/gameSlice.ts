import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
    IPlayerSave,
    IOwnedProgram,
    IActiveDeck,
    IRewardBundle,
    IGauntletState
} from '../../engine/gameTypes';
import { createDefaultSave, createStarterSave, DECK_SIZE, deckGrantKey, OS_SWAP_PICK_COUNT } from '../../engine/gameTypes';
import type { IMingmingState, IBattleEntity } from '../../engine/types';
import { MingmingRegistry, getDeckForOS } from '../../engine/data/mingmingRegistry';
import { legalParty } from '../../engine/party';

const initialState: IPlayerSave = createDefaultSave();

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        // --- Roster ---
        /**
         * Bare add, no cost. **Not the player-facing path any more** — ticket 20 routes assembly
         * through `assembleMingming`, which spends the blueprint. This one survives for the debug
         * toolkit and for tests that need a roster member without an economy.
         *
         * It still grants the species' starting kit into `cardInventory`, which is legacy
         * pre-run-loop behaviour: cards are run-scoped now, and ticket 09 grants the start kit at
         * run start from ticket 08's `startKit` tags. Kept only so the debug scenario launcher's
         * "saved deck" mode has something to work with until then.
         */
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

        // --- Active Party (max 3) ---
        /**
         * Ticket 20: this is the **first place the species clause is enforced in the ranch.**
         *
         * "No duplicate species per team" is a standing law (map § Notes) that until now lived only
         * as a comment in `debug/balance/teamComps.ts` calling it an open question, and as a
         * load-time check in `reconcileLoadedState` that could only discard a run *after* the fact.
         * Neither stopped a player assembling two krakens in the roster screen. This does.
         *
         * The rule itself lives in `engine/party.ts` so this reducer, the load path
         * (`save/ranchProjection.ts`) and the ranch screen cannot drift apart on what a legal party
         * is — three hand-written copies of one law is how a law rots.
         */
        setActiveParty: (state, action: PayloadAction<string[]>) => {
            state.activeParty = legalParty(action.payload, state.roster);
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
        /**
         * Ticket 20: **stacks, never dedupes.** v3 refused a second blueprint of a species you
         * already had, which made sense when a blueprint was a permanent "you may build this"
         * permission. It is currency now — a second one is a second assembly.
         */
        addBlueprint: (state, action: PayloadAction<string>) => {
            const counts = state.blueprints as Record<string, number>;
            counts[action.payload] = (counts[action.payload] ?? 0) + 1;
        },

        /**
         * The player-facing assembly path (ticket 20). **Costs exactly one blueprint of the
         * species and no scrap** — the flat 100-scrap `compileCost` is deleted, because
         * `economy-session.md` and `vision.md` agree once you split the places apart: a blueprint
         * at the ranch, a blueprint PLUS scrap at a mid-run workshop (ticket 14 owns that price).
         *
         * Atomic on purpose. The old flow was `dispatch(spendScrap(cost))` then
         * `dispatch(addToRoster(mm))`, two reducers with an affordability check that lived only in
         * the component — so anything that got between them produced a free unit. Here the spend
         * and the roster push cannot come apart.
         *
         * Silent no-op with no blueprint, matching `spendScrap`'s convention. The caller builds the
         * instance (it owns the RNG for the stat roll), which is also what makes re-assembly the
         * re-roll: same species, new individual, one more blueprint.
         */
        assembleMingming: (state, action: PayloadAction<IMingmingState>) => {
            const counts = state.blueprints as Record<string, number>;
            const held = counts[action.payload.definitionId] ?? 0;
            if (held < 1) return;
            counts[action.payload.definitionId] = held - 1;
            if (counts[action.payload.definitionId] === 0) delete counts[action.payload.definitionId];
            (state.roster as IMingmingState[]).push(action.payload);
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

            // Blueprints (ticket 20: species ids, and they stack)
            const counts = state.blueprints as Record<string, number>;
            for (const speciesId of bundle.blueprints) {
                counts[speciesId] = (counts[speciesId] ?? 0) + 1;
            }

            // Cards (Guaranteed or Chosen)
            for (const card of bundle.cards) {
                (state.cardInventory as IOwnedProgram[]).push(card);
            }

            // Ticket 21: there is no XP. Rewards are cards, scrap and blueprints — progression
            // is acquisition, never stat growth.
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
         * Player-facing firmware reflash (ticket 15, re-priced by ticket 20).
         *
         * **Costs exactly one blueprint of the species. No scrap** — `OS_SWAP_SCRAP_COST` is
         * deleted along with assembly's, because ticket 20 takes scrap out of the ranch entirely:
         * scrap is run-scoped, so a ranch that charges it is charging a currency the player cannot
         * carry home. `vision.md`: "Reflashing an individual's OS also costs a blueprint."
         *
         * The first swap to an OS still grants a pick of up to `OS_SWAP_PICK_COUNT` cards from that
         * OS's kit, once ever per species+OS. That grant is **legacy** — cards are run-scoped now
         * and ticket 09 hands out the start kit at run start instead — but removing it here would
         * silently shrink the pre-run-loop build's only card source, so it goes when 09 replaces it.
         *
         * Silent no-op when any cost or validation fails, matching `spendScrap`'s convention. Debug
         * tools keep using the bare `updateMingmingOS` above.
         */
        swapOS: (state, action: PayloadAction<{ id: string; targetOS: string; pickedCardIds?: string[] }>) => {
            const { id, targetOS, pickedCardIds } = action.payload;
            const mm = state.roster.find(m => m.id === id);
            if (!mm) return;
            const definition = MingmingRegistry[mm.definitionId];
            if (!definition || !definition.availableOS.includes(targetOS)) return;
            if (mm.activeOS === targetOS) return;

            const counts = state.blueprints as Record<string, number>;
            const held = counts[mm.definitionId] ?? 0;
            if (held < 1) return;

            // Spend: one blueprint of the species, and nothing else.
            counts[mm.definitionId] = held - 1;
            if (counts[mm.definitionId] === 0) delete counts[mm.definitionId];
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
    assembleMingming,
    healParty,
    loadSave,
    applyRewardBundle,
    updateGauntlet,
    startGauntlet,
    completeGauntlet,
    unlockSector,
    startNewGauntlet,
    updateMingmingOS,
    swapOS,
    resetSave,
    addRelic
} = gameSlice.actions;

export default gameSlice.reducer;
