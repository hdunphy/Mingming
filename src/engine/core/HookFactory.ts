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
import type { IBattleState, IBattleEntity, ActionType } from '../types';
import { StatusType } from '../types';
import { PRNG } from './PRNG';
import { ConditionValidator } from './ConditionValidator';
import { ActionExecutorRegistry } from '../actions/ActionExecutors';
import { applyMutations } from '../resolutionEngine';

/**
 * HookFactory: Generates functional hooks from data definitions.
 */
export const HookFactory = {
    createHook(data: DataHookDefinition | ModifierDataHookDefinition): HookDefinition {
        const priority = data.priority;
        const id = data.id;

        if (data.trigger === 'onDamageCalculated' || data.trigger === 'onStatusDamageCalculated' || data.trigger === 'onCostCalculated') {
            const modifierData = data as ModifierDataHookDefinition;
            return {
                id,
                priority,
                [data.trigger]: (damage: number, context: HookContext, owner: IBattleEntity) => {
                    if (this.checkCondition(modifierData.when, context, owner)) {
                        let newDamage = damage;

                        const scaleFactor = modifierData.scaling
                            ? this.resolveScaling(modifierData.scaling, modifierData.scalingKey, context, owner)
                            : 1;

                        if (modifierData.multiplier) newDamage *= (1 + ((modifierData.multiplier - 1) * scaleFactor));
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
                    if (this.checkCondition(eventData.when, context, owner) && (!eventData.condition || eventData.condition(context, owner))) {
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
            case 'CURRENT_ENERGY':
                return owner.currentEnergy;
            case 'SHARP_STACKS':
                return owner.statusEffects.find(s => s.type === 'Sharp')?.stacks || 0;
            case 'ALIVE_ALLIES': {
                const isPlayer = context.state.playerParty.some((e: IBattleEntity) => e.id === owner.id);
                const party = isPlayer ? context.state.playerParty : context.state.enemyParty;
                return party.filter((e: IBattleEntity) => e.currentHp > 0 && e.id !== owner.id).length;
            }
            case 'MISSING_HP':
                if (targetEntity) return targetEntity.maxHp - targetEntity.currentHp;
                return 0;
            case 'OVERHEAL':
                return context.state.counters['last_overheal'] || 0; // We will need to set this counter in Heal logic
            case 'BASE_COST':
                return context.program?.baseCost || 0;
            case 'COUNTER':
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
            const targetId = this.resolveTarget(action.target, { ...context, state: currentState }, owner);
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

            if (action.type === 'COUNTER') {
                currentState = applyMutations(currentState, [{
                    type: 'COUNTER',
                    targetId: '',
                    payload: {
                        key: action.key,
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
                const rawAmount = action.percentMaxHP
                    ? Math.max(1, Math.floor(owner.maxHp * (Math.abs(action.percentMaxHP) / 100))) * scaleFactor
                    : (action.amount ?? 0) * scaleFactor;

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

            const executor = ActionExecutorRegistry[action.type as ActionType];
            if (!executor) {
                console.warn(`[HookFactory] No executor found for action type: ${action.type}`);
                continue;
            }

            // Dynamically scale action parameters before execution
            const scaledAction = { ...action };
            if (scaledAction.amount !== undefined) scaledAction.amount *= scaleFactor;
            if (scaledAction.power !== undefined) scaledAction.power *= scaleFactor;
            if (scaledAction.stacks !== undefined) scaledAction.stacks *= scaleFactor;

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

    resolveTarget(target: HookAction['target'], context: HookContext, owner: IBattleEntity): string | string[] | null {
        if (!target) return null;
        const isOwnerPlayer = context.state.playerParty.some(e => e.id === owner.id);

        switch (target) {
            case 'SELF': return owner.id;
            case 'TARGET': return context.target?.id ?? null;
            case 'SOURCE': return context.source?.id ?? null;
            case 'ALLIES':
                return (isOwnerPlayer ? context.state.playerParty : context.state.enemyParty)
                    .filter(e => e.currentHp > 0)
                    .map(e => e.id);
            case 'ENEMIES':
                return (isOwnerPlayer ? context.state.enemyParty : context.state.playerParty)
                    .filter(e => e.currentHp > 0)
                    .map(e => e.id);
            case 'RANDOM_ENEMY':
                const enemies = (isOwnerPlayer ? context.state.enemyParty : context.state.playerParty)
                    .filter(e => e.currentHp > 0);
                if (enemies.length === 0) return null;
                const prng = new PRNG(context.state.seed);
                const { value: index } = prng.nextInt(0, enemies.length - 1);
                return enemies[index].id;
        }
        return null;
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
