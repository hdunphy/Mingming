import type { IBattleState, IBattleEntity, ProgramData } from '../types';
import type { ActionType, ProgramAction, AttackActionData, StatusActionData, HealActionData, DrawActionData, EnergyActionData, GenerateCardActionData, CleanseActionData, DiscardActionData, ExhaustActionData, ReturnActionData, SearchActionData, MultiplyStatusActionData, TriggerStatusActionData, PlayLastCardActionData, TauntActionData, BuffNextProgramActionData, RedirectTargetActionData, ForceDiscardActionData, ShiftStanceActionData, StatusType } from '../types';
import type { HookContext } from '../core/Hooks';
import { calculateDamage, calculateHeal } from '../combatUtils';
import { checkDefeat } from '../effectHandlers'; // Need to refactor checkDefeat or keep it in effectHandlers for now
import { applyMutations, executeDraw, executeStatusDamageCalculated } from '../resolutionEngine';
import { GetProgramData } from '../data/programRegistry';
import { getStatusBehavior } from '../StatusBehaviors';
import { globalBattleEventBus } from '../events';
import { PRNG } from '../core/PRNG';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

/**
 * Base abstract class for executing ProgramAction data.
 * Pure execution logic mapping state + pure-data -> new state.
 */
export abstract class ActionExecutor<T extends ProgramAction> {
    abstract execute(state: IBattleState, sourceId: string, targetId: string, actionData: T, program: ProgramData | undefined, context: HookContext): IBattleState;
}

/**
 * Effective ATTACK power after attacker-only scaling.
 *
 * Currently handles SHARP_STACKS (+5 power per Sharp stack on the attacker) and
 * STRENGTH_STACKS (power MULTIPLIED by the attacker's Strengthened stacks - Momentum
 * Crash cashing MOMENTUM_DRIVE), which boost the POWER fed into the damage formula so
 * the bonus scales with level/stats like any other power and survives resistances.
 * STRENGTH_STACKS reads RAW stacks on purpose: Strengthened's own damage bonus is
 * capped at +-25%, and the whole point of the payoff card is to bypass that cap.
 *
 * Shared by AttackExecutor AND the UI hover preview (computeDamagePreview) so
 * the previewed number and the real reducer damage cannot drift for Sharp
 * scaling. The other scalings (CARDS_PLAYED, MISSING_HP, STATUS_COUNT,
 * CARDS_DRAWN, ELEMENT_PLAYED) depend on battle state / the target and
 * multiply the computed DAMAGE afterwards — they intentionally stay inside
 * AttackExecutor.
 */
/** Max Strengthened stacks a STRENGTH_STACKS scaler may multiply by - see ticket 23 follow-up. */
const STRENGTH_STACK_CAP = 8;

export function getEffectiveAttackPower(source: IBattleEntity, action: Pick<AttackActionData, 'power' | 'scaling'>): number {
    const power = action.power || 0;
    if (action.scaling === 'SHARP_STACKS') {
        const sharpStacks = source.statusEffects.find(s => s.type === 'Sharp')?.stacks || 0;
        return power + 5 * sharpStacks;
    }
    if (action.scaling === 'STRENGTH_STACKS') {
        // Capped at STRENGTH_STACK_CAP so the card cannot exceed its cost's power budget:
        // uncapped, Momentum Crash measured 29.3 damage a play (38% of a health pool) off
        // a nominal 10 power - an effective ~98 power for 1 Energy against a 40 budget.
        // The cap is budget / power, so it re-derives whenever the curve moves.
        const strengthStacks = source.statusEffects.find(s => s.type === 'Strengthened')?.stacks || 0;
        return power * Math.min(strengthStacks, STRENGTH_STACK_CAP);
    }
    return power;
}

export class AttackExecutor extends ActionExecutor<AttackActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: AttackActionData, program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { element, scaling } = actionData;

        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

        if (!target) return state;

        let damage = 0;
        if (source) {
            const programToUse = program || ({ element: element } as ProgramData);

            // SHARP_STACKS scaling handled by the shared helper (also used by
            // the UI damage preview, so preview and reality cannot drift).
            const effectivePower = getEffectiveAttackPower(source, actionData);

            damage = calculateDamage(source, target, programToUse, effectivePower, state);

            if (scaling === 'CARDS_PLAYED') {
                const multiplier = state.cardsPlayedThisTurn;
                damage = Math.floor(damage * multiplier);
            } else if (scaling === 'MISSING_HP') {
                const missingHp = source.maxHp - source.currentHp;
                damage += Math.floor(missingHp * 0.5); // Example: 50% of missing HP
            } else if (scaling === 'STATUS_COUNT') {
                const targetStatusCount = target.statusEffects.reduce((acc, s) => acc + s.stacks, 0);
                damage += Math.floor(damage * (targetStatusCount * 0.25)); // +25% per status
            } else if (scaling === 'CARDS_DRAWN') {
                const multiplier = state.cardsDrawnThisTurn;
                damage = Math.floor(damage * multiplier);
            } else if (scaling === 'ELEMENT_PLAYED') {
                const elementPlayed = element || programToUse.element;
                const multiplier = state.elementPlays?.[elementPlayed] || 1;
                damage = Math.floor(damage * multiplier);
            } else if (scaling === 'CARDS_DISCARDED') {
                // Carrion Swoop: the windmill's payoff. Mirrors CARDS_PLAYED.
                damage = Math.floor(damage * (state.cardsDiscardedThisTurn ?? 0));
            } else if (scaling === 'ENERGY_SPENT') {
                damage = Math.floor(damage * (state.lastEnergySpent ?? 0));
            } else if (scaling === 'ENERGY_SPENT_SQUARED') {
                // Thermal Lance: power x X^2, so ramping Energy is worth more than
                // linearly more damage - the reason UPDRAFT_KERNEL's +1 matters.
                const energySpent = state.lastEnergySpent ?? 0;
                damage = Math.floor(damage * energySpent * energySpent);
            } else if (scaling === 'BURN_TIMES_ENERGY') {
                // Firestorm Talon: power x target's Burn stacks x X. Zero Burn = zero
                // damage, so it is a payoff card, never an opener.
                const burnStacks = target.statusEffects.find(s => s.type === 'Burn')?.stacks || 0;
                damage = Math.floor(damage * burnStacks * (state.lastEnergySpent ?? 0));
            }
        }

        return applyMutations(state, [{
            type: 'HP',
            sourceId: sourceId,
            targetId: targetId,
            payload: {
                amount: damage,
                isHeal: false,
                element: element || program?.element
            }
        }]);
    }
}

export class StatusExecutor extends ActionExecutor<StatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: StatusActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { status, stacks, consume } = actionData;

        if (consume) {
            // Remove ALL stacks of the status and record how many were consumed
            // so a follow-up action with scaling: 'STATUS_CONSUMED' can use it
            // (e.g. Ash Reclamation: "Consume Burn to heal 10 HP per stack").
            const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
            const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
            if (!target) return state;

            const existingStatus = target.statusEffects.find(s => s.type === status);
            const consumedStacks = existingStatus ? existingStatus.stacks : 0;

            let newState: IBattleState = { ...state, lastStatusConsumed: consumedStacks };
            if (consumedStacks > 0) {
                const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
                    party.map(e => {
                        if (e.id !== targetId) return e;
                        return { ...e, statusEffects: e.statusEffects.filter(s => s.type !== status) };
                    });
                newState = {
                    ...newState,
                    playerParty: updateParty(newState.playerParty),
                    enemyParty: updateParty(newState.enemyParty)
                };
                newState = addLog(newState, `  🔥 ${target.name}'s ${status} consumed (${consumedStacks} stacks)`);
                globalBattleEventBus.emit({
                    type: 'STATUS_REMOVED',
                    targetId: targetId,
                    status: status,
                    timestamp: Date.now()
                });
            }
            return newState;
        }

        if (stacks < 0) {
            // Contract (types.ts): negative stacks removes that many stacks,
            // deleting the status only when it reaches 0.
            const removeCount = -stacks;
            const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
                party.map(e => {
                    if (e.id !== targetId) return e;
                    return {
                        ...e,
                        statusEffects: e.statusEffects
                            .map(s => s.type === status ? { ...s, stacks: s.stacks - removeCount } : s)
                            .filter(s => !(s.type === status && s.stacks <= 0))
                    };
                });
            let newState: IBattleState = {
                ...state,
                playerParty: updateParty(state.playerParty),
                enemyParty: updateParty(state.enemyParty)
            };
            newState = addLog(newState, `  ✨ ${removeCount} stack(s) of ${status} removed from target`);
            return newState;
        }

        // Apply Status Logic
        return applyMutations(state, [{
            type: 'STATUS',
            targetId: targetId,
            sourceId: sourceId,
            payload: { status, stacks }
        }]);
    }
}

export class HealExecutor extends ActionExecutor<HealActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: HealActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { power, healOverride } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

        if (!target) return state;
        if (!source && healOverride === undefined) return state;

        // Stance system: Light Stance boosts the healer's heals by +50%.
        // Power-based heals get the boost inside calculateHeal; healOverride-based
        // heals (e.g. Leech Strike, Ash Reclamation) are boosted here so BOTH
        // pipelines respect the stance without double-applying.
        const lightStanceBoost = source?.statusEffects.some(s => s.type === 'LightStance') ? 1.5 : 1;
        const baseHeal = healOverride !== undefined
            ? Math.floor(healOverride * lightStanceBoost)
            : calculateHeal(source as any, target, power);
        // STATUS_CONSUMED scaling: heal per stack removed by a preceding
        // consume action in the same card (e.g. Ash Reclamation).
        const healAmount = actionData.scaling === 'STATUS_CONSUMED'
            ? baseHeal * (state.lastStatusConsumed ?? 0)
            : baseHeal;

        return applyMutations(state, [{
            type: 'HP',
            sourceId: sourceId,
            targetId: targetId,
            payload: {
                amount: healAmount,
                isHeal: true
            }
        }]);
    }
}

export class DrawExecutor extends ActionExecutor<DrawActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: DrawActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount } = actionData;
        const isPlayerSource = state.playerParty.some(e => e.id === sourceId);
        const side = isPlayerSource ? 'PLAYER' : 'ENEMY';

        return executeDraw(state, side, amount, false, sourceId);
    }
}

export class EnergyExecutor extends ActionExecutor<EnergyActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: EnergyActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount } = actionData;
        return applyMutations(state, [{
            type: 'ENERGY',
            targetId: targetId,
            sourceId: sourceId,
            payload: { amount }
        }]);
    }
}

export class GenerateCardExecutor extends ActionExecutor<GenerateCardActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: GenerateCardActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { dataId } = actionData;
        return applyMutations(state, [{
            type: 'GENERATE_CARD',
            sourceId: sourceId,
            targetId: _targetId,
            payload: { dataId }
        }]);
    }
}

export class CleanseExecutor extends ActionExecutor<CleanseActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: CleanseActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { statusTarget } = actionData;
        return applyMutations(state, [{
            type: 'CLEANSE',
            sourceId,
            targetId,
            payload: { statusTarget }
        }]);
    }
}

export class DiscardExecutor extends ActionExecutor<DiscardActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: DiscardActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        // `count` is the ticket-21 self-discard cost: N RANDOM cards off the acting
        // side's own hand (the reducer has already routed targetId to the source and
        // suppressed its generic multi-hit loop for DISCARD). `amount` stays the
        // explicit form used by FORCE_DISCARD and discardEffect callers, which keep
        // their existing top-N / opt-in-random behaviour. A hand shorter than N just
        // discards what is there - the rest of the card still resolves.
        const usesCost = typeof actionData.count === 'number';
        const amount = usesCost ? (actionData.count as number) : (actionData.amount ?? 0);
        // The COST form is deterministic, not random - it sheds the least useful cards
        // first (see the DISCARD mutation in resolutionEngine). An explicit isRandom on
        // the action still wins, so FORCE_DISCARD and legacy callers are untouched.
        const isCostPriority = usesCost && actionData.isRandom === undefined;
        const isRandom = actionData.isRandom ?? false;
        const isPlayerTarget = state.playerParty.some(e => e.id === targetId);
        const deckKey = isPlayerTarget ? 'playerDeck' : 'enemyDeck';
        const handOwner = (isPlayerTarget ? state.playerParty : state.enemyParty).find(e => e.id === targetId);

        const oldDiscardLength = state[deckKey].discard.length;

        let newState = applyMutations(state, [{
            type: 'DISCARD',
            sourceId,
            targetId,
            payload: { amount, isRandom, isCostPriority }
        }]);

        const newDiscardLength = newState[deckKey].discard.length;
        if (newDiscardLength > oldDiscardLength) {
            // Need to peek at the cards that were just placed on top of the discard pile
            // Since discard pushes to the end of the array, we can slice from the old length.
            const discardedCards = newState[deckKey].discard.slice(oldDiscardLength, newDiscardLength);

            for (const c of discardedCards) {
                const discardedData = GetProgramData(c.dataId);
                newState = addLog(newState, `${handOwner?.name ?? 'Unknown'} discards ${discardedData.name}!`);
                if (discardedData.discardEffect && discardedData.discardEffect.length > 0) {
                    newState = addLog(newState, `  ✨ ${discardedData.name} discard effect triggered!`);

                    const owner = isPlayerTarget
                        ? newState.playerParty.find(e => e.id === targetId)
                        : newState.enemyParty.find(e => e.id === targetId);

                    if (owner) {
                        for (const effectAction of discardedData.discardEffect) {
                            const executor = (ActionExecutorRegistry as Record<string, ActionExecutor<any>>)[effectAction.type];
                            if (executor) {
                                // For discard effects, source and target are the owner of the deck
                                newState = executor.execute(newState, targetId, targetId, effectAction as any, discardedData, _context);
                            } else {
                                console.warn(`[DiscardExecutor] No executor found for discard effect type: ${effectAction.type}`);
                            }
                        }
                    }
                }
            }
        }

        return newState;
    }
}

export class ExhaustExecutor extends ActionExecutor<ExhaustActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ExhaustActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount } = actionData;
        return applyMutations(state, [{
            type: 'EXHAUST',
            sourceId,
            targetId,
            payload: { amount }
        }]);
    }
}

export class ReturnExecutor extends ActionExecutor<ReturnActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ReturnActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount, sourcePile, destinationPile } = actionData;
        return applyMutations(state, [{
            type: 'RETURN',
            sourceId,
            targetId,
            payload: { amount, sourcePile, destinationPile }
        }]);
    }
}

export class SearchExecutor extends ActionExecutor<SearchActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: SearchActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount, criteria } = actionData;
        return applyMutations(state, [{
            type: 'SEARCH',
            sourceId,
            targetId,
            payload: { amount, criteria }
        }]);
    }
}

export class MultiplyStatusExecutor extends ActionExecutor<MultiplyStatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: MultiplyStatusActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { status, factor } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
        if (!target) return state;

        const existingStatus = target.statusEffects.find(s => s.type === status);
        if (!existingStatus) return state;

        const bonusStacks = Math.floor(existingStatus.stacks * (factor - 1));
        if (bonusStacks <= 0) return state;

        return applyMutations(state, [{
            type: 'STATUS',
            targetId: targetId,
            sourceId: sourceId,
            payload: { status, stacks: bonusStacks }
        }]);
    }
}



export class TriggerStatusExecutor extends ActionExecutor<TriggerStatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: TriggerStatusActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { status } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
        if (!target) return state;

        const effect = target.statusEffects.find(s => s.type === status);
        if (!effect) return state;

        const behavior = getStatusBehavior(effect.type);
        const result = behavior.endTurn(effect, target);

        let finalState = state;
        let damage = result.damage;

        if (damage > 0) {
            const { damage: finalDamage } = executeStatusDamageCalculated(state, target, damage, effect.type);
            damage = finalDamage;

            finalState = addLog(finalState, `  ☣️ ${status} effect triggered for ${damage} damage!`);
            finalState = applyMutations(finalState, [{
                type: 'HP',
                sourceId: sourceId,
                targetId: targetId,
                payload: {
                    amount: damage,
                    isHeal: false,
                    element: status === 'Burn' ? 'Fire' : 'None'
                }
            }]);
        }

        if (result.healing && result.healing > 0) {
            finalState = applyMutations(finalState, [{
                type: 'HP',
                sourceId: sourceId,
                targetId: targetId,
                payload: {
                    amount: result.healing,
                    isHeal: true
                }
            }]);
        }

        return finalState;
    }
}

export class PlayLastCardExecutor extends ActionExecutor<PlayLastCardActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, _actionData: PlayLastCardActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        if (!state.lastProgramPlayed) {
            return applyMutations(state, [{
                type: 'LOG',
                targetId: '',
                payload: '  ⚠️ No program was played previously!'
            }]);
        }

        // Re-execute handlePlayProgram for the last card
        // Note: This might cost energy again if we just call handlePlayProgram.
        // The user said "Re-executes the actions of whatever card is in lastProgramPlayed".
        // Usually "Echo" effects in card games don't re-pay cost.
        // I will manually execute the actions of the last program to avoid re-paying cost.
        const lastProgramData = GetProgramData(state.lastProgramPlayed);
        let finalState = state;

        if (lastProgramData.actions) {
            finalState = addLog(finalState, `  🔁 Reprogramming: ${lastProgramData.name}`);
            for (const action of lastProgramData.actions) {
                // Prevent infinite recursion: do not re-execute PlayLastCard actions
                if (action.type === 'PLAY_LAST_CARD') {
                    continue;
                }

                const executor = (ActionExecutorRegistry as Record<string, ActionExecutor<any>>)[action.type];
                if (executor) {
                    // For simplicity, we use the current target for the repeated actions
                    finalState = executor.execute(finalState, sourceId, targetId, action as any, lastProgramData, _context);
                }
            }
        }

        return finalState;
    }
}

export class TauntExecutor extends ActionExecutor<TauntActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, _actionData: TauntActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const isPlayerSource = state.playerParty.some(e => e.id === sourceId);
        const enemyPartyKey = isPlayerSource ? 'enemyParty' : 'playerParty';
        const sourceName = isPlayerSource ? state.playerParty.find(e => e.id === sourceId)?.name : state.enemyParty.find(e => e.id === sourceId)?.name;

        let newState = state;
        newState = addLog(newState, `  🤬 ${sourceName} uses Taunt! All enemies are forced to target them!`);

        const updatedParty = newState[enemyPartyKey].map(e => ({
            ...e,
            forcedTargetId: sourceId
        }));

        newState = { ...newState, [enemyPartyKey]: updatedParty };
        return newState;
    }
}

export class BuffNextProgramExecutor extends ActionExecutor<BuffNextProgramActionData> {
    execute(state: IBattleState, _sourceId: string, targetId: string, actionData: BuffNextProgramActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const isPlayerTarget = state.playerParty.some(e => e.id === targetId);
        const partyKey = isPlayerTarget ? 'playerParty' : 'enemyParty';
        let newState = state;

        const party = newState[partyKey];
        const targetIndex = party.findIndex(e => e.id === targetId);

        if (targetIndex > -1) {
            const target = party[targetIndex];
            const newModifier = {
                multiplier: actionData.multiplier ?? 1,
                flatBonus: actionData.flatBonus ?? 0,
                costReduction: actionData.costReduction ?? 0,
                appliesTo: actionData.appliesTo
            };

            const updatedParty = [...party];
            updatedParty[targetIndex] = {
                ...target,
                nextProgramModifier: newModifier
            };

            newState = { ...newState, [partyKey]: updatedParty };
            newState = addLog(newState, `  ✨ ${target.name} primes their next program!`);
        }

        return newState;
    }
}

export class RedirectTargetExecutor extends ActionExecutor<RedirectTargetActionData> {
    execute(state: IBattleState, _sourceId: string, targetId: string, actionData: RedirectTargetActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { newTargetId, isRandom } = actionData;

        let finalTargetId = newTargetId;
        let newState = state;

        if (isRandom) {
            const prng = new PRNG(newState.seed);

            // Redirect to a random ally of the originally targeted entity
            const isPlayerTarget = newState.playerParty.some(e => e.id === targetId);
            const targetParty = isPlayerTarget ? newState.playerParty : newState.enemyParty;
            const validTargets = targetParty.filter(e => e.currentHp > 0 && e.id !== targetId);

            if (validTargets.length > 0) {
                const { value: randIndex, nextSeed } = prng.nextInt(0, validTargets.length - 1);
                finalTargetId = validTargets[randIndex].id;
                newState = { ...newState, seed: nextSeed };
            } else {
                return newState; // No valid other targets
            }
        }

        if (!finalTargetId) return newState;

        const isPlayerActualTarget = newState.playerParty.some(e => e.id === targetId);
        const actualTargetPartyKey = isPlayerActualTarget ? 'playerParty' : 'enemyParty';

        const party = newState[actualTargetPartyKey];
        const index = party.findIndex(e => e.id === targetId);

        if (index > -1) {
            const updatedParty = [...party];
            updatedParty[index] = {
                ...party[index],
                forcedTargetId: finalTargetId
            };

            const targetName = party[index].name;
            const newTargetName = newState.playerParty.find(e => e.id === finalTargetId)?.name || newState.enemyParty.find(e => e.id === finalTargetId)?.name || 'someone else';

            newState = { ...newState, [actualTargetPartyKey]: updatedParty };
            newState = addLog(newState, `  🎯 ${targetName} is forced to target ${newTargetName}!`);
            return newState;
        }

        return newState;
    }
}

export class ForceDiscardExecutor extends ActionExecutor<ForceDiscardActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ForceDiscardActionData, program: ProgramData | undefined, context: HookContext): IBattleState {
        // Delegate to DiscardExecutor so we don't duplicate discardEffect logic
        const discardExecutor = ActionExecutorRegistry['DISCARD'];
        return discardExecutor.execute(state, sourceId, targetId, {
            ...actionData,
            type: 'DISCARD'
        }, program, context);
    }
}

/**
 * SHIFT_STANCE (Watcher model): moves the SOURCE of the card into Dark or Light
 * Stance, regardless of the card's target. Entering a stance removes the opposite
 * one (also enforced by StanceBehavior.onApply — belt and suspenders) and routes
 * through the STATUS mutation pipeline so STATUS_APPLIED events and
 * onStatusApplied hooks (e.g. Hel's EQUINOX_TOGGLE draw) fire normally.
 * Re-entering the current stance is a no-op: no event, no hook trigger.
 */
export class ShiftStanceExecutor extends ActionExecutor<ShiftStanceActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: ShiftStanceActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const stanceStatus: StatusType = actionData.stance === 'Dark' ? 'DarkStance' : 'LightStance';
        const oppositeStatus: StatusType = actionData.stance === 'Dark' ? 'LightStance' : 'DarkStance';

        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        if (!source) return state;

        // Already in this stance: nothing shifts (stacks stay capped at 1).
        if (source.statusEffects.some(s => s.type === stanceStatus)) {
            return addLog(state, `  ⚖️ ${source.name} is already in ${actionData.stance} Stance`);
        }

        let newState = state;
        const hadOpposite = source.statusEffects.some(s => s.type === oppositeStatus);

        // Explicitly strip the opposite stance first (StanceBehavior.onApply would
        // also do this, but removing it here guarantees a STATUS_REMOVED event for
        // the VFX/status-ring even if behaviors change later).
        if (hadOpposite) {
            const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
                party.map(e => e.id === sourceId
                    ? { ...e, statusEffects: e.statusEffects.filter(s => s.type !== oppositeStatus) }
                    : e);
            newState = {
                ...newState,
                playerParty: updateParty(newState.playerParty),
                enemyParty: updateParty(newState.enemyParty)
            };
            globalBattleEventBus.emit({
                type: 'STATUS_REMOVED',
                targetId: sourceId,
                status: oppositeStatus,
                timestamp: Date.now()
            });
        }

        const icon = actionData.stance === 'Dark' ? '☾' : '☀';
        newState = addLog(newState, `  ${icon} ${source.name} enters ${actionData.stance} Stance`);

        // Apply the stance through the standard STATUS pipeline: caps at 1 stack,
        // emits STATUS_APPLIED and fires onStatusApplied hooks (EQUINOX_TOGGLE).
        return applyMutations(newState, [{
            type: 'STATUS',
            targetId: sourceId,
            sourceId: sourceId,
            payload: { status: stanceStatus, stacks: 1 }
        }]);
    }
}

// Registry to route ActionType to Executors
export const ActionExecutorRegistry: Record<ActionType, ActionExecutor<any>> = {
    'ATTACK': new AttackExecutor(),
    'STATUS': new StatusExecutor(),
    'HEAL': new HealExecutor(),
    'DRAW': new DrawExecutor(),
    'ENERGY': new EnergyExecutor(),
    'GENERATE_CARD': new GenerateCardExecutor(),
    'CLEANSE': new CleanseExecutor(),
    'DISCARD': new DiscardExecutor(),
    'EXHAUST': new ExhaustExecutor(),
    'RETURN': new ReturnExecutor(),
    'SEARCH': new SearchExecutor(),
    'MULTIPLY_STATUS': new MultiplyStatusExecutor(),
    'TRIGGER_STATUS': new TriggerStatusExecutor(),
    'PLAY_LAST_CARD': new PlayLastCardExecutor(),
    'TAUNT': new TauntExecutor(),
    'BUFF_NEXT_PROGRAM': new BuffNextProgramExecutor(),
    'REDIRECT_TARGET': new RedirectTargetExecutor(),
    'FORCE_DISCARD': new ForceDiscardExecutor(),
    'SHIFT_STANCE': new ShiftStanceExecutor()
};
