import {
    type HookDefinition,
    type DataHookDefinition,
    type ModifierDataHookDefinition,
    type HookCondition,
    type HookAction,
    type HookContext,
    type HookResult,
    type MutationRequest
} from './HookTypes';
import { resolveCounterKey } from './HookTypes';
import type { IBattleState, IBattleEntity, ActionType } from '../types';
import { StatusType } from '../types';
import { PRNG } from './PRNG';
import { ConditionValidator, NEGATIVE_STATUSES } from './ConditionValidator';
import { ActionExecutorRegistry, STRENGTH_STACK_CAP } from '../actions/ActionExecutors';
import { applyMutations } from '../resolutionEngine';
import { numericBaseCost } from '../types';

// Hook ids we've already warned about having a malformed "condition" — warn once, not every trigger.
const warnedBadConditions = new Set<string>();

/**
 * Safely evaluates a hook's custom "condition". Only functions are invoked;
 * anything else (e.g. a JS-source string left in hooks.json) is ignored with a
 * warning so bad data can never crash a battle.
 */
function evaluateCustomCondition(
    id: string,
    condition: unknown,
    context: HookContext,
    owner: IBattleEntity
): boolean {
    if (condition === undefined || condition === null) return true;
    if (typeof condition === 'function') {
        return (condition as (context: HookContext, owner: IBattleEntity) => boolean)(context, owner);
    }
    if (!warnedBadConditions.has(id)) {
        warnedBadConditions.add(id);
        console.warn(`[HookFactory] Hook "${id}" has a non-function "condition" (${typeof condition}); ignoring it. Express it via the data-driven "when" object instead.`);
    }
    return true;
}

/**
 * HookFactory: Generates functional hooks from data definitions.
 */
export const HookFactory = {
    createHook(data: DataHookDefinition | ModifierDataHookDefinition): HookDefinition {
        const priority = data.priority;
        const id = data.id;

        if (data.trigger === 'onDamageCalculated' || data.trigger === 'onStatusDamageCalculated' || data.trigger === 'onCostCalculated' || data.trigger === 'onHealCalculated') {
            const modifierData = data as ModifierDataHookDefinition;
            return {
                id,
                priority,
                [data.trigger]: (damage: number, context: HookContext, owner: IBattleEntity) => {
                    if (this.checkCondition(modifierData.when, context, owner)
                        && evaluateCustomCondition(id, modifierData.condition, context, owner)) {
                        let newDamage = damage;

                        const scaleFactor = modifierData.scaling
                            ? this.resolveScaling(modifierData.scaling, modifierData.scalingKey, context, owner)
                            : 1;

                        // `!== undefined`, not truthiness: ticket 36's UNDERWORLD_GATEWAY zeroes
                        // Hel's card costs with `"multiplier": 0`, and 0 is falsy - the old guard
                        // silently dropped the whole hook. Every other multiplier in the registry
                        // is non-zero, so this is a no-op for them.
                        if (modifierData.multiplier !== undefined) newDamage *= (1 + ((modifierData.multiplier - 1) * scaleFactor));
                        if (modifierData.bonus) newDamage += (modifierData.bonus * scaleFactor);
                        return Math.floor(newDamage);
                    }
                    return damage;
                },
                data
            };
        } else {
            const eventData = data as DataHookDefinition;
            return {
                id,
                priority,
                [eventData.trigger]: (context: HookContext, owner: IBattleEntity): HookResult => {
                    if (this.checkCondition(eventData.when, context, owner)
                        && evaluateCustomCondition(id, eventData.condition, context, owner)) {
                        return {
                            state: this.executeActions(eventData.do, context, owner)
                        };
                    }
                    return { state: context.state };
                },
                data
            };
        }
    },

    checkCondition(condition: HookCondition | undefined, context: HookContext, owner: IBattleEntity): boolean {
        return ConditionValidator.evaluateHookCondition(condition, context, owner);
    },

    resolveScaling(scaling: string, scalingKey: string | undefined, context: HookContext, owner: IBattleEntity, targetId?: string): number {
        let targetEntity = context.target;
        if (targetId) {
            targetEntity = context.state.playerParty.find(e => e.id === targetId) || context.state.enemyParty.find(e => e.id === targetId) || targetEntity;
        }

        switch (scaling) {
            case 'SOURCE_DEBUFF_COUNT':
                // Ticket 52: DISTINCT debuff types on the owner, not stacks. Reads the same
                // NEGATIVE_STATUSES list `sourceDebuffCount` gates on, so CORRUPTED_GOLD_OS's
                // condition and its payout cannot disagree about what a debuff is - each type
                // is one StatusEffectInstance, so a count of instances IS a count of types.
                return owner.statusEffects.filter(s => NEGATIVE_STATUSES.includes(s.type)).length;
            case 'CURRENT_ENERGY':
                return owner.currentEnergy;
            case 'SHARP_STACKS':
                // Ticket 52: deliberately UNCAPPED, unlike STRENGTH_STACKS below. Henry's call
                // for KINETIC_RAM was "change the rate, not the ceiling" - the hook's `bonus`
                // went 1 -> 0.5 instead. Worth knowing what that rate is buying: this is
                // `onDamageCalculated`, and `calculateDamage` runs once PER HIT, so the bonus
                // lands on every hit of a multi-hit card; and Sharp's own EFFECT caps at 12.5
                // stacks while this raw count does not, so gullinbursti_v2 reaches 14-18.
                // `Math.min(stacks, STRENGTH_STACK_CAP)` is knob 1b if the rate cannot hold it.
                return owner.statusEffects.find(s => s.type === 'Sharp')?.stacks || 0;
            case 'STRENGTH_STACKS':
                // Ticket 26: same cap as the card-side scaler in ActionExecutors. Uncapped,
                // core_overclock_daemon's x(1 + 0.20 * raw stacks) reaches x5.00 at 20 stacks
                // on top of Strengthened's own capped +-25%, and the static scorer cannot see
                // daemons at all (they carry empty `actions`), so nothing else would catch it.
                return Math.min(
                    owner.statusEffects.find(s => s.type === 'Strengthened')?.stacks || 0,
                    STRENGTH_STACK_CAP
                );
            case 'ALIVE_ALLIES': {
                const isPlayer = context.state.playerParty.some((e: IBattleEntity) => e.id === owner.id);
                const party = isPlayer ? context.state.playerParty : context.state.enemyParty;
                return party.filter((e: IBattleEntity) => e.currentHp > 0 && e.id !== owner.id).length;
            }
            case 'TARGET_POISON_STACKS':
                // Ticket 55: TOXIN_FANG_OS. Reads the DEFENDER's Poison pile, so it is the first
                // scaling in this switch that looks at `context.target` rather than the owner -
                // `targetEntity` above already resolves to the defender on an `onDamageCalculated`
                // hook, which is the only trigger this is meant for.
                //
                // Deliberately UNCAPPED, like SHARP_STACKS: the knob is the `bonus` rate, not a
                // ceiling (Henry's call on KINETIC_RAM, and the same law that keeps `growPerPlay`
                // uncapped). Note HANDOFF 8-COMPOUND - this lands at step 3 of
                // `applyDamageModifiers` and status percentages multiply it afterwards. Known and
                // accepted per the ticket.
                return targetEntity?.statusEffects.find(st => st.type === 'Poison')?.stacks || 0;
            case 'MISSING_HP':
                if (targetEntity) return targetEntity.maxHp - targetEntity.currentHp;
                return 0;
            case 'HEAL_POWER':
                // Ticket 56: the PRINTED power of the heal being cast, before calculateHeal turns
                // it into HP. This is the denomination NOURISH_ROUTINE needs - `HEAL_INTENDED`
                // below reads HP, which is a ~4.5x smaller number on these frames and floored a
                // third of audhumbla_v2's deck to zero.
                return context.state.counters['last_heal_power'] || 0;
            case 'HEAL_INTENDED':
                // Ticket 53: the whole heal before the max-HP clamp - see `last_heal_intended`.
                return context.state.counters['last_heal_intended'] || 0;
            case 'OVERHEAL':
                // Written (globally, per heal event) by effectHandlers.handleHealEffect.
                return context.state.counters['last_overheal'] || 0;
            case 'BASE_COST':
                return numericBaseCost(context.program?.baseCost ?? 0);
            case 'COUNTER':
                // scalingKey reads are raw/global — pass an already-scoped key if needed.
                if (scalingKey) return context.state.counters[scalingKey] || 0;
                return 0;
            default:
                return 1;
        }
    },

    executeActions(actions: HookAction[], context: HookContext, owner: IBattleEntity): IBattleState {
        let currentState = context.state;
        let resolvedTargetName: string | undefined = undefined;

        for (const action of actions) {
            const { targetId, state: stateAfterTargeting } = this.resolveTarget(action.target, { ...context, state: currentState }, owner);
            currentState = stateAfterTargeting;
            if (!targetId && action.target !== 'RANDOM_ENEMY' && action.target !== 'ALLIES' && action.target !== 'ENEMIES') {
                if (action.type !== 'LOG') continue;
            }

            if (targetId && !Array.isArray(targetId)) {
                const entity = currentState.playerParty.find(e => e.id === targetId) || currentState.enemyParty.find(e => e.id === targetId);
                if (entity) resolvedTargetName = entity.name;
            }

            if (action.type === 'LOG') {
                const logMsg = this.interpolateText(action.text ?? '', { ...context, state: currentState }, owner, resolvedTargetName);
                currentState = { ...currentState, logs: [...currentState.logs, logMsg] };
                continue;
            }

            let scaleFactor = 1;
            if (action.scaling) {
                scaleFactor = this.resolveScaling(action.scaling, action.scalingKey, context, owner, Array.isArray(targetId) ? targetId[0] : (targetId ?? undefined));
            }

            // Ticket 36: per-turn escalation, composed on top of whatever `scaling` resolved.
            // `playsThisTurn` has ALREADY been incremented for the card being resolved (the
            // reducer bumps it before it dispatches onActionStart), so the plays that came
            // BEFORE this one is `playsThisTurn - 1` - which makes the first cast of a turn
            // cost exactly its base rate.
            if (action.escalatePerPlay) {
                const priorPlays = Math.max(0, (owner.playsThisTurn ?? 1) - 1);
                scaleFactor *= (1 + action.escalatePerPlay * priorPlays);
            }

            if (action.type === 'COUNTER') {
                // OS counters are OWNER-scoped by default (key becomes
                // `key:ownerId`) so two units with the same OS never share a
                // count. Genuinely global counters opt out via scope: 'GLOBAL'.
                currentState = applyMutations(currentState, [{
                    type: 'COUNTER',
                    targetId: '',
                    payload: {
                        key: action.key ? resolveCounterKey(action.key, action.scope, owner) : action.key,
                        operator: action.operator,
                        amount: (action.amount || 1) * scaleFactor
                    }
                }]);
                continue;
            }

            if (action.type === 'DRAW') {
                currentState = applyMutations(currentState, [{
                    type: 'DRAW',
                    targetId: owner.id,
                    payload: { amount: (action.amount || 1) * scaleFactor }
                }]);
                continue;
            }

            // To ensure scaling/percent max HP is respected (legacy Hook logic):
            if (action.type === 'HP' as any) {
                // Ticket 36: floor the PRODUCT, not just the percentage. The floor used to sit
                // inside the percentage and every scaleFactor was an integer, so it never showed;
                // `escalatePerPlay` introduced fractional factors and 22.5 HP of damage started
                // reaching entities. A no-op for every integer scaling.
                const rawProduct = action.percentMaxHP
                    ? Math.max(1, Math.floor(owner.maxHp * (Math.abs(action.percentMaxHP) / 100))) * scaleFactor
                    : (action.amount ?? 0) * scaleFactor;
                // Ticket 53: floor the MAGNITUDE, not the signed value. `Math.floor` alone
                // rounds a negative product AWAY from zero, so NOURISH_ROUTINE's `amount: -0.25`
                // x a 45-power heal read as 12 damage where 25% is 11.25 -> 11. Every pre-53
                // hook action has an integer product, where the two agree exactly.
                const rawAmount = Math.sign(rawProduct) * Math.floor(Math.abs(rawProduct));

                const finalIsHeal = (action.percentMaxHP ? action.percentMaxHP : (action.amount ?? 0)) > 0;


                if (Array.isArray(targetId)) {
                    const mutations: any[] = targetId.map(tId => ({
                        type: 'HP',
                        targetId: tId,
                        sourceId: owner.id,
                        payload: { amount: Math.abs(rawAmount), isHeal: finalIsHeal, element: (action as any).element }
                    }));
                    currentState = applyMutations(currentState, mutations);
                } else if (targetId) {
                    currentState = applyMutations(currentState, [{
                        type: 'HP',
                        targetId,
                        sourceId: owner.id,
                        payload: { amount: Math.abs(rawAmount), isHeal: finalIsHeal, element: (action as any).element }
                    }]);
                }
                continue;
            }

            // Dynamically scale action parameters before execution
            const scaledAction = { ...action };
            if (scaledAction.amount !== undefined) scaledAction.amount *= scaleFactor;
            if (scaledAction.power !== undefined) scaledAction.power *= scaleFactor;
            if (scaledAction.stacks !== undefined) scaledAction.stacks *= scaleFactor;
            // Ticket 52: BUFF_NEXT_PROGRAM's power bonus scales too, which is what lets
            // UNSTOPPABLE_MASS read gullinbursti's own Sharp. Before this, v1 generated Sharp
            // from five of its ten cards and had NO payoff for it - the scaler that cashes Sharp
            // lives in v2's firmware - so the two decks were sharing one resource and only one
            // of them could spend it. Floored, because a fractional power bonus would land
            // downstream of `calculateDamage`'s own rounding.
            if (scaledAction.powerBonus !== undefined) scaledAction.powerBonus = Math.floor(scaledAction.powerBonus * scaleFactor);

            // MAX_ENERGY has no ActionExecutor — handle it BEFORE the registry
            // lookup (it used to sit behind the "no executor" early-continue and
            // therefore never ran for data hooks like GENESIS_FIRMWARE).
            if (scaledAction.type === 'MAX_ENERGY') {
                for (const tId of (Array.isArray(targetId) ? targetId : [targetId])) {
                    if (!tId) continue;
                    currentState = {
                        ...currentState,
                        playerParty: currentState.playerParty.map(e => e.id === tId ? { ...e, maxEnergy: e.maxEnergy + (scaledAction.amount || 0) } : e),
                        enemyParty: currentState.enemyParty.map(e => e.id === tId ? { ...e, maxEnergy: e.maxEnergy + (scaledAction.amount || 0) } : e)
                    };
                }
                continue;
            }

            const executor = ActionExecutorRegistry[action.type as ActionType];
            if (!executor) {
                console.warn(`[HookFactory] No executor found for action type: ${action.type}`);
                continue;
            }

            if (Array.isArray(targetId)) {
                for (const tId of targetId) {
                    currentState = executor.execute(currentState, owner.id, tId, scaledAction as any, context.program, { ...context, state: currentState });
                }
            } else if (targetId) {
                currentState = executor.execute(currentState, owner.id, targetId, scaledAction as any, context.program, { ...context, state: currentState });
            }
        }

        return currentState;
    },

    /**
     * Resolves an action target to entity id(s). Returns the (possibly updated)
     * state alongside the target: RANDOM_ENEMY consumes randomness, so the
     * advanced PRNG seed must be threaded back into the state (mirrors
     * RedirectTargetExecutor) — otherwise the "random" pick repeats every trigger.
     */
    resolveTarget(target: HookAction['target'], context: HookContext, owner: IBattleEntity): { targetId: string | string[] | null; state: IBattleState } {
        const state = context.state;
        if (!target) return { targetId: null, state };
        const isOwnerPlayer = state.playerParty.some(e => e.id === owner.id);

        switch (target) {
            case 'SELF': return { targetId: owner.id, state };
            case 'TARGET': return { targetId: context.target?.id ?? null, state };
            case 'SOURCE': return { targetId: context.source?.id ?? null, state };
            case 'ALLIES':
                return {
                    targetId: (isOwnerPlayer ? state.playerParty : state.enemyParty)
                        .filter(e => e.currentHp > 0)
                        .map(e => e.id),
                    state
                };
            case 'ENEMIES':
                return {
                    targetId: (isOwnerPlayer ? state.enemyParty : state.playerParty)
                        .filter(e => e.currentHp > 0)
                        .map(e => e.id),
                    state
                };
            case 'RANDOM_ENEMY': {
                const enemies = (isOwnerPlayer ? state.enemyParty : state.playerParty)
                    .filter(e => e.currentHp > 0);
                if (enemies.length === 0) return { targetId: null, state };
                const prng = new PRNG(state.seed);
                const { value: index, nextSeed } = prng.nextInt(0, enemies.length - 1);
                return {
                    targetId: enemies[index].id,
                    state: { ...state, seed: nextSeed }
                };
            }
        }
        return { targetId: null, state };
    },

    getSide(entity: IBattleEntity, context: HookContext): 'PLAYER' | 'ENEMY' {
        return context.state.playerParty.some(e => e.id === entity.id) ? 'PLAYER' : 'ENEMY';
    },

    interpolateText(text: string, context: HookContext, owner: IBattleEntity, resolvedTargetName?: string): string {
        const result = text
            .replace(/{source}/g, context.source?.name ?? 'Unknown')
            .replace(/{target}/g, resolvedTargetName || context.target?.name || 'Unknown')
            .replace(/{owner}/g, owner.name);

        return result;
    }
};
