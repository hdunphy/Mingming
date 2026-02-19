
import type {
    IBattleState,
    TurnPhase,
    IBattleEntity,
    IDeckState,
    ProgramEntity,
    ProgramData,
    StatusType,
    StatusEffectInstance,
    ProgramConstraint
} from './types';
import { globalBattleEventBus, type BattleEvent } from './events';
import { HookPriority, type MutationRequest, type HookContext, type HookDefinition, type HookResult, getHook } from './core/Hooks';
// We will import combatUtils later for card resolution
// import { calculateDamage, calculateHeal, calculateModifier } from './combatUtils';

import { GetProgramData } from './data/programRegistry';
import { getOSBehavior } from './data/firmwareRegistry';
import { effectHandlers, checkDefeat } from './effectHandlers';
import { drawCards, discardHand } from './deckLogic';

// --- Helpers ---
function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

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
export function validateSingleConstraint(
    constraint: ProgramConstraint,
    source: IBattleEntity,
    subject: IBattleEntity,
    cost: number
): boolean {


    switch (constraint.type) {
        case 'HAS_STATUS':
            const hasStatus = subject.statusEffects.some(s => s.type === constraint.value);
            if (!hasStatus) {
                return false;
            }
            break;

        case 'HEALTH_THRESHOLD':
            // value format: "LT:30" (Less Than 30%) or "GT:50" (Greater Than 50%)
            if (typeof constraint.value !== 'string') break;
            const [op, valStr] = constraint.value.split(':');
            const threshold = parseInt(valStr);
            const hpPercent = (subject.currentHp / subject.maxHp) * 100;

            if (op === 'LT' && hpPercent >= threshold) {
                return false;
            }
            if (op === 'GT' && hpPercent <= threshold) {
                return false;
            }
            break;

        case 'BASE':
            // 1. Base Energy Check
            if (source.currentEnergy < cost) {
                return false;
            }
            break;

        case 'NOT_STATUS':
            const hasBlockingStatus = subject.statusEffects.some(s => s.type === constraint.value);
            if (hasBlockingStatus) {
                return false;
            }
            break;

        default:
            console.warn(`Unknown constraint type: ${constraint.type}`);
            break;
    }

    return true;
}

/**
 * Validates all play requirements for a program including energy and custom constraints.
 */
export function validateProgramConstraints(
    _state: IBattleState,
    source: IBattleEntity,
    target: IBattleEntity | undefined,
    program: ProgramData,
    cost: number
): boolean {

    // 2. Custom Constraints
    if (program.constraints) {
        for (const constraint of program.constraints) {
            const subject = constraint.target === 'SELF' ? source : target;
            if (!subject) {
                // If it requires a target and no target is selected? 
                // Usually target is required for Single, but not for Side/All (it iterates later).
                // But for constraints, if it checks target, we need one.
                if (constraint.target === 'TARGET') {
                    return false;
                }
                continue;
            }
            if (!validateSingleConstraint(constraint, source, subject, cost)) {
                return false;
            }
        }
    }
    else {
        //TODO add details about program for debugging.
        console.log("[Warning]: No constraints found for program.");
    }
    return true;
}

/**
 * Applies a list of mutations to the state in a single atomic update.
 */
import { applyMutations, executeResolutionStack, executeDraw, executeStatusDamageCalculated } from './resolutionEngine';

function handlePlayProgram(state: IBattleState, payload: { sourceId: string; targetId: string; programId: string }): IBattleState {
    if (state.phase !== 'ACTION') {
        console.warn(`Attempted to play program during ${state.phase} phase.`);
        return state;
    }

    const { sourceId, targetId, programId } = payload;

    // 1. Identify Source & Card
    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const sourceIndex = state[activePartyKey].findIndex(e => e.id === sourceId);
    if (sourceIndex === -1) return state;

    const sourceEntity = state[activePartyKey][sourceIndex];
    const activeDeckKey = state.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const hand = state[activeDeckKey].hand;
    const cardIndex = hand.findIndex(c => c.id === programId);

    if (cardIndex === -1) return state;

    const card = hand[cardIndex];
    const programData = GetProgramData(card.dataId);
    const targetEntity = state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId);

    // 2. Validate Constraints
    if (!validateProgramConstraints(state, sourceEntity, targetEntity, programData, card.currentCost)) {
        return state;
    }

    // --- The Snapshot Pattern ---
    let snapshot = state;

    // 3. Pay Cost (Snapshot Mutation)
    const newHand = [...snapshot[activeDeckKey].hand];
    newHand.splice(cardIndex, 1);

    const isDaemon = programData.category === 'Daemon';
    const isExhaust = programData.exhaust || programData.isToken;
    const newDiscard = (isDaemon || isExhaust) ? [...snapshot[activeDeckKey].discard] : [...snapshot[activeDeckKey].discard, card];

    snapshot = {
        ...snapshot,
        [activePartyKey]: snapshot[activePartyKey].map(e => {
            if (e.id === sourceId) {
                const updatedEntity = { ...e, currentEnergy: e.currentEnergy - card.currentCost };
                if (isDaemon) {
                    return { ...updatedEntity, daemons: [...updatedEntity.daemons, card] };
                }
                return updatedEntity;
            }
            return e;
        }),
        [activeDeckKey]: {
            ...snapshot[activeDeckKey],
            hand: newHand,
            discard: newDiscard
        },
        cardsPlayedThisTurn: snapshot.cardsPlayedThisTurn + 1
    };

    // 4. Initial Context
    const context: HookContext = {
        source: sourceEntity,
        target: targetEntity,
        program: programData,
        state: snapshot,
        triggerDepth: 0
    };

    // 5. System Layer: onActionStart
    const { state: afterStart, isCancelled } = executeResolutionStack(snapshot, 'onActionStart', context);
    if (isCancelled) return afterStart;
    snapshot = afterStart;

    // 6. Logging Layer: Emission (Priority 0)
    snapshot = applyMutations(snapshot, [{
        type: 'EVENT',
        targetId: '',
        payload: {
            type: 'PROGRAM_PLAYED',
            sourceId,
            targetId,
            programId: card.dataId,
            timestamp: Date.now()
        }
    }, {
        type: 'LOG',
        targetId: '',
        payload: `${sourceEntity.name} plays ${programData.name} → ${targetEntity?.name || 'unknown'}`
    }]);

    // 7. Iterative Multi-Hit Resolution
    let finalState = snapshot;
    if (programData.actions) {
        for (const action of programData.actions) {
            const hits = action.count || 1;

            for (let i = 0; i < hits; i++) {
                // Target Resolution (per hit)
                let targetIds: string[] = [];
                if (action.target === 'SELF' || action.target === 'Self') {
                    targetIds = [sourceId];
                } else if (programData.target === 'Side' || programData.target === 'All') {
                    const isOnPlayerSide = finalState.playerParty.some(e => e.id === targetId);
                    const targetParty = isOnPlayerSide ? finalState.playerParty : finalState.enemyParty;
                    targetIds = targetParty.filter(e => e.currentHp > 0).map(e => e.id);
                } else {
                    targetIds = [targetId];
                }

                for (const tId of targetIds) {
                    const currentTarget = finalState.playerParty.find(e => e.id === tId) || finalState.enemyParty.find(e => e.id === tId);
                    if (!currentTarget || currentTarget.currentHp <= 0) continue;

                    // Action-level Conditionals
                    if (action.conditionals) {
                        let allMet = true;
                        for (const constraint of action.conditionals) {
                            const subject = constraint.target === 'SELF' ? sourceEntity : currentTarget;
                            if (!validateSingleConstraint(constraint, sourceEntity, subject, 0)) {
                                allMet = false;
                                break;
                            }
                        }
                        if (!allMet) continue;
                    }

                    // Modifier Phase
                    const hitContext = { ...context, target: currentTarget, state: finalState };
                    const { state: afterMod, isCancelled: hitCancelled } = executeResolutionStack(finalState, 'onModifierPhase', hitContext);
                    if (hitCancelled) continue;
                    finalState = afterMod;

                    // Execution
                    if (action.type === 'DRAW') {
                        const isPlayerSource = snapshot.playerParty.some(e => e.id === sourceId);
                        const side = isPlayerSource ? 'PLAYER' : 'ENEMY';
                        finalState = executeDraw(finalState, side, action.count || 1, false, sourceId);
                    } else if (action.type === 'STATUS' || action.type === 'APPLY_STATUS') {
                        finalState = applyMutations(finalState, [{
                            type: 'STATUS',
                            targetId: tId,
                            sourceId: sourceId,
                            payload: {
                                status: action.status,
                                stacks: action.stacks || 1
                            }
                        }]);
                    } else {
                        const handler = effectHandlers[action.type];
                        if (handler) {
                            finalState = handler(finalState, {
                                sourceId,
                                targetId: tId,
                                power: action.power || 0,
                                count: 1, // Single discrete hit
                                element: action.element || programData.element,
                                status: action.status,
                                stacks: action.stacks || 1,
                                program: programData,
                                action: action // Pass full action for scaling etc
                            });
                        }
                    }

                    // Post-Damage Phase
                    const { state: afterPost } = executeResolutionStack(finalState, 'onPostDamage', { ...hitContext, state: finalState });
                    finalState = afterPost;
                }
            }
        }
    }

    return finalState;
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

    let newState = addLog(state, `--- ${state.activeSide} ends their turn ---`);
    newState = { ...newState, phase: 'POST_TURN' as TurnPhase };

    // Execute Post-Turn Logic
    newState = processPostTurn(newState);

    // Transition to PRE_TURN of next player
    newState = processPreTurn(newState);

    // Set Phase to ACTION for the next player
    newState = { ...newState, phase: 'ACTION' as TurnPhase, cardsPlayedThisTurn: 0 };

    return newState;
}

import { getStatusBehavior } from './StatusBehaviors';

function processPostTurn(state: IBattleState): IBattleState {
    globalBattleEventBus.emit({ type: 'PHASE_START', phase: 'POST_TURN', timestamp: Date.now() });

    // Emit TURN_END for the finishing player
    globalBattleEventBus.emit({
        type: 'TURN_END',
        turnNumber: state.turn,
        activeSide: state.activeSide,
        timestamp: Date.now()
    });

    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const activeDeckKey = state.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const activeParty = state[activePartyKey];

    // Process each entity's status effects via behavior.endTurn()
    const statusLogs: string[] = [];
    const defeatedThisTurn: string[] = [];

    const processedActiveParty = activeParty.map((entity: IBattleEntity) => {
        let currentHp = entity.currentHp;
        let defense = entity.defense;
        const newEffects: StatusEffectInstance[] = [];

        if (currentHp <= 0) return entity;

        for (const effect of entity.statusEffects) {
            const behavior = getStatusBehavior(effect.type);
            const result = behavior.endTurn(effect, entity);

            let damage = result.damage;

            // Apply scaling hooks (e.g., Thermal Overload boosting Burn damage)
            if (damage > 0) {
                const context: HookContext = {
                    source: undefined, // System or self?
                    target: entity,
                    state: state,
                    triggerDepth: 0
                };

                // We use calculateStatusDamage naming or just reuse the logic
                // For simplicity, let's call it 'onStatusDamageCalculated'
                const { state: _, damage: finalDamage } = executeStatusDamageCalculated(state, entity, damage, effect.type);
                damage = finalDamage;
            }

            // Apply damage
            if (damage > 0) {
                currentHp = Math.max(0, currentHp - damage);

                if (currentHp <= 0) {
                    defeatedThisTurn.push(entity.id);
                }

                statusLogs.push(`  → ${entity.name} takes ${damage} damage from ${effect.type}`);

                globalBattleEventBus.emit({
                    type: 'DAMAGE_TAKEN',
                    targetId: entity.id,
                    amount: damage,
                    element: effect.type === 'Burn' ? 'Fire' : 'None',
                    timestamp: Date.now()
                });
            }

            // Apply healing
            if (result.healing && result.healing > 0) {
                currentHp = Math.min(entity.maxHp, currentHp + result.healing);
                globalBattleEventBus.emit({
                    type: 'HEAL',
                    targetId: entity.id,
                    amount: result.healing,
                    timestamp: Date.now()
                });
            }

            // Apply defense shred
            if (result.defenseShred > 0) {
                defense = Math.max(0, defense - result.defenseShred);
            }

            // Keep or remove
            if (result.updatedInstance) {
                newEffects.push(result.updatedInstance);
            } else {
                globalBattleEventBus.emit({
                    type: 'STATUS_REMOVED',
                    targetId: entity.id,
                    status: effect.type,
                    timestamp: Date.now()
                });

                // If Asleep wore off naturally, apply Awoken protection
                if (effect.type === 'Asleep') {
                    const awokenBehavior = getStatusBehavior('Awoken');
                    const awokenApply = awokenBehavior.onApply(newEffects, 1, entity);
                    newEffects.push(...awokenApply.updatedEffects.filter(s => s.type === 'Awoken'));
                    statusLogs.push(...awokenApply.logs);
                }
            }

            // Collect logs
            statusLogs.push(...result.logs);
        }

        return { ...entity, currentHp, defense, statusEffects: newEffects, tempHp: 0 };
    });

    // 2. Discard Hand
    const newDeckState = discardHand(state[activeDeckKey]);

    globalBattleEventBus.emit({ type: 'PHASE_END', phase: 'POST_TURN', timestamp: Date.now() });

    let nextState: IBattleState = {
        ...state,
        [activePartyKey]: processedActiveParty,
        [activeDeckKey]: newDeckState,
        logs: [...state.logs, ...statusLogs],
    };

    // Award XP for status effect deaths
    for (const dId of defeatedThisTurn) {
        nextState = checkDefeat(nextState, dId);
        const name = nextState.playerParty.find(e => e.id === dId)?.name || nextState.enemyParty.find(e => e.id === dId)?.name;
        nextState = addLog(nextState, `  ☠️ ${name} DEFEATED BY STATUS`);
    }

    // 3. Trigger onTurnEnd Hooks (ONLY for the side whose turn just ended)
    const candidates = [...nextState[activePartyKey]].filter(e => e.currentHp > 0);
    for (const entity of candidates) {
        const { state: afterTurnEnd } = executeResolutionStack(nextState, 'onTurnEnd', {
            source: entity,
            state: nextState,
            triggerDepth: 0
        });
        nextState = afterTurnEnd;
    }

    return nextState;
}

function processPreTurn(state: IBattleState): IBattleState {
    globalBattleEventBus.emit({ type: 'PHASE_START', phase: 'PRE_TURN', timestamp: Date.now() });

    // 1. Toggle Active Side
    const nextSide = state.activeSide === 'PLAYER' ? 'ENEMY' as const : 'PLAYER' as const;
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
    // Refill to max, then add Energized bonuses
    const refreshedParty = activeParty.map(entity => {
        const energizedEffect = entity.statusEffects.find(s => s.type === 'Energized');
        const bonusEnergy = energizedEffect ? energizedEffect.stacks : 0;

        return {
            ...entity,
            currentEnergy: entity.maxEnergy + bonusEnergy,
            statusEffects: entity.statusEffects.filter(s => s.type !== 'Energized')
        };
    });

    // 3. Draw Cards — based on alive party members' cardDraw stats
    const aliveMembers = refreshedParty.filter((e: IBattleEntity) => e.currentHp > 0);
    const totalCardDraw = aliveMembers.reduce((sum: number, e: IBattleEntity) => sum + e.cardDraw, 0) - aliveMembers.length + 1;
    const cardsToDraw = Math.min(totalCardDraw, HAND_SIZE_LIMIT - activeDeck.hand.length);
    console.log(`Drawing ${cardsToDraw} cards from ${totalCardDraw} total card draw`);

    let newState = executeDraw(state, nextSide, cardsToDraw, true);

    globalBattleEventBus.emit({ type: 'PHASE_END', phase: 'PRE_TURN', timestamp: Date.now() });

    newState = {
        ...newState,
        activeSide: nextSide,
        turn: nextTurn,
        [activePartyKey]: refreshedParty,
    };

    newState = addLog(newState, `⚔️ Turn ${nextTurn} — ${nextSide}'s turn begins`);

    return newState;
}
