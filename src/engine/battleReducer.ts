
import type {
    IBattleState,
    TurnPhase,
    IBattleEntity,
    ProgramData,
    StatusType,
    StatusEffectInstance,
    ProgramConstraint,
    IMove
} from './types';
import { globalBattleEventBus } from './events';
import { type HookContext } from './core/Hooks';
// We will import combatUtils later for card resolution
// import { calculateDamage, calculateHeal, calculateModifier } from './combatUtils';

import { GetProgramData } from './data/programRegistry';
import { effectHandlers, checkDefeat } from './effectHandlers';
import { discardHand } from './deckLogic';
import { ActionExecutorRegistry } from './actions/ActionExecutors';
import { ConditionValidator } from './core/ConditionValidator';
import { generateIntents } from './core/IntentUtils';
import { applyMutations, executeResolutionStack, executeDraw, executeStatusDamageCalculated, executeCostCalculated } from './resolutionEngine';
import { getOSBehavior } from './data/firmwareRegistry';

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
    | { type: 'PLAY_PROGRAM'; payload: { sourceId: string; targetId: string; programId: string } }
    | { type: 'TRANSFER_ENERGY'; payload: { sourceId: string; targetId: string } }
    | { type: 'END_TURN' }
    | { type: 'APPLY_STATUS'; payload: { targetId: string; status: StatusType; stacks: number; sourceId?: string } }
    | { type: 'EXECUTE_INTENT'; payload: { sourceId: string } }
    // --- General-purpose state actions ---
    // Ordinary engine actions, NOT debug-only tooling and NOT DEV-gated: a card or
    // relic can plausibly want to express each of these. The debug overlay is merely
    // their first consumer. See docs/wayfinder/debug-toolkit/tickets/14-engine-state-actions.md.
    | { type: 'SET_VITALS'; payload: { entityId: string; hp?: number; energy?: number; tempHp?: number; sourceId: string } }
    | { type: 'REMOVE_STATUS'; payload: { entityId: string; status?: StatusType } }
    | { type: 'ADD_CARD_TO_HAND'; payload: { side: 'PLAYER' | 'ENEMY'; dataId: string } }
    | { type: 'SET_INTENT'; payload: { entityId: string; move: IMove | null } }
    | { type: 'KILL_ENTITY'; payload: { entityId: string; sourceId: string } };

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
        case 'PLAY_PROGRAM':
            return handlePlayProgram(state, action.payload);

        case 'TRANSFER_ENERGY':
            return handleTransferEnergy(state, action.payload);

        case 'END_TURN':
            return handleEndTurn(state);

        case 'APPLY_STATUS':
            // Direct application via action (for testing or game logic)
            return effectHandlers['APPLY_STATUS'](state, action.payload);

        case 'EXECUTE_INTENT':
            return handleExecuteIntent(state, action.payload);

        case 'SET_VITALS':
            return handleSetVitals(state, action.payload);

        case 'REMOVE_STATUS':
            return handleRemoveStatus(state, action.payload);

        case 'ADD_CARD_TO_HAND':
            return handleAddCardToHand(state, action.payload);

        case 'SET_INTENT':
            return handleSetIntent(state, action.payload);

        case 'KILL_ENTITY':
            return handleKillEntity(state, action.payload);

        default:
            return state;
    }
}

// --- Action Handlers ---
export function validateSingleConstraint(
    constraint: ProgramConstraint,
    source: IBattleEntity,
    subject: IBattleEntity,
    cost: number,
    state?: IBattleState
): boolean {
    return ConditionValidator.evaluateCardConstraint(constraint, source, subject, cost, state);
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
            if (!validateSingleConstraint(constraint, source, subject, cost, _state)) {
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
 * Whether the source's nextProgramModifier applies to this program
 * (a modifier restricted via appliesTo only affects that category).
 */
export function doesModifierApply(source: IBattleEntity, programData: ProgramData): boolean {
    const modifier = source.nextProgramModifier;
    return modifier !== undefined
        && (modifier.appliesTo === undefined || modifier.appliesTo === programData.category);
}

/**
 * The cost the source would ACTUALLY pay for this card right now,
 * including any primed nextProgramModifier discount (e.g. Gullinbursti's
 * UNSTOPPABLE_MASS). Shared by the reducer and the UI so the displayed
 * cost and the paid cost can never drift apart.
 */
export function getEffectiveCardCost(source: IBattleEntity, programData: ProgramData, currentCost: number): number {
    const reduction = doesModifierApply(source, programData)
        ? (source.nextProgramModifier?.costReduction || 0)
        : 0;
    return Math.max(0, currentCost - reduction);
}

/**
 * Applies a list of mutations to the state in a single atomic update.
 */

function handlePlayProgram(state: IBattleState, payload: { sourceId: string; targetId: string; programId: string }): IBattleState {
    if (state.phase !== 'ACTION') {
        console.warn(`Attempted to play program during ${state.phase} phase.`);
        return state;
    }

    // Safety: check if battle is over
    const isOver = (state.playerParty.length > 0 && state.playerParty.every(p => p.currentHp <= 0)) ||
        (state.enemyParty.length > 0 && state.enemyParty.every(e => e.currentHp <= 0));
    if (isOver) return state;

    const { sourceId, targetId, programId } = payload;

    // 1. Identify Source & Card
    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const sourceIndex = state[activePartyKey].findIndex(e => e.id === sourceId);
    if (sourceIndex === -1) {
        return state;
    }

    const sourceEntity = state[activePartyKey][sourceIndex];
    // Defeated units cannot act (their selection may linger in the UI).
    if (sourceEntity.currentHp <= 0) {
        return state;
    }
    // Per-unit OS card limit (e.g. YMIR v2 GLACIAL_PACE_OS: max 2 cards/turn).
    // Rejected silently like other validation failures — no log spam; the UI
    // (CardHand) surfaces the reason via the constraint tooltip instead.
    const osCardLimit = sourceEntity.activeOS ? getOSBehavior(sourceEntity.activeOS)?.maxCardsPerTurn : undefined;
    if (osCardLimit !== undefined && (sourceEntity.playsThisTurn ?? 0) >= osCardLimit) {
        return state;
    }
    const activeDeckKey = state.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const hand = state[activeDeckKey].hand;
    const cardIndex = hand.findIndex(c => c.id === programId);

    if (cardIndex === -1) {
        return state;
    }

    const card = hand[cardIndex];
    const programData = GetProgramData(card.dataId);
    const targetEntity = state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId);

    const modifier = sourceEntity.nextProgramModifier;
    // A modifier restricted via appliesTo only DISCOUNTS a card of that
    // category (e.g. UNSTOPPABLE_MASS discounts an Attack). The charge is
    // spent by the NEXT card either way (see the clearing block below).
    const modifierApplies = doesModifierApply(sourceEntity, programData);
    const appliedCostReduction = modifierApplies ? (modifier?.costReduction || 0) : 0;
    const baseCost = getEffectiveCardCost(sourceEntity, programData, card.currentCost);

    const costRes = executeCostCalculated(state, sourceEntity, targetEntity, programData, baseCost);
    const finalCost = costRes.cost;

    // 2. Validate Constraints
    // Note: Use costRes.state if needed, but since cost calculations rarely mutate, we'll keep it clean.
    if (!validateProgramConstraints(costRes.state, sourceEntity, targetEntity, programData, finalCost)) {
        return state;
    }

    // --- The Snapshot Pattern ---
    let snapshot = costRes.state;

    // 3. Pay Cost (Snapshot Mutation)
    const newHand = [...snapshot[activeDeckKey].hand];
    newHand.splice(cardIndex, 1);

    const isDaemon = programData.category === 'Daemon';
    const isExhaust = programData.exhaust || programData.isToken;
    const newDiscard = (isDaemon || isExhaust) ? [...snapshot[activeDeckKey].discard] : [...snapshot[activeDeckKey].discard, card];
    // Exhausted cards (and tokens) go to the exhaust pile instead of vanishing,
    // so RETURN-from-EXHAUST effects can actually recover them. Daemons live on
    // the entity (installed) and are excluded.
    const newExhaustPile = (isExhaust && !isDaemon)
        ? [...snapshot[activeDeckKey].exhaust, card]
        : snapshot[activeDeckKey].exhaust;

    snapshot = {
        ...snapshot,
        [activePartyKey]: snapshot[activePartyKey].map(e => {
            if (e.id === sourceId) {
                const updatedEntity: IBattleEntity = {
                    ...e,
                    currentEnergy: e.currentEnergy - finalCost,
                    playsThisTurn: (e.playsThisTurn ?? 0) + 1,
                    daemons: isDaemon ? [...e.daemons, card] : e.daemons
                };
                return updatedEntity;
            }
            return e;
        }),
        [activeDeckKey]: {
            ...snapshot[activeDeckKey],
            hand: newHand,
            discard: newDiscard,
            exhaust: newExhaustPile
        },
        cardsPlayedThisTurn: snapshot.cardsPlayedThisTurn + 1,
        lastStatusConsumed: 0,
        elementPlays: {
            'Fire': 0, 'Water': 0, 'Earth': 0, 'Air': 0, 'Nature': 0, 'Ice': 0, 'Light': 0, 'Dark': 0, 'None': 0,
            ...(snapshot.elementPlays || {}),
            [programData.element]: (snapshot.elementPlays?.[programData.element] || 0) + 1
        }
        // NOTE: lastProgramPlayed is intentionally NOT updated here. During action
        // resolution it must still refer to the PREVIOUS card so PLAY_LAST_CARD
        // (Reprogram) echoes the prior play instead of seeing itself. It is
        // updated once resolution completes (end of this function).
    };

    // 4. Initial Context
    const currentSource = snapshot[activePartyKey].find(e => e.id === sourceId)!;
    const context: HookContext = {
        source: currentSource,
        target: targetEntity,
        program: programData,
        state: snapshot,
        triggerDepth: 0
    };

    // 5. System Layer: onActionStart
    const { state: afterStart, isCancelled } = executeResolutionStack('onActionStart', context);
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
            //TODO: we don't need a hit count we can just loop through the actions array.
            const hitCount = (action as any).count || 1;

            for (let i = 0; i < hitCount; i++) {
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
                    const latestSource = finalState[activePartyKey].find(e => e.id === sourceId)!;
                    const hitContext: HookContext = { ...context, source: latestSource, target: currentTarget, state: finalState };
                    const { state: afterMod, isCancelled: hitCancelled } = executeResolutionStack('onModifierPhase', hitContext);
                    if (hitCancelled) continue;
                    finalState = afterMod;

                    // Execution
                    let modifiedAction = { ...action };
                    if (modifier && modifierApplies) {
                        if ((modifiedAction as any).power !== undefined) {
                            (modifiedAction as any).power = Math.floor(((modifiedAction as any).power + (modifier.flatBonus || 0)) * (modifier.multiplier || 1));
                        }
                        if (modifiedAction.type === 'STATUS' && (modifiedAction as any).stacks !== undefined) {
                            (modifiedAction as any).stacks = Math.floor(((modifiedAction as any).stacks + (modifier.flatBonus || 0)) * (modifier.multiplier || 1));
                        }
                        if (modifiedAction.type === 'HEAL' && (modifiedAction as any).power !== undefined) {
                            (modifiedAction as any).power = Math.floor(((modifiedAction as any).power + (modifier.flatBonus || 0)) * (modifier.multiplier || 1));
                        }
                    }

                    const executor = ActionExecutorRegistry[modifiedAction.type];
                    if (executor) {
                        finalState = executor.execute(finalState, sourceId, tId, modifiedAction as any, programData, hitContext);
                    } else {
                        console.warn(`[BattleReducer] No executor found for action type: ${modifiedAction.type}`);
                    }

                    // Post-Damage Phase
                    const { state: afterPost } = executeResolutionStack('onPostDamage', { ...hitContext, state: finalState });
                    finalState = afterPost;

                }
            }
        }
    }

    // Clear the modifier after this card resolves, whether or not it applied:
    // the charge is spent by the NEXT card, full stop (a category-restricted
    // buff like UNSTOPPABLE_MASS simply grants no discount if that next card
    // is the wrong category — it does not linger waiting for a match).
    // Reference-equality guard: a modifier set DURING this card's own
    // resolution (e.g. Gullinbursti priming off the Status card just played)
    // must not be wiped by the very play that created it.
    const activePartyAfter = finalState[activePartyKey].map(e => {
        if (e.id === sourceId && modifier !== undefined && e.nextProgramModifier === modifier) {
            const { nextProgramModifier, ...rest } = e;
            return rest;
        }
        return e;
    });

    finalState = {
        ...finalState,
        [activePartyKey]: activePartyAfter,
        lastProgramPlayed: card.dataId
    };

    return finalState;
}

function handleExecuteIntent(state: IBattleState, payload: { sourceId: string }): IBattleState {
    if (state.phase !== 'ACTION') return state;

    // Safety: check if battle is over
    const isOver = state.playerParty.every(p => p.currentHp <= 0) || state.enemyParty.every(e => e.currentHp <= 0);
    if (isOver) return state;

    const { sourceId } = payload;
    const sourceIndex = state.enemyParty.findIndex(e => e.id === sourceId);
    if (sourceIndex === -1) return state;

    const sourceEntity = state.enemyParty[sourceIndex];
    if (sourceEntity.currentHp <= 0 || !sourceEntity.currentIntent) return state;

    // Check for CC status effects (Stunned or Asleep)
    const isIncapacitated = sourceEntity.statusEffects.some(s => s.type === 'Stunned' || s.type === 'Asleep');
    if (isIncapacitated) {
        const stateWithLog = applyMutations(state, [
            {
                type: 'LOG',
                targetId: '',
                payload: `💤 ${sourceEntity.name} is incapacitated and cannot move!`
            },
            {
                type: 'EVENT',
                targetId: '',
                payload: {
                    type: 'INTENT_SKIPPED',
                    sourceId: sourceEntity.id,
                    timestamp: Date.now()
                }
            }
        ]);
        return {
            ...stateWithLog,
            enemyParty: stateWithLog.enemyParty.map((e, idx) => idx === sourceIndex ? { ...e, currentIntent: null } : e) as ReadonlyArray<IBattleEntity>
        };
    }

    const intent = sourceEntity.currentIntent;

    // 1. Initial State Updates (clear the intent)
    let snapshot: IBattleState = {
        ...state,
        enemyParty: state.enemyParty.map((e, idx) => idx === sourceIndex ? { ...e, currentIntent: null } : e) as ReadonlyArray<IBattleEntity>
    };

    // 2. Logging
    snapshot = applyMutations(snapshot, [{
        type: 'LOG',
        targetId: '',
        payload: `⚠️ ${sourceEntity.name} executes ${intent.name}!`
    }]);

    // Dummy ProgramData for hooks (if needed)
    const dummyProgram: ProgramData = {
        id: intent.id,
        name: intent.name,
        description: intent.intentType,
        element: sourceEntity.primaryElement,
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 0,
        constraints: [],
        actions: intent.actions
    };

    // 3. Action Execution loop
    let finalState = snapshot;
    for (const action of intent.actions) {
        const hitCount = (action as any).count || 1;

        for (let i = 0; i < hitCount; i++) {
            // Target Selection Helper (Deterministic via lowest HP for single, Side/Self logic)
            let targetIds: string[] = [];
            const isHealOrBuff = action.type === 'HEAL' || (action.type === 'STATUS' && ['Regen', 'Energized', 'Strengthened', 'Sharp', 'StableOS', 'BarkShield'].includes((action as any).status));

            if (action.target === 'SELF' || action.target === 'Self') {
                targetIds = [sourceId];
            } else if (action.target === 'Side' || action.target === 'All') {
                const targetParty = isHealOrBuff ? finalState.enemyParty : finalState.playerParty;
                targetIds = targetParty.filter(e => e.currentHp > 0).map(e => e.id);
            } else {
                // Select single target -- Deterministic "Lowest HP" for enemies targeting player, or Lowest HP ally for heals
                const targetParty = isHealOrBuff ? finalState.enemyParty : finalState.playerParty;
                const aliveMembers = targetParty.filter(e => e.currentHp > 0);
                if (aliveMembers.length > 0) {
                    if (!isHealOrBuff && sourceEntity.forcedTargetId) {
                        const forcedTarget = aliveMembers.find(e => e.id === sourceEntity.forcedTargetId);
                        if (forcedTarget) {
                            targetIds = [forcedTarget.id];
                        }
                    }

                    if (targetIds.length === 0) {
                        // Sorting by current HP (lowest first), then by ID to break ties deterministically
                        const sorted = [...aliveMembers].sort((a, b) => {
                            if (a.currentHp !== b.currentHp) return a.currentHp - b.currentHp;
                            return a.id.localeCompare(b.id);
                        });
                        targetIds = [sorted[0].id];
                    }
                }
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
                const hitContext: HookContext = { source: sourceEntity, target: currentTarget, program: dummyProgram, state: finalState, triggerDepth: 0 };
                const { state: afterMod, isCancelled: hitCancelled } = executeResolutionStack('onModifierPhase', hitContext);
                if (hitCancelled) continue;
                finalState = afterMod;

                // Execution
                const executor = ActionExecutorRegistry[action.type];
                if (executor) {
                    finalState = executor.execute(finalState, sourceId, tId, action as any, dummyProgram, hitContext);
                } else {
                    console.warn(`[BattleReducer] No executor found for intent action type: ${action.type}`);
                }

                // Post-Damage Phase
                const { state: afterPost } = executeResolutionStack('onPostDamage', { ...hitContext, state: finalState });
                finalState = afterPost;
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
    const removedStatusQueue: { targetId: string, status: string }[] = [];

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

                // Only record the defeat once, even if a second DoT (e.g. Burn +
                // Poison) ticks on the already-dead entity in the same end-turn.
                if (currentHp <= 0 && !defeatedThisTurn.includes(entity.id)) {
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
                removedStatusQueue.push({ targetId: entity.id, status: effect.type });

                // Hard CC Recovery Logic -> 1 turn StableOS Immunity
                if (effect.type === 'Asleep' || effect.type === 'Stunned') {
                    const stableBehavior = getStatusBehavior('StableOS');
                    const stableApply = stableBehavior.onApply(newEffects, 1, entity);
                    newEffects.push(...stableApply.updatedEffects.filter(s => s.type === 'StableOS'));
                    statusLogs.push(`  🛡️ ${entity.name} gained CC Immunity (StableOS)`);
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
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0
    };

    // 2.5 Dispatch onStatusRemoved Hooks
    for (const item of removedStatusQueue) {
        const afterTurnTarget = nextState.playerParty.find(e => e.id === item.targetId) || nextState.enemyParty.find(e => e.id === item.targetId);
        if (afterTurnTarget) {
            const context = {
                target: afterTurnTarget,
                statusApplied: item.status,
                state: nextState,
                triggerDepth: 0
            };
            const { state: afterHook } = executeResolutionStack('onStatusRemoved', context as any);
            nextState = afterHook;
        }
    }

    // Award XP for status effect deaths
    for (const dId of defeatedThisTurn) {
        nextState = checkDefeat(nextState, dId);
        const name = nextState.playerParty.find(e => e.id === dId)?.name || nextState.enemyParty.find(e => e.id === dId)?.name;
        nextState = addLog(nextState, `  ☠️ ${name} DEFEATED BY STATUS`);
    }

    // 3. Trigger onTurnEnd Hooks (ONLY for the side whose turn just ended)
    const candidates = [...nextState[activePartyKey]].filter(e => e.currentHp > 0);
    for (const entity of candidates) {
        const { state: afterTurnEnd } = executeResolutionStack('onTurnEnd', {
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
        // Defeated units get no energy refill — they cannot act.
        if (entity.currentHp <= 0) return entity;

        const energizedEffect = entity.statusEffects.find(s => s.type === 'Energized');
        const bonusEnergy = energizedEffect ? energizedEffect.stacks : 0;

        return {
            ...entity,
            currentEnergy: entity.maxEnergy + bonusEnergy,
            playsThisTurn: 0, // per-unit OS card limits (maxCardsPerTurn) reset each turn
            statusEffects: entity.statusEffects.filter(s => s.type !== 'Energized')
        };
    });

    let nextState: IBattleState = {
        ...state,
        turn: nextTurn,
        activeSide: nextSide,
        [activePartyKey]: refreshedParty
    };

    // Execute onTurnStart hooks
    const currentParty = nextState[activePartyKey];
    for (const entity of currentParty) {
        if (entity.currentHp <= 0) continue;
        const { state: afterHook } = executeResolutionStack('onTurnStart', {
            source: entity,
            state: nextState,
            triggerDepth: 0
        });
        nextState = afterHook;
    }

    // 3. Draw Cards for Player
    nextState = executeDraw(nextState, nextSide, 0, true);

    if (nextSide === 'PLAYER') {
        const alivePlayers = nextState.playerParty.filter((e: IBattleEntity) => e.currentHp > 0);
        const totalCardDraw = alivePlayers.length === 0
            ? 0
            : alivePlayers.reduce((sum: number, e: IBattleEntity) => sum + e.cardDraw, 0) - alivePlayers.length + 1;
        const cardsToDraw = Math.min(totalCardDraw, HAND_SIZE_LIMIT - nextState.playerDeck.hand.length);
        console.log(`Drawing ${cardsToDraw} cards from ${totalCardDraw} total card draw`);
        nextState = executeDraw(nextState, nextSide, cardsToDraw, true);
    }

    globalBattleEventBus.emit({ type: 'PHASE_END', phase: 'PRE_TURN', timestamp: Date.now() });

    // Intent Generation: telegraph enemy intents at the start of a turn (so the
    // player can see them) — but only for move-user enemies. Card-user battles
    // (enemyMode === 'CARDS', opt-in at battle creation) never generate intents.
    const finalEnemyParty = (nextState.enemyMode ?? 'MOVES') === 'MOVES'
        ? generateIntents(nextState.enemyParty, nextState.seed, nextTurn)
        : nextState.enemyParty;
    const finalPlayerParty = nextState.playerParty;

    let newState = {
        ...nextState,
        turn: nextTurn,
        phase: 'ACTION',
        activeSide: nextSide,
        playerParty: finalPlayerParty,
        enemyParty: finalEnemyParty,
        cardsPlayedThisTurn: 0,
        elementPlays: {
            'Fire': 0, 'Water': 0, 'Earth': 0, 'Air': 0, 'Nature': 0,
            'Ice': 0, 'Light': 0, 'Dark': 0, 'None': 0
        }
    } as any;

    newState = addLog(newState, `⚔️ Turn ${nextTurn} — ${nextSide}'s turn begins`);

    return newState;
}
// --- General-purpose State Actions ---
// SET_VITALS / REMOVE_STATUS / ADD_CARD_TO_HAND / SET_INTENT / KILL_ENTITY.
// Nothing below is debug-specific and nothing is DEV-gated: these ship as ordinary
// engine actions. They deliberately fire their real downstream processing so a board
// staged through them is indistinguishable from one the game produced itself.
// Recursion is bounded by resolutionEngine's resolutionStackDepth guard (cap 12).

/** Finds an entity by id in either party. */
function findBattleEntity(state: IBattleState, entityId: string): IBattleEntity | undefined {
    return state.playerParty.find(e => e.id === entityId)
        || state.enemyParty.find(e => e.id === entityId);
}

/** Applies a patch to one entity, wherever it lives (ids are unique across parties). */
function patchEntity(state: IBattleState, entityId: string, patch: Partial<IBattleEntity>): IBattleState {
    const apply = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => (e.id === entityId ? { ...e, ...patch } : e));
    return {
        ...state,
        playerParty: apply(state.playerParty),
        enemyParty: apply(state.enemyParty)
    };
}

/**
 * Runs a source/target hook phase against the CURRENT state.
 * Mirrors the card path: retaliation-style hooks read source-vs-target to decide
 * whether to fire, so the source must be a real entity, never a sentinel.
 */
function runVitalsHook(
    state: IBattleState,
    phase: 'onPostDamage' | 'onHeal',
    sourceId: string,
    targetId: string
): IBattleState {
    const target = findBattleEntity(state, targetId);
    if (!target) return state;
    const context: HookContext = {
        source: findBattleEntity(state, sourceId),
        target,
        state,
        triggerDepth: 0
    };
    const { state: afterHook } = executeResolutionStack(phase, context);
    return afterHook;
}

/**
 * Sets any combination of HP / energy / tempHp on a unit.
 *
 * An HP DECREASE is damage: it emits DAMAGE_TAKEN, runs the post-damage hooks and,
 * if lethal, the same checkDefeat death processing every other damage site uses
 * (handleAttack, end-of-turn DoT) - death is derived from currentHp <= 0 everywhere,
 * so a unit dropped to 0 without it would leave a half-dead board.
 * An HP INCREASE is a heal: it emits HEAL and runs onHeal.
 * Energy and tempHp changes fire nothing - the engine has no trigger for them.
 */
function handleSetVitals(
    state: IBattleState,
    payload: { entityId: string; hp?: number; energy?: number; tempHp?: number; sourceId: string }
): IBattleState {
    const { entityId, hp, energy, tempHp, sourceId } = payload;

    const entity = findBattleEntity(state, entityId);
    if (!entity) {
        console.warn(`[SET_VITALS] Unknown entity "${entityId}".`);
        return state;
    }
    // sourceId must resolve to a real unit: hooks read it for retaliation targeting.
    if (!findBattleEntity(state, sourceId)) {
        console.warn(`[SET_VITALS] sourceId "${sourceId}" is not an entity in this battle.`);
        return state;
    }

    // Mutable shape: IBattleEntity fields are readonly, so Partial<IBattleEntity>
    // cannot be built up field by field.
    const patch: { currentHp?: number; currentEnergy?: number; tempHp?: number } = {};
    let hpDelta = 0;

    if (hp !== undefined) {
        const newHp = Math.max(0, Math.min(entity.maxHp, Math.floor(hp)));
        patch.currentHp = newHp;
        hpDelta = newHp - entity.currentHp;
    }
    if (energy !== undefined) {
        patch.currentEnergy = Math.max(0, Math.floor(energy));
    }
    if (tempHp !== undefined) {
        patch.tempHp = Math.max(0, Math.floor(tempHp));
    }
    if (Object.keys(patch).length === 0) return state;

    let newState = patchEntity(state, entityId, patch);
    const parts: string[] = [];
    if (patch.currentHp !== undefined) parts.push(`HP ${patch.currentHp}/${entity.maxHp}`);
    if (patch.currentEnergy !== undefined) parts.push(`Energy ${patch.currentEnergy}`);
    if (patch.tempHp !== undefined) parts.push(`Shield ${patch.tempHp}`);
    newState = addLog(newState, `  ⚙️ ${entity.name} set to ${parts.join(', ')}`);

    if (hpDelta < 0) {
        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN',
            targetId: entityId,
            amount: -hpDelta,
            element: 'None',
            timestamp: Date.now()
        });
        // Order mirrors the card path: death processing (XP + onUnitFainted) resolves
        // before onPostDamage, which only collects hooks from units still alive.
        if (entity.currentHp > 0 && (patch.currentHp ?? entity.currentHp) <= 0) {
            newState = checkDefeat(newState, entityId);
        }
        newState = runVitalsHook(newState, 'onPostDamage', sourceId, entityId);
    } else if (hpDelta > 0) {
        globalBattleEventBus.emit({
            type: 'HEAL',
            targetId: entityId,
            amount: hpDelta,
            sourceId,
            timestamp: Date.now()
        });
        newState = runVitalsHook(newState, 'onHeal', sourceId, entityId);
    }

    return newState;
}

/**
 * Removes one status type from a unit, or every status when the type is omitted.
 * Mirrors the end-of-turn expiry path: emit STATUS_REMOVED, then run onStatusRemoved
 * per removed instance. Deliberately does NOT grant the Asleep/Stunned StableOS
 * immunity - that belongs to natural expiry, not to forced removal (handleCleanse
 * skips it too).
 */
function handleRemoveStatus(
    state: IBattleState,
    payload: { entityId: string; status?: StatusType }
): IBattleState {
    const { entityId, status } = payload;
    const entity = findBattleEntity(state, entityId);
    if (!entity) {
        console.warn(`[REMOVE_STATUS] Unknown entity "${entityId}".`);
        return state;
    }

    const removed = entity.statusEffects.filter(s => status === undefined || s.type === status);
    if (removed.length === 0) return state;

    const removedIds = new Set(removed.map(s => s.id));
    const kept: StatusEffectInstance[] = entity.statusEffects.filter(s => !removedIds.has(s.id));

    let newState = patchEntity(state, entityId, { statusEffects: kept });

    for (const effect of removed) {
        globalBattleEventBus.emit({
            type: 'STATUS_REMOVED',
            targetId: entityId,
            status: effect.type,
            timestamp: Date.now()
        });
        newState = addLog(newState, `  ✖️ ${entity.name}'s ${effect.type} was removed`);

        const afterRemovalTarget = findBattleEntity(newState, entityId);
        if (!afterRemovalTarget) continue;
        const context = {
            target: afterRemovalTarget,
            statusApplied: effect.type,
            state: newState,
            triggerDepth: 0
        };
        const { state: afterHook } = executeResolutionStack('onStatusRemoved', context as any);
        newState = afterHook;
    }

    return newState;
}

/**
 * Adds a card to a side's hand by delegating to handleGenerateCard, which owns hand
 * insertion (and the HAND_SIZE_LIMIT rejection). That handler picks the deck by
 * looking its sourceId up in playerParty, so we hand it a member of the requested
 * side; any id absent from playerParty routes to the enemy deck.
 */
function handleAddCardToHand(
    state: IBattleState,
    payload: { side: 'PLAYER' | 'ENEMY'; dataId: string }
): IBattleState {
    const { side, dataId } = payload;
    const proxyId = side === 'PLAYER' ? state.playerParty[0]?.id : state.enemyParty[0]?.id;
    if (side === 'PLAYER' && proxyId === undefined) {
        console.warn('[ADD_CARD_TO_HAND] No player unit exists to own the generated card.');
        return state;
    }
    return effectHandlers['GENERATE_CARD'](state, { sourceId: proxyId ?? '', dataId });
}

/**
 * Sets (or clears, with null) a unit's telegraphed next move.
 * Fires nothing: an intent is a plan, not an event.
 */
function handleSetIntent(
    state: IBattleState,
    payload: { entityId: string; move: IMove | null }
): IBattleState {
    const { entityId, move } = payload;
    if (!findBattleEntity(state, entityId)) {
        console.warn(`[SET_INTENT] Unknown entity "${entityId}".`);
        return state;
    }
    return patchEntity(state, entityId, { currentIntent: move });
}

/**
 * Drops a unit to 0 HP with full death processing: XP award + levelUpQueue and the
 * onUnitFainted hooks, via the same checkDefeat every other kill runs through.
 * sourceId must be a real unit - checkDefeat derives the XP receivers from the
 * opposing party, but the credited killer is required for the log and for parity
 * with the other damage-shaped actions.
 */
function handleKillEntity(
    state: IBattleState,
    payload: { entityId: string; sourceId: string }
): IBattleState {
    const { entityId, sourceId } = payload;
    const entity = findBattleEntity(state, entityId);
    if (!entity) {
        console.warn(`[KILL_ENTITY] Unknown entity "${entityId}".`);
        return state;
    }
    const source = findBattleEntity(state, sourceId);
    if (!source) {
        console.warn(`[KILL_ENTITY] sourceId "${sourceId}" is not an entity in this battle.`);
        return state;
    }
    // Already down: death processing has run once and must not run twice.
    if (entity.currentHp <= 0) return state;

    let newState = patchEntity(state, entityId, { currentHp: 0 });
    newState = addLog(newState, `  ☠️ ${entity.name} was defeated by ${source.name}`);
    return checkDefeat(newState, entityId);
}
