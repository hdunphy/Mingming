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
import { NEGATIVE_STATUSES } from '../core/ConditionValidator';

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
/** Max Strengthened stacks a STRENGTH_STACKS scaler may multiply by - see ticket 23 follow-up.
 *  Shared with HookFactory.resolveScaling (ticket 26): the hook-side path was left uncapped
 *  by ticket 24, so core_overclock_daemon could reach x5.00 at 20 stacks. */
export const STRENGTH_STACK_CAP = 8;

/** Max % of maxHP-missing a MISSING_HP scaler may read (ticket 26). The cap is
 *  budget / scalingPower, so it re-derives whenever the curve moves. */
export const MISSING_HP_PCT_CAP = 50;

export function getEffectiveAttackPower(
    source: IBattleEntity,
    action: Pick<AttackActionData, 'power' | 'scaling' | 'scalingPower'>,
    target?: IBattleEntity,
): number {
    const power = action.power || 0;
    if (action.scaling === 'DAZED_STACKS') {
        // Ticket 32: reads the TARGET's raw Dazed stacks, deliberately UNCAPPED. The 2%/stack
        // damage effect is capped at +-25% in Hooks.ts, and bypassing that cap is the entire
        // point of a payoff card. Henry's law: per-stack scaling attacks should underperform
        // early and overperform late - that is the shape, not a bug. Cap only if a balance run
        // shows it running away (the STRENGTH_STACKS cap was added AFTER measurement, not
        // before). `target` is optional so the UI preview can call this without one; with no
        // target the card reads as 0 power, which is what an unaimed card is worth.
        const dazed = target?.statusEffects.find(s => s.type === 'Dazed')?.stacks || 0;
        return power * dazed;
    }
    if (action.scaling === 'DISTINCT_STATUS') {
        // Ticket 48: counts DISTINCT negative statuses on the target, not stacks. `STATUS_COUNT`
        // could not be reused - it reads total stacks and adds +25% each, uncapped, so thirteen
        // stacks is +325%. Uncapped by the same reasoning as DAZED_STACKS, and it reads the same
        // NEGATIVE_STATUSES list GRAVE_CHILL_OS gates on, so draugr_v2's payoff and its firmware
        // agree about what a debuff is by construction. `target` optional for the UI preview.
        const distinct = new Set(
            (target?.statusEffects ?? [])
                .filter(s => s.stacks > 0 && NEGATIVE_STATUSES.includes(s.type))
                .map(s => s.type),
        ).size;
        return power * distinct;
    }
    if (action.scaling === 'BARKSHIELD_STACKS') {
        // Ticket 50: reads the SOURCE's own standing BarkShield - avalanche casts the wall at
        // them. Uncapped, per Henry's law that per-stack scalers should underperform early and
        // overperform late; the 20%/turn decay and incoming damage already bound the pile.
        //
        // FLOOR IS LOAD-BEARING. BarkShield stacks are FRACTIONAL: onPostDamage stores
        // `shieldPercent - absorbedPercent` and the end-of-turn decay multiplies by 0.8, so a
        // live shield is routinely 7.36 stacks. Without the floor this reproduces ticket 36's
        // fractional-product bug, which put 22.5 HP of damage into an entity.
        const shield = source.statusEffects.find(s => s.type === 'BarkShield')?.stacks || 0;
        return power * Math.floor(shield);
    }
    if (action.scaling === 'SHARP_STACKS') {
        const sharpStacks = source.statusEffects.find(s => s.type === 'Sharp')?.stacks || 0;
        return power + 5 * sharpStacks;
    }
    if (action.scaling === 'MISSING_HP') {
        // Power-side (ticket 26): rides the divisor, STAB and resistances like every other
        // power bonus. Was a flat post-damage add in AttackExecutor, which bypassed all three
        // and disagreed with what powerscale charged for it.
        const pctMissing = source.maxHp > 0
            ? ((source.maxHp - source.currentHp) / source.maxHp) * 100
            : 0;
        return power + (action.scalingPower || 0) * Math.min(pctMissing, MISSING_HP_PCT_CAP);
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
            const effectivePower = getEffectiveAttackPower(source, actionData, target);

            damage = calculateDamage(source, target, programToUse, effectivePower, state);

            if (scaling === 'CARDS_PLAYED') {
                const multiplier = state.cardsPlayedThisTurn;
                damage = Math.floor(damage * multiplier);
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

        // Ticket 33: STATUS_CONSUMED scaling, previously implemented for HEAL only. Multiply
        // by the count a preceding consume action in the SAME card recorded (hexbloom:
        // "consume all Weakened on the target, apply that many Poison"). The `consume` branch
        // below returns early, so a consume action can never read its own multiplier - which
        // is what guarantees the two actions resolve in the authored order.
        // Ticket 41: WEAKENED_STACKS reads the TARGET's Weakened WITHOUT consuming it, so the
        // pile survives and the card can be cast again off the same standing resource. That is
        // the whole difference from STATUS_CONSUMED, which spends its input - and it is what
        // makes hexbloom price honestly. Consuming turns the card into a hoard dump whose value
        // scales with however long you saved up (x3 measured 13.90 against a 6.5 band); not
        // consuming turns it into a RATE, so x2 is enough and x2 scores 6.30.
        const weakenedOnTarget = actionData.scaling === 'WEAKENED_STACKS'
            ? ((state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId))
                ?.statusEffects.find(s => s.type === 'Weakened')?.stacks ?? 0)
            : 0;
        const effectiveStacks = actionData.scaling === 'STATUS_CONSUMED'
            ? (stacks || 0) * (state.lastStatusConsumed ?? 0)
            : actionData.scaling === 'WEAKENED_STACKS'
            ? (stacks || 0) * weakenedOnTarget
            : stacks;

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

        // A scaled apply that resolves to nothing must not create a 0-stack status instance.
        if ((actionData.scaling === 'STATUS_CONSUMED' || actionData.scaling === 'WEAKENED_STACKS') && effectiveStacks === 0) return state;

        if (effectiveStacks < 0) {
            // Contract (types.ts): negative stacks removes that many stacks,
            // deleting the status only when it reaches 0.
            const removeCount = -effectiveStacks;
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
            payload: { status, stacks: effectiveStacks }
        }]);
    }
}

export class HealExecutor extends ActionExecutor<HealActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: HealActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { power } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

        if (!target) return state;
        if (!source) return state;

        // Ticket 36: the LightStance +50% branch is gone from both heal pipelines. Heal
        // multipliers are `onHealCalculated` hooks now, applied once at the heal choke point
        // (effectHandlers.handleHealEffect) that every heal funnels through.
        // Ticket 43: `healOverride` is gone - every card heal is power-based, so it scales with
        // level. A flat heal was overpowered on a level-5 frame and negligible on a level-50 one.
        const baseHeal = calculateHeal(source as any, target, power);
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
                isHeal: true,
                // Ticket 56: carry the PRINTED power through the mutation. Every card heal reaches
                // `handleHealEffect` as a `flatHeal` (this executor resolves calculateHeal itself),
                // so the number on the card was being discarded before the choke point ever saw
                // it - which is why NOURISH_ROUTINE could only be denominated in HP. `healPower`
                // is read there into `last_heal_power` and nowhere else.
                healPower: actionData.scaling === 'STATUS_CONSUMED'
                    ? power * (state.lastStatusConsumed ?? 0)
                    : power
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
        const { amount, sourcePile, destinationPile, filter } = actionData;
        return applyMutations(state, [{
            type: 'RETURN',
            sourceId,
            targetId,
            payload: { amount, sourcePile, destinationPile, filter }
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

/**
 * Ticket 53 - resolve a program's actions for FREE, with no Energy paid, no hand/pile move and
 * no constraint check. This is the same shape as `PlayLastCardExecutor` above (that is what the
 * ticket means by "PLAY_LAST_CARD machinery"), pulled out as a function because VALHALLA_UPLINK
 * needs it from firmware and needs two things the executor cannot give it:
 *
 *  - a per-action target: the free cast has no declared target, so SELF actions land on the
 *    caster and everything else on a seeded random living enemy;
 *  - RAMPAGE growth: the resurrected card is a real INSTANCE, so it reads and banks
 *    `card_growth:<instanceId>` exactly as a paid cast does (ticket 53: "the VALHALLA free
 *    resurrection also grows it").
 *
 * The caller owns the pile: nothing here moves the card, so a card replayed from the discard
 * simply stays in the discard.
 */
export function resolveProgramFree(
    state: IBattleState,
    sourceId: string,
    instanceId: string,
    programData: ProgramData,
    context: HookContext
): IBattleState {
    let finalState = state;
    const isPlayerSource = finalState.playerParty.some(e => e.id === sourceId);

    // One seeded enemy pick for the whole cast, threaded back into the state so the next
    // random consumer does not replay it (same contract as HookFactory.resolveTarget).
    const enemies = (isPlayerSource ? finalState.enemyParty : finalState.playerParty).filter(e => e.currentHp > 0);
    let defaultTargetId = sourceId;
    if (enemies.length > 0) {
        const { value: index, nextSeed } = new PRNG(finalState.seed).nextInt(0, enemies.length - 1);
        defaultTargetId = enemies[index].id;
        finalState = { ...finalState, seed: nextSeed };
    }

    const growth = programData.growPerPlay ? (finalState.counters?.[`card_growth:${instanceId}`] || 0) : 0;

    for (const action of programData.actions ?? []) {
        // No recursion: a free cast may not itself echo, or VALHALLA + Reprogram loops.
        if (action.type === 'PLAY_LAST_CARD') continue;

        const isSelf = action.target === 'SELF' || (action.target as string) === 'Self' || action.type === 'DISCARD';
        const tId = isSelf ? sourceId : defaultTargetId;
        const target = finalState.playerParty.find(e => e.id === tId) || finalState.enemyParty.find(e => e.id === tId);
        if (!target || target.currentHp <= 0) continue;

        let resolved: ProgramAction = { ...action };
        if (growth > 0 && resolved.type === 'ATTACK' && (resolved as any).power !== undefined) {
            (resolved as any).power = (resolved as any).power + growth;
        }

        const executor = (ActionExecutorRegistry as Record<string, ActionExecutor<any>>)[resolved.type];
        if (executor) {
            finalState = executor.execute(finalState, sourceId, tId, resolved as any, programData, { ...context, state: finalState });
        }
    }

    if (programData.growPerPlay) {
        finalState = applyMutations(finalState, [{
            type: 'COUNTER',
            targetId: '',
            payload: { key: `card_growth:${instanceId}`, operator: 'ADD', amount: programData.growPerPlay }
        }]);
    }

    return finalState;
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
                powerBonus: actionData.powerBonus ?? 0,
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
