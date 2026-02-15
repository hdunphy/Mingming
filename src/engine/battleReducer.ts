
import type {
    IBattleState,
    TurnPhase,
    IBattleEntity,
    IDeckState,
    ProgramEntity,
    ProgramData,
    StatusType
} from './types';
import { globalBattleEventBus, type BattleEvent } from './events';
// We will import combatUtils later for card resolution
// import { calculateDamage, calculateHeal, calculateModifier } from './combatUtils';

import { GetProgramData } from './data/programRegistry';

// --- Constants ---
// Use the Registry to look up base costs.
const GetBaseCost = (dataId: string): number => {
    return GetProgramData(dataId).baseCost;
};

// --- Actions ---

export type BattleAction =
    | { type: 'INITIALIZE_BATTLE'; payload: IBattleState }
    | { type: 'PLAY_PROGRAM'; payload: { sourceId: string; targetId: string; programId: string } }
    | { type: 'TRANSFER_ENERGY'; payload: { sourceId: string; targetId: string } }
    | { type: 'END_TURN' };

// --- Constants ---

const HAND_SIZE_LIMIT = 9;
const TRANSFER_COST = 2; // Source pays 2
const TRANSFER_GAIN = 1; // Target gains 1

// --- Helper: Deep Copy (Simple version for MVP, or use Immer if added later) ---
// For now, we will use structuredClone or manual spread for immutability.
// structuredClone is available in Node 17+ and modern browsers.
// If target env is older, we might need a polyfill or JSON parse/stringify (slow).
// Since we are targeting modern React/Vite, structuredClone is likely fine.

// --- Reducer ---

export function battleReducer(state: IBattleState, action: BattleAction): IBattleState {
    switch (action.type) {
        case 'INITIALIZE_BATTLE':
            return action.payload;

        case 'PLAY_PROGRAM':
            return handlePlayProgram(state, action.payload);

        case 'TRANSFER_ENERGY':
            return handleTransferEnergy(state, action.payload);

        case 'END_TURN':
            return handleEndTurn(state);

        default:
            return state;
    }
}

// --- Action Handlers ---

function handlePlayProgram(state: IBattleState, payload: { sourceId: string; targetId: string; programId: string }): IBattleState {
    if (state.phase !== 'ACTION') {
        console.warn(`Attempted to play program during ${state.phase} phase.`);
        return state;
    }

    const { sourceId, targetId, programId } = payload;

    // 1. Identify Source Entity
    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const sourceIndex = state[activePartyKey].findIndex(e => e.id === sourceId);
    if (sourceIndex === -1) return state;

    const sourceEntity = state[activePartyKey][sourceIndex];

    // 2. Identify Card in Hand
    const activeDeckKey = state.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const hand = state[activeDeckKey].hand;
    const cardIndex = hand.findIndex(c => c.id === programId);

    if (cardIndex === -1) {
        console.warn("Card not found in hand");
        return state;
    }

    const card = hand[cardIndex];

    // 3. Check Energy
    if (sourceEntity.currentEnergy < card.currentCost) {
        console.warn("Insufficient Energy");
        return state;
    }

    // 4. Pay Energy
    const newSourceEntity = {
        ...sourceEntity,
        currentEnergy: sourceEntity.currentEnergy - card.currentCost
    };

    const newParty = [...state[activePartyKey]];
    newParty[sourceIndex] = newSourceEntity;

    // 5. Remove Card from Hand (Move to Discard or Limbo? Post-turn moves to discard.
    // Spec says: "POST_TURN: Discard: discardPile.push(...hand)".
    // Usually played cards go to discard immediately, or "Resolution Stack".
    // For MVP let's move to discard immediately or just remove from hand?
    // Spec 3.1: "PRE_TURN: ... draw to 9". "POST_TURN: Discard hand".
    // Usually played cards are discarded.
    // Let's move to discard.
    const newHand = [...hand];
    newHand.splice(cardIndex, 1);

    const newDiscard = [...state[activeDeckKey].discard, card];

    // 6. Emit Event
    globalBattleEventBus.emit({
        type: 'PROGRAM_PLAYED',
        sourceId,
        targetId,
        programId: card.dataId,
        timestamp: Date.now()
    });

    // 7. Resolve Effect (Stub for now - we need the Effect System to modify Target)
    // TODO: Use Effect Handlers here

    return {
        ...state,
        [activePartyKey]: newParty,
        [activeDeckKey]: {
            ...state[activeDeckKey],
            hand: newHand,
            discard: newDiscard
        }
    };
}

function handleTransferEnergy(state: IBattleState, payload: { sourceId: string; targetId: string }): IBattleState {
    if (state.phase !== 'ACTION') return state;

    const { sourceId, targetId } = payload;
    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const party = [...state[activePartyKey]];

    const sourceIndex = party.findIndex(e => e.id === sourceId);
    const targetIndex = party.findIndex(e => e.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return state;

    const source = party[sourceIndex];
    const target = party[targetIndex];

    if (source.currentEnergy < TRANSFER_COST) return state;

    // Execute Transfer
    party[sourceIndex] = { ...source, currentEnergy: source.currentEnergy - TRANSFER_COST };
    party[targetIndex] = { ...target, currentEnergy: Math.min(target.maxEnergy, target.currentEnergy + TRANSFER_GAIN) };

    return {
        ...state,
        [activePartyKey]: party
    };
}

function handleEndTurn(state: IBattleState): IBattleState {
    if (state.phase !== 'ACTION') return state;

    // Transition to POST_TURN
    let newState = { ...state, phase: 'POST_TURN' as TurnPhase };

    // Execute Post-Turn Logic (DoT, specific end turn effects)
    newState = processPostTurn(newState);

    // Transition to PRE_TURN of next player
    newState = processPreTurn(newState);

    // Set Phase to ACTION for the next player
    newState.phase = 'ACTION';

    return newState;
}

// --- Phase Processors ---

function processPostTurn(state: IBattleState): IBattleState {
    // 0. Emit Phase Start
    globalBattleEventBus.emit({ type: 'PHASE_START', phase: 'POST_TURN', timestamp: Date.now() });

    const activeParty = state.activeSide === 'PLAYER' ? state.playerParty : state.enemyParty;
    const otherParty = state.activeSide === 'PLAYER' ? state.enemyParty : state.playerParty;

    // 1. Resolve Status Effects (Burn, Poison, Regen) & Decrement Durations
    const processedActiveParty = activeParty.map(entity => {
        // Logic for DoT would go here (e.g. reduce HP if burned)
        // For now, just decrement durations
        const newEffects = entity.statusEffects
            .map(e => ({ ...e, duration: e.duration - 1 }))
            .filter(e => e.duration > 0);

        // Placeholder for removing "Temp HP" if we had that logic
        return { ...entity, statusEffects: newEffects, tempHp: 0 };
    });

    // 2. Discard Hand (Hand is in DeckState, we need to move hand to discard)
    // We need to update the deck state for the active player
    const activeDeckKey = state.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const currentDeckState = state[activeDeckKey];

    const newDeckState = {
        ...currentDeckState,
        discard: [...currentDeckState.discard, ...currentDeckState.hand],
        hand: []
    };

    globalBattleEventBus.emit({ type: 'PHASE_END', phase: 'POST_TURN', timestamp: Date.now() });

    return {
        ...state,
        [state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty']: processedActiveParty,
        [activeDeckKey]: newDeckState,
        turn: state.turn, // Turn number increments in PreTurn of appropriate side? Or end of round?
        // Usually Turn 1: Player -> Enemy -> Turn 2.
    };
}

function processPreTurn(state: IBattleState): IBattleState {
    globalBattleEventBus.emit({ type: 'PHASE_START', phase: 'PRE_TURN', timestamp: Date.now() });

    // 1. Toggle Active Side
    const nextSide = state.activeSide === 'PLAYER' ? 'ENEMY' : 'PLAYER';
    const nextTurn = nextSide === 'PLAYER' ? state.turn + 1 : state.turn; // Increment turn when looping back to Player?

    const activePartyKey = nextSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const activeDeckKey = nextSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';

    const activeParty = state[activePartyKey];
    const activeDeck = state[activeDeckKey];

    // 2. Reset Energy & Handle Statuses that trigger start of turn
    const refreshedParty = activeParty.map(entity => ({
        ...entity,
        currentEnergy: entity.maxEnergy
    }));

    // 3. Draw Cards (Up to HAND_SIZE_LIMIT)
    let currentHand = [...activeDeck.hand];
    let currentDeck = [...activeDeck.deck]; // Strings (IDs)
    let currentDiscard = [...activeDeck.discard]; // ProgramEntities

    // We need a way to convert ProgramData ID to ProgramEntity
    // For now, let's assume we have a helper or factory. 
    // Since we don't have the Program definitions here, we might need to pass them or use a lookup.
    // For the reducer to be pure, it should have access to definitions or they should be unnecessary for ID moving.
    // Converting ID -> Entity happens on instantiation.

    // NOTE: The DeckState.deck is string[] (IDs). Hand is ProgramEntity[].
    // We need to instantiate entities when drawing.
    // This implies we need a 'ProgramRef' from a global lookup.
    // For this MVP, we will stub the "Instantiate" part or require `programLookup` in payload.
    // But Reducer signature is fixed.
    // Solution: The State should probably hold the definitions or we import a singleton lookup (less pure).
    // Or, we change DeckState.deck to be ProgramEntities (sleeping).

    // Implementation for MVP: Creating dummy entities with ID.
    const cardsToDraw = HAND_SIZE_LIMIT - currentHand.length;

    for (let i = 0; i < cardsToDraw; i++) {
        if (currentDeck.length === 0) {
            if (currentDiscard.length === 0) break; // No cards left
            // Shuffle Discard into Deck
            // In a real app we'd map discard entities back to IDs? Or just shuffle entities?
            // If we want to persist state (current cost etc), better to keep entities.
            // Types says Deck is string[]. Discard is ProgramEntity[].
            // So we extract IDs from discard.
            currentDeck = currentDiscard.map(e => e.dataId); // Using dataId as ref
            // Shuffle (Fisher-Yates) - creating a seeded random would be ideal here.
            // For now, simple sort.
            currentDeck.sort(() => Math.random() - 0.5);
            currentDiscard = [];

            globalBattleEventBus.emit({ type: 'DECK_SHUFFLED', ownerId: nextSide, timestamp: Date.now() });
        }

        const newCardId = currentDeck.shift();
        if (newCardId) {
            // Instantiate
            const newEntity: ProgramEntity = {
                id: crypto.randomUUID(), // Unique instance ID
                dataId: newCardId,
                currentCost: GetBaseCost(newCardId),
                isPlayable: true
            };
            currentHand.push(newEntity);
            globalBattleEventBus.emit({ type: 'CARD_DRAWN', ownerId: nextSide, cardId: newCardId, timestamp: Date.now() });
        }
    }

    globalBattleEventBus.emit({ type: 'PHASE_END', phase: 'PRE_TURN', timestamp: Date.now() });

    return {
        ...state,
        activeSide: nextSide,
        turn: nextTurn,
        [activePartyKey]: refreshedParty,
        [activeDeckKey]: {
            ...activeDeck,
            deck: currentDeck,
            hand: currentHand,
            discard: currentDiscard
        }
    };
}
