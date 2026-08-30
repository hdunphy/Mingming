
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
import { recordDotTick } from './statusCensus';
import { type HookContext } from './core/Hooks';
// We will import combatUtils later for card resolution
// import { calculateDamage, calculateHeal, calculateModifier } from './combatUtils';

import { GetProgramData } from './data/programRegistry';
import { getMacro, type IMacroDefinition } from './data/macroRegistry';
import { effectHandlers, checkDefeat } from './effectHandlers';
import { discardHand, HAND_SIZE_LIMIT } from './deckLogic';
import { ActionExecutorRegistry } from './actions/ActionExecutors';
import { ConditionValidator } from './core/ConditionValidator';
import { generateIntents } from './core/IntentUtils';
import { applyMutations, executeResolutionStack, executeDraw, executeStatusDamageCalculated, executeCostCalculated, crossedDownHalf, fireHpThresholdCrossed } from './resolutionEngine';
import { getOSBehavior } from './data/firmwareRegistry';

// --- Helpers ---
function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

// Ticket 55: `GetBaseCost` lived here and had no callers. `getEffectiveCardCost` is the one
// cost entry point — it handles X-cost and the next-program discount, which a bare base-cost
// lookup could not, and every reader (AI, cost pip, this reducer) already goes through it.

// --- Actions ---

export type BattleAction =
    | { type: 'PLAY_PROGRAM'; payload: { sourceId: string; targetId: string; programId: string } }
    /**
     * Ticket 15 — MACROS. A `PLAY_PROGRAM`-shaped action with no card, no hand and no Energy:
     * `macros-and-drivers.md` rules macros "single-use, **fired free on your turn**". The slot it
     * came out of is emptied by `runSlice.consumeMacro`, which is run state and cannot be reached
     * from here; the screen fires both, and only after `canFireMacro` says the shot will land.
     */
    | { type: 'FIRE_MACRO'; payload: { macroId: string; sourceId: string; targetId: string } }
    /**
     * **UNWIRED, PENDING A RULING — do not build UI for this.**
     *
     * Ticket 22 (3v3 game-side completion) found that this action is fully implemented and tested
     * (`handleTransferEnergy` below; `Kernel.test.ts`, `battleReducer.test.ts`) and that
     * `battleSlice.transferEnergy` forwards it faithfully — but that **nothing in the game dispatches
     * either one**, and the 3v3 ruling never mentions party Energy transfer at all.
     *
     * The ticket is explicit that Henry decides keep-or-cut and that no UI may be built for it until
     * he has, so 22 left the whole path exactly as it found it rather than wiring it up or deleting
     * it. It is not rotting — the tests exercise it — it simply has no way in from a fight.
     */
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

// HAND_SIZE_LIMIT now lives in deckLogic.ts - see the import above.
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

        case 'FIRE_MACRO':
            return handleFireMacro(state, action.payload);

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

    // Ticket 48: PERMAFROST_WAKE lets Draugr act in its sleep. The `not_asleep` constraint stays
    // PRINTED on all 171 cards - Asleep still shuts down everyone else - and the OS waives that one
    // check for its owner. Deliberately NOT done by stripping `not_asleep` from Draugr's cards:
    // that would let any species holding one of them act while slept.
    //
    // There is no other Asleep gate on this path. The incapacitation check in `handleExecuteIntent`
    // is the enemy-INTENT path, so a Draugr running MOVES will still not act asleep. Recorded, not
    // fixed: the balance suite runs CARDS on both sides.
    const waivesAsleep = source.activeOS
        ? getOSBehavior(source.activeOS)?.actsWhileAsleep === true
        : false;

    // 2. Custom Constraints
    if (program.constraints) {
        for (const constraint of program.constraints) {
            if (waivesAsleep && constraint.type === 'NOT_STATUS' && constraint.value === 'Asleep') {
                continue;
            }
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
    // X-cost (ticket 22, Thermal Lance / Firestorm Talon): the card costs ALL the
    // source's current Energy, minimum 1. Discounts do not apply - there is nothing to
    // discount when the price IS your whole pool. Returning a live number here is what
    // lets the AI, the UI cost pip and the reducer's own check all agree without any
    // of them special-casing X.
    if (programData.baseCost === 'X') {
        return Math.max(1, source.currentEnergy);
    }
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
    // Ticket 52: `powerBonus` primes ONE hit, so it is spent on the first ATTACK action that
    // actually resolves - not the first in the list (a conditional one may not fire) and not
    // every hit of a multi-hit card.
    let powerBonusSpent = false;
    // Ticket 53 - RAMPAGE growth (`growPerPlay`). Read BEFORE this play so the first cast
    // resolves at printed power; the accumulator is bumped once, after the whole card has
    // resolved (below), which also stops a multi-hit growth card growing between its own hits.
    // Keyed by the ProgramEntity id, so two copies grow independently and the count follows
    // the instance through every pile.
    const growthKey = `card_growth:${card.id}`;
    const growth = programData.growPerPlay ? (state.counters?.[growthKey] || 0) : 0;
    // Ticket 55: a second, unused copy of the discount arithmetic used to sit here.
    // `getEffectiveCardCost` (above) already applies `nextProgramModifier.costReduction` through
    // `doesModifierApply`, so this recomputation fed nothing and could only ever disagree.
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
        // The X in an X-cost card, read by the ENERGY_SPENT* scalings while this card
        // resolves. Recorded for every card so the scalings never see a stale value.
        lastEnergySpent: finalCost,
        // TICKET 111: the card is in the discard from this line on, so mark it as the one
        // resolving - `drawCards` holds it out of any reshuffle until resolution finishes.
        resolvingCardInstanceId: card.id,
        lastStatusConsumed: 0,
        // `damageLedger` is per-ACTION (see `IDamageRecord`). Cleared here rather than at the top
        // of `battleReducer` on purpose: every refusal above returns `state` by identity, and
        // `damagePreview.simulatePlay` uses `after === state` to detect a refused play. Clearing
        // upstream of those guards would hand it a fresh object for a play that never happened.
        damageLedger: [],
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

    // TICKET 105 - THE DEAD DO NOT GET TO FINISH THEIR TURN.
    //
    // The guards at the top of this function check that the caster is alive BEFORE the card
    // starts, and that was the only check there was. But a cost hook can kill the caster
    // DURING its own `onActionStart` - hel_v2's UNDERWORLD_GATEWAY pays HP for Dark spells
    // there - and the resolution loop below simply carried on. From Henry's round-3 playtest
    // (snapshot `t4-77031961`), verbatim from the log:
    //
    //     Hel takes 10 damage DEFEATED
    //     Hel's UNDERWORLD_GATEWAY pays 10 HP in blood!
    //     Hel plays Last Rites -> Control
    //     Control takes 17 damage DEFEATED
    //
    // A dead unit killed the enemy, and Henry got the victory screen: *"I died first yet
    // still got the victory."* The card is already paid for and already in the discard by
    // this point, which is the correct outcome for a cast whose price killed you: it is
    // spent, and it fizzles.
    //
    // This is the GENERAL guard. `hel_v2`'s cost hook separately refuses a cast whose blood
    // price would be lethal, so hel never reaches here - but the next mechanic that can kill
    // its own caster mid-cast should not have to rediscover this.
    const casterAfterStart = afterStart[activePartyKey].find(e => e.id === sourceId);
    if (!casterAfterStart || casterAfterStart.currentHp <= 0) {
        return applyMutations(afterStart, [{
            type: 'LOG',
            targetId: '',
            payload: `${sourceEntity.name} falls paying for ${programData.name} - the cast fizzles.`
        }]);
    }
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
            // DISCARD reads `count` as "how many cards leave the hand" (the ticket-21
            // self-discard cost), not as a repeat count - resolve it once and let the
            // executor move all N in a single seeded shuffle.
            const hitCount: number = action.type === 'DISCARD' ? 1 : (action.count || 1);

            for (let i = 0; i < hitCount; i++) {
                // Target Resolution (per hit)
                let targetIds: string[] = [];
                // DISCARD is always a self-cost: it empties the ACTING side's hand
                // regardless of the card's declared target (Lance and Cavalry Charge
                // both target an enemy). FORCE_DISCARD is the enemy-facing variant.
                if (action.target === 'SELF' || action.target === 'Self' || action.type === 'DISCARD') {
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
                    // Ticket 68: `finalState` is threaded through. It was omitted, so every
                    // state-dependent action conditional hit ConditionValidator's
                    // `if (!state) return true` fail-safe and passed unconditionally - which is
                    // the REAL reason surge_protection's refund fired on 3,371 of 3,371 casts.
                    // Same family as 0-TARGETLESS: a guard silently always-true because an
                    // argument was not passed.
                    if (action.conditionals) {
                        let allMet = true;
                        for (const constraint of action.conditionals) {
                            const subject = constraint.target === 'SELF' ? sourceEntity : currentTarget;
                            if (!validateSingleConstraint(constraint, sourceEntity, subject, 0, finalState)) {
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
                    const modifiedAction = { ...action };
                    if (growth > 0 && modifiedAction.type === 'ATTACK'
                        && modifiedAction.power !== undefined) {
                        modifiedAction.power = modifiedAction.power + growth;
                    }
                    if (modifier && modifierApplies) {
                        if (!powerBonusSpent && modifier.powerBonus && modifiedAction.type === 'ATTACK'
                            && modifiedAction.power !== undefined) {
                            modifiedAction.power = modifiedAction.power + modifier.powerBonus;
                            powerBonusSpent = true;
                        }
                        if (modifiedAction.power !== undefined) {
                            modifiedAction.power = Math.floor((modifiedAction.power + (modifier.flatBonus || 0)) * (modifier.multiplier || 1));
                        }
                        if (modifiedAction.type === 'STATUS' && modifiedAction.stacks !== undefined) {
                            modifiedAction.stacks = Math.floor((modifiedAction.stacks + (modifier.flatBonus || 0)) * (modifier.multiplier || 1));
                        }
                        if (modifiedAction.type === 'HEAL' && modifiedAction.power !== undefined) {
                            modifiedAction.power = Math.floor((modifiedAction.power + (modifier.flatBonus || 0)) * (modifier.multiplier || 1));
                        }
                    }

                    const executor = ActionExecutorRegistry[modifiedAction.type];
                    if (executor) {
                        finalState = executor.execute(finalState, sourceId, tId, modifiedAction, programData, hitContext);
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

    // Ticket 53: bank this cast's growth. After the action loop so the card just played
    // used the PREVIOUS total, and outside it so a multi-hit card grows once per cast.
    if (programData.growPerPlay) {
        finalState = applyMutations(finalState, [{
            type: 'COUNTER',
            targetId: '',
            payload: { key: growthKey, operator: 'ADD', amount: programData.growPerPlay }
        }]);
    }

    // 8. System Layer: onActionEnd (ticket 36). Fires ONCE PER PROGRAM, after every action has
    // resolved - the symmetric partner to the onActionStart dispatch in step 5. It is outside
    // the action loop deliberately: a multi-action card must not flip Hel's stance mid-card.
    // And it is end-of-action rather than start because the card that SETS a stance must not
    // benefit from it - on onActionStart every Dark card would self-buff and switching would
    // cost nothing, which erases the design.
    {
        const { state: afterEnd } = executeResolutionStack('onActionEnd', { ...context, state: finalState });
        finalState = afterEnd;
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
        lastProgramPlayed: card.dataId,
        // Resolution is over: the card rejoins the reshuffle pool like any other discard.
        resolvingCardInstanceId: null
    };

    return finalState;
}

// =================================================================================================
// MACROS — ticket 15
// =================================================================================================

/**
 * Why a macro cannot be fired right now. `null` means it can.
 *
 * Exported because **both** the rack UI and the reducer need it and they must not disagree: the
 * screen greys the slot and prints the reason, and only fires when this is `null`. That matters more
 * for a macro than for a card, because firing is a two-slice operation — the battle resolves it and
 * `runSlice.consumeMacro` spends the slot — and a slot spent on a shot the reducer refused would be
 * a consumable destroyed for nothing. There is no way for one reducer to guarantee that, so the
 * guarantee is this shared predicate plus the reducer's own independent refusal below.
 */
export type MacroFireBlock =
    | 'wrong-phase'
    | 'not-your-turn'
    | 'battle-over'
    | 'unknown-macro'
    | 'map-only'
    | 'no-source'
    | 'bad-target'
    | 'nothing-to-echo';

/**
 * Where a macro's actions land, given the macro's declared targeting and the player's pick.
 * `undefined` means the pick is not a legal target for this macro.
 */
function resolveMacroTargetId(
    state: IBattleState,
    macro: IMacroDefinition,
    sourceId: string,
    targetId: string,
): string | undefined {
    switch (macro.targeting) {
        case 'SELF':
            // The chosen pick is ignored outright rather than validated: a SELF macro is about the
            // unit firing it, and letting a stray targetId through would make Recharge silently
            // energise whoever the player last clicked.
            return sourceId;
        case 'ENEMY': {
            const enemy = state.enemyParty.find(e => e.id === targetId);
            return enemy && enemy.currentHp > 0 ? enemy.id : undefined;
        }
        case 'ALLY': {
            const ally = state.playerParty.find(e => e.id === targetId);
            return ally && ally.currentHp > 0 ? ally.id : undefined;
        }
        case 'DOWNED_ALLY': {
            // The one inversion in the engine: this target is legal precisely because it is at 0 HP.
            const downed = state.playerParty.find(e => e.id === targetId);
            return downed && downed.currentHp <= 0 ? downed.id : undefined;
        }
        case 'MAP':
        default:
            return undefined;
    }
}

export function canFireMacro(
    state: IBattleState,
    payload: { macroId: string; sourceId: string; targetId: string },
): MacroFireBlock | null {
    const { macroId, sourceId, targetId } = payload;

    const macro = getMacro(macroId);
    if (!macro) return 'unknown-macro';
    // The map-reveal is a run-state effect and has no battle behaviour at all. Refusing it here
    // rather than letting it resolve to nothing is what stops a mis-wired rack from eating the slot.
    if (macro.targeting === 'MAP') return 'map-only';

    if (state.phase !== 'ACTION') return 'wrong-phase';
    // Macros are the PLAYER's resource. Nothing gives the enemy a rack, and gating on the active
    // side is what keeps "fired free on your turn" literally true.
    if (state.activeSide !== 'PLAYER') return 'not-your-turn';

    const battleOver = (state.playerParty.length > 0 && state.playerParty.every(p => p.currentHp <= 0))
        || (state.enemyParty.length > 0 && state.enemyParty.every(e => e.currentHp <= 0));
    if (battleOver) return 'battle-over';

    const source = state.playerParty.find(e => e.id === sourceId);
    if (!source || source.currentHp <= 0) return 'no-source';

    if (resolveMacroTargetId(state, macro, sourceId, targetId) === undefined) return 'bad-target';

    // Echo with nothing behind it. `lastProgramPlayed` is null until the first card of the battle
    // resolves, and `PlayLastCardExecutor` would otherwise log "no program was played previously"
    // and return — a rare consumable spent on a log line.
    if (macro.actions.some(a => a.type === 'PLAY_LAST_CARD') && !state.lastProgramPlayed) {
        return 'nothing-to-echo';
    }

    return null;
}

/**
 * Fire a macro. **Free, single-use, and not a card play.**
 *
 * # WHAT THIS DELIBERATELY DOES NOT TOUCH, AND WHY
 *
 * Ticket 15 asks for a reading on this and no ruling exists, so here is the reading, in one place:
 * **a macro is NOT a card play.** Nothing below increments any of the counters a card play moves.
 *
 * - **`cardsPlayedThisTurn`** — the `CARDS_PLAYED` damage scaler reads it (`stampede`,
 *   `momentum_crash`), and ticket 74 rules that family deliberately uncapped because it rewards
 *   playing smart *out of your deck*. A free off-deck consumable that inflated it would be a
 *   multiplier you can buy, which is a different game. It is also what the HUD's "CARDS PLAYED"
 *   readout means, and that readout is how Henry pilots a momentum deck.
 * - **`playsThisTurn`** — the per-unit OS card limit (YMIR v2's GLACIAL_PACE_OS: two cards a turn).
 *   A macro is not one of your two cards, so it neither counts against the limit nor is refused by
 *   it. The alternative would make the Glacial Pace player's macros strictly worse than everyone
 *   else's for no stated reason.
 * - **`lastProgramPlayed`** — left pointing at the last *card*, which is what makes Echo's ruled
 *   text ("replay your last card") true. Firing Surge and then Echo replays the card before Surge,
 *   not Surge; firing Echo twice replays the same card twice.
 * - **`elementPlays`** and **`lastEnergySpent`** — a macro has no element and pays no Energy, so
 *   writing either would be recording a fiction for the scalers that read them.
 * - **`nextProgramModifier`** — a macro neither benefits from a primed buff nor spends it. Free Exec
 *   priming a charge that the next macro immediately ate would make the rare macro unusable next to
 *   any other macro.
 *
 * # WHICH HOOK PHASES RUN
 *
 * `onModifierPhase` and `onPostDamage` per hit — the damage plumbing every source in the game runs
 * through, including enemy intents. `onActionStart` / `onActionEnd` do **not**: they are the
 * per-PROGRAM phases (hel_v2 flips her stance on `onActionEnd`, UNDERWORLD_GATEWAY charges blood on
 * `onActionStart`), and firing them for a macro would make a consumable trigger "when you cast a
 * card" firmware. `handleExecuteIntent` already sets that precedent for a non-card action source and
 * this follows it exactly.
 */
function handleFireMacro(
    state: IBattleState,
    payload: { macroId: string; sourceId: string; targetId: string },
): IBattleState {
    if (canFireMacro(state, payload) !== null) return state;

    const { macroId, sourceId } = payload;
    const macro = getMacro(macroId)!;
    const macroTargetId = resolveMacroTargetId(state, macro, sourceId, payload.targetId)!;

    const sourceEntity = state.playerParty.find(e => e.id === sourceId)!;
    const targetEntity = state.playerParty.find(e => e.id === macroTargetId)
        || state.enemyParty.find(e => e.id === macroTargetId);

    // A macro is not a program, but the executors and hooks all take one. This stand-in carries the
    // macro's identity into the log and the hook context without pretending to be a real card: it is
    // never in a hand, never in a pile, and `lastProgramPlayed` is never set to it.
    const macroProgram: ProgramData = {
        id: macro.id,
        name: macro.name,
        description: macro.description,
        element: 'None',
        target: 'Single',
        category: 'Skill',
        rarity: macro.rarity,
        baseCost: 0,
        constraints: [],
        actions: macro.actions,
    };

    // `lastStatusConsumed` is reset exactly as the card path resets it, so a macro that replays a
    // consume-scaled card (Echo) reads that card's own consume count and never a stale one.
    let finalState: IBattleState = applyMutations({ ...state, lastStatusConsumed: 0, damageLedger: [] }, [{
        type: 'LOG',
        targetId: '',
        payload: `⚡ ${sourceEntity.name} fires ${macro.name}${targetEntity && targetEntity.id !== sourceId ? ` → ${targetEntity.name}` : ''}`
    }]);

    const context: HookContext = {
        source: sourceEntity,
        target: targetEntity,
        program: macroProgram,
        state: finalState,
        triggerDepth: 0
    };

    for (const action of macro.actions) {
        // SELF-declared actions land on the firing unit whatever the macro is aimed at, the same
        // rule `handlePlayProgram` applies to a card's SELF actions.
        const tId = (action.target === 'SELF' || action.target === 'Self') ? sourceId : macroTargetId;
        const currentTarget = finalState.playerParty.find(e => e.id === tId)
            || finalState.enemyParty.find(e => e.id === tId);
        if (!currentTarget) continue;
        // THE ONE PLACE THE ENGINE LETS AN ACTION REACH A DOWNED UNIT, and it is narrowed to the one
        // action type that exists to do it. Everything else keeps the standard alive-check, so a
        // multi-action revive macro could not sneak a damage action onto a corpse.
        if (currentTarget.currentHp <= 0 && action.type !== 'REVIVE') continue;

        const latestSource = finalState.playerParty.find(e => e.id === sourceId);
        if (!latestSource || latestSource.currentHp <= 0) break;

        const hitContext: HookContext = { ...context, source: latestSource, target: currentTarget, state: finalState };
        const { state: afterMod, isCancelled } = executeResolutionStack('onModifierPhase', hitContext);
        if (isCancelled) continue;
        finalState = afterMod;

        const executor = ActionExecutorRegistry[action.type];
        if (executor) {
            finalState = executor.execute(finalState, sourceId, tId, action, macroProgram, hitContext);
        } else {
            console.warn(`[BattleReducer] No executor found for macro action type: ${action.type}`);
        }

        const { state: afterPost } = executeResolutionStack('onPostDamage', { ...hitContext, state: finalState });
        finalState = afterPost;
    }

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

    // 1. Initial State Updates (clear the intent). `damageLedger` is per-action — see the note in
    // `handlePlayProgram` for why it is cleared past the refusal guards rather than above them.
    let snapshot: IBattleState = {
        ...state,
        damageLedger: [],
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
        const hitCount: number = action.count || 1;

        for (let i = 0; i < hitCount; i++) {
            // Target Selection Helper (Deterministic via lowest HP for single, Side/Self logic)
            let targetIds: string[] = [];
            const isHealOrBuff = action.type === 'HEAL' || (action.type === 'STATUS' && ['Regen', 'Energized', 'Strengthened', 'Sharp', 'StableOS', 'BarkShield'].includes(action.status));

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

                // Action-level Conditionals (see the ticket-68 note on the sibling path above)
                if (action.conditionals) {
                    let allMet = true;
                    for (const constraint of action.conditionals) {
                        const subject = constraint.target === 'SELF' ? sourceEntity : currentTarget;
                        if (!validateSingleConstraint(constraint, sourceEntity, subject, 0, finalState)) {
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
                    finalState = executor.execute(finalState, sourceId, tId, action, dummyProgram, hitContext);
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
    // Per-action ledger, and end of turn is an action: DoT ticks and end-of-turn hooks deal real
    // damage and belong to this action, not to the card that happened to resolve before it.
    newState = { ...newState, phase: 'POST_TURN' as TurnPhase, damageLedger: [] };

    // Execute Post-Turn Logic
    newState = processPostTurn(newState);

    // Transition to PRE_TURN of next player
    newState = processPreTurn(newState);

    // Set Phase to ACTION for the next player
    newState = { ...newState, phase: 'ACTION' as TurnPhase, cardsPlayedThisTurn: 0, cardsDiscardedThisTurn: 0 };

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
    // `status` is a StatusType, not a bare string: every push below is a
    // `StatusEffectInstance['type']`, and HookContext.statusApplied — which is what this
    // queue feeds at the onStatusRemoved dispatch — is typed StatusType.
    const removedStatusQueue: { targetId: string, status: StatusType }[] = [];
    const hpCrossingsThisTick: string[] = [];

    const processedActiveParty = activeParty.map((entity: IBattleEntity) => {
        let currentHp = entity.currentHp;
        let defense = entity.defense;
        const newEffects: StatusEffectInstance[] = [];

        if (currentHp <= 0) return entity;

        for (const effect of entity.statusEffects) {
            const behavior = getStatusBehavior(effect.type);
            const result = behavior.endTurn(effect, entity);

            let damage = result.damage;

            // Apply scaling hooks (e.g., Thermal Overload boosting Burn damage).
            //
            // Ticket 55 removed a hand-built `HookContext` here that nothing read:
            // `executeStatusDamageCalculated` builds its own, so the local was scaffolding left
            // behind when this call replaced a direct hook invocation.
            if (damage > 0) {
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

            // TICKET 109: the one site where DoT/HoT has an unambiguous cause - this loop is per
            // status effect. Gated and 0-AI-SIM-COUNTS-guarded inside the recorder.
            recordDotTick(effect.type, result.damage ?? 0, result.healing ?? 0);

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

        // Threshold event (ticket 12): DoT ticks bypass handleAttack, so record
        // the crossing here (fired below, once the processed party is in state).
        if (crossedDownHalf(entity.currentHp, currentHp, entity.maxHp)) {
            hpCrossingsThisTick.push(entity.id);
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
        cardsDrawnThisTurn: 0,
        nonNaturalCardsDrawnThisTurn: 0,
        cardsDiscardedThisTurn: 0
    };

    // 2.4 Fire threshold crossings from DoT ticks (ticket 12)
    for (const crossedId of hpCrossingsThisTick) {
        nextState = fireHpThresholdCrossed(nextState, crossedId);
    }

    // 2.5 Dispatch onStatusRemoved Hooks
    for (const item of removedStatusQueue) {
        const afterTurnTarget = nextState.playerParty.find(e => e.id === item.targetId) || nextState.enemyParty.find(e => e.id === item.targetId);
        if (afterTurnTarget) {
            const context: HookContext = {
                target: afterTurnTarget,
                statusApplied: item.status,
                state: nextState,
                triggerDepth: 0
            };
            const { state: afterHook } = executeResolutionStack('onStatusRemoved', context);
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

    // 3. Draw cards for the active side.
    nextState = executeDraw(nextState, nextSide, 0, true);

    // Refill the active side's hand. The player always uses cards; the enemy
    // only does in enemyMode 'CARDS'. MOVES enemies must NOT draw - their deck
    // is empty by construction, and calling executeDraw with a real count would
    // advance the RNG seed and change every existing MOVES battle and every
    // recorded scenario.
    //
    // This was previously gated on `nextSide === 'PLAYER'`, so a CARDS enemy
    // drew its opening hand at battle creation and then never drew again: once
    // it had played through those cards it had nothing left, getBestAction
    // found no plays, and the enemy silently passed every turn for the rest of
    // the battle.
    const activeSideUsesCards = nextSide === 'PLAYER' || (nextState.enemyMode ?? 'MOVES') === 'CARDS';
    if (activeSideUsesCards) {
        const aliveUnits = nextState[activePartyKey].filter((e: IBattleEntity) => e.currentHp > 0);
        const totalCardDraw = aliveUnits.length === 0
            ? 0
            : aliveUnits.reduce((sum: number, e: IBattleEntity) => sum + e.cardDraw, 0) - aliveUnits.length + 1;
        const cardsToDraw = Math.max(0, Math.min(totalCardDraw, HAND_SIZE_LIMIT - nextState[activeDeckKey].hand.length));
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

    let newState: IBattleState = {
        ...nextState,
        turn: nextTurn,
        phase: 'ACTION',
        activeSide: nextSide,
        playerParty: finalPlayerParty,
        enemyParty: finalEnemyParty,
        cardsPlayedThisTurn: 0,
        cardsDiscardedThisTurn: 0,
        elementPlays: {
            'Fire': 0, 'Water': 0, 'Earth': 0, 'Air': 0, 'Nature': 0,
            'Ice': 0, 'Light': 0, 'Dark': 0, 'None': 0
        }
    };

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
        const context: HookContext = {
            target: afterRemovalTarget,
            statusApplied: effect.type,
            state: newState,
            triggerDepth: 0
        };
        const { state: afterHook } = executeResolutionStack('onStatusRemoved', context);
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
