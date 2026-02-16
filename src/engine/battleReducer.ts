
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
import { effectHandlers } from './effectHandlers';
import { drawCards, discardHand } from './deckLogic';

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
    | { type: 'END_TURN' }
    | { type: 'APPLY_STATUS'; payload: { targetId: string; status: StatusType; stacks: number } };

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

        case 'APPLY_STATUS':
            // Direct application via action (for testing or game logic)
            return effectHandlers['APPLY_STATUS'](state, action.payload);

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

    // 7. Resolve Effect
    // Lookup Program Data to get actions
    // Note: We need GetProgramData again.
    // Optimization: Should have looked it up earlier for Cost check too, but cost is on Entity (cached).
    // Now we need the full definition.
    const programData = GetProgramData(card.dataId);

    // Iterate through actions and apply them
    let newState = {
        ...state,
        [activePartyKey]: newParty,
        [activeDeckKey]: {
            ...state[activeDeckKey],
            hand: newHand,
            discard: newDiscard
        }
    };

    if (programData && programData.actions) {
        // Iterate through actions and apply them
        for (const action of programData.actions) {
            // Target Resolution
            let targetIds: string[] = [];

            //TODO: Does all work here? Also this is not easy to follow.
            if (programData.target === 'Side' || programData.target === 'All') {
                // Determine which side the lead target belongs to
                const isOnPlayerSide = state.playerParty.some(e => e.id === targetId);
                const targetParty = isOnPlayerSide ? state.playerParty : state.enemyParty;
                targetIds = targetParty.filter(e => e.currentHp > 0).map(e => e.id);
            } else if (action.target === 'SELF' || action.target === 'Self') { //Why SELF and Self??
                targetIds = [sourceId];
            } else {
                targetIds = [targetId];
            }

            // Execute action for each target
            for (const tId of targetIds) {
                // Check if target is still alive (relevant for multi-hit single target, less for Side)
                const targetEntity = newState.playerParty.find(e => e.id === tId) || newState.enemyParty.find(e => e.id === tId);
                if (targetEntity && targetEntity.currentHp <= 0) continue;

                const handler = effectHandlers[action.type];
                if (handler) {
                    newState = handler(newState, {
                        sourceId,
                        targetId: tId,
                        power: action.power || 0,
                        element: action.element || programData.element,
                        status: action.status,
                        stacks: action.stacks || 1
                    });
                }
            }
        }
    }

    return newState;
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

// Helper to look up resolvestatusEffects since we can't import circular?
// effectHandlers exports it.
import { resolvestatusEffects } from './effectHandlers';

function processPostTurn(state: IBattleState): IBattleState {
    globalBattleEventBus.emit({ type: 'PHASE_START', phase: 'POST_TURN', timestamp: Date.now() });

    // Emit TURN_END for the finishing player
    globalBattleEventBus.emit({
        type: 'TURN_END',
        turnNumber: state.turn,
        activeSide: state.activeSide,
        timestamp: Date.now()
    });

    // 0. Resolve Burn / DoT (Before duration decrement?)
    // User said "Update the Burn resolver".
    // Usually DoT happens, then ticks down.
    let newState = resolvestatusEffects(state);

    const activePartyKey = newState.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const activeDeckKey = newState.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const activeParty = newState[activePartyKey];

    // 1. Resolve Status Effects & Decrement Durations
    const processedActiveParty = activeParty.map(entity => {
        const newEffects = [];

        for (const effect of entity.statusEffects) {
            const newDuration = effect.duration - 1;
            if (newDuration > 0) {
                newEffects.push({ ...effect, duration: newDuration });
            } else {
                // Expired
                globalBattleEventBus.emit({
                    type: 'STATUS_REMOVED',
                    targetId: entity.id,
                    status: effect.type,
                    timestamp: Date.now()
                });
            }
        }

        return { ...entity, statusEffects: newEffects, tempHp: 0 };
    });

    // 2. Discard Hand
    const newDeckState = discardHand(newState[activeDeckKey]);

    globalBattleEventBus.emit({ type: 'PHASE_END', phase: 'POST_TURN', timestamp: Date.now() });

    return {
        ...newState,
        [activePartyKey]: processedActiveParty,
        [activeDeckKey]: newDeckState,
    };
}

function processPreTurn(state: IBattleState): IBattleState {
    globalBattleEventBus.emit({ type: 'PHASE_START', phase: 'PRE_TURN', timestamp: Date.now() });

    // 1. Toggle Active Side
    const nextSide = state.activeSide === 'PLAYER' ? 'ENEMY' : 'PLAYER';
    const nextTurn = nextSide === 'PLAYER' ? state.turn + 1 : state.turn;

    const activePartyKey = nextSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const activeDeckKey = nextSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';

    const activeParty = state[activePartyKey];
    const activeDeck = state[activeDeckKey];

    // Emit TURN_START
    globalBattleEventBus.emit({
        type: 'TURN_START',
        turnNumber: nextTurn,
        activeSide: nextSide,
        timestamp: Date.now()
    });

    // 2. Reset Energy & Handle Statuses
    //Todo: Asleep still has energy and can use cards. Most cards will have the constraint on them that the 
    // unit must not be asleep to play them. 
    const refreshedParty = activeParty.map(entity => ({
        ...entity,
        currentEnergy: entity.maxEnergy
    }));

    // 3. Draw Cards
    const cardsToDraw = HAND_SIZE_LIMIT - activeDeck.hand.length;
    const newDeckState = drawCards(activeDeck, cardsToDraw);

    globalBattleEventBus.emit({ type: 'PHASE_END', phase: 'PRE_TURN', timestamp: Date.now() });

    return {
        ...state,
        activeSide: nextSide,
        turn: nextTurn,
        [activePartyKey]: refreshedParty,
        [activeDeckKey]: newDeckState
    };
}
