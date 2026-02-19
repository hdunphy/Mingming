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
import { type IBattleEntity, StatusType } from '../types';
import { PRNG } from './PRNG';

/**
 * HookFactory: Generates functional hooks from data definitions.
 */
export const HookFactory = {
    createHook(data: DataHookDefinition | ModifierDataHookDefinition): HookDefinition {
        const priority = data.priority;
        const id = data.id;

        if (data.trigger === 'onDamageCalculated') {
            const modifierData = data as ModifierDataHookDefinition;
            return {
                id,
                priority,
                onDamageCalculated: (damage, context, owner) => {
                    if (this.checkCondition(modifierData.when, context, owner)) {
                        let newDamage = damage;
                        if (modifierData.multiplier) newDamage *= modifierData.multiplier;
                        if (modifierData.bonus) newDamage += modifierData.bonus;
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
                    if (this.checkCondition(eventData.when, context, owner)) {
                        return {
                            mutations: this.executeActions(eventData.do, context, owner)
                        };
                    }
                    return { mutations: [] };
                },
                data
            };
        }
    },

    checkCondition(condition: HookCondition | undefined, context: HookContext, owner: IBattleEntity): boolean {
        if (!condition) return true;

        // 1. Source Check
        if (condition.source) {
            if (condition.source === 'SELF' && context.source?.id !== owner.id) {
                return false;
            }
            const isOwnerPlayer = context.state.playerParty.some(e => e.id === owner.id);
            const isSourcePlayer = context.source ? context.state.playerParty.some(e => e.id === context.source?.id) : false;
            if (condition.source === 'ALLY' && (isOwnerPlayer !== isSourcePlayer || context.source?.id === owner.id)) return false;
            if (condition.source === 'OPPONENT' && isOwnerPlayer === isSourcePlayer) return false;
        }

        // 2. Program Checks
        if (condition.programCategory && context.program?.category !== condition.programCategory) return false;
        if (condition.programElement && context.program?.element !== condition.programElement) return false;

        // 3. Cost Check
        if (condition.baseCost !== undefined) {
            const cost = context.program?.baseCost ?? 0;
            if (typeof condition.baseCost === 'number') {
                if (cost !== condition.baseCost) return false;
            } else {
                const { operator, value } = condition.baseCost;
                if (operator === 'LT' && !(cost < value)) return false;
                if (operator === 'GT' && !(cost > value)) return false;
                if (operator === 'LTE' && !(cost <= value)) return false;
                if (operator === 'GTE' && !(cost >= value)) return false;
                if (operator === 'EQ' && !(cost === value)) return false;
            }
        }

        // 4. Status Check
        if (condition.statusApplied && context.statusApplied !== condition.statusApplied) return false;

        // 5. Draw Check
        if (condition.isNaturalDraw !== undefined && context.isNaturalDraw !== condition.isNaturalDraw) return false;

        return true;
    },

    executeActions(actions: HookAction[], context: HookContext, owner: IBattleEntity): MutationRequest[] {
        const mutations: MutationRequest[] = [];
        let resolvedTargetName: string | undefined = undefined;

        for (const action of actions) {
            const targetId = this.resolveTarget(action.target, context, owner);
            if (!targetId && action.target !== 'RANDOM_ENEMY' && action.target !== 'ALLIES' && action.target !== 'ENEMIES') {
                // For LOG, targetId might be null if action.target is not specified.
                // We don't continue for LOG.
                if (action.type !== 'LOG') continue;
            }

            // Capture a resolved target name for later LOG if needed
            if (targetId && !Array.isArray(targetId)) {
                const entity = context.state.playerParty.find(e => e.id === targetId) || context.state.enemyParty.find(e => e.id === targetId);
                if (entity) resolvedTargetName = entity.name;
            }

            switch (action.type) {
                case 'HP':
                    const rawAmount = action.percentMaxHP
                        ? Math.max(1, Math.floor(owner.maxHp * (action.percentMaxHP / 100)))
                        : (action.amount ?? 0);

                    const isHeal = action.isHeal ?? (rawAmount < 0);
                    const finalAmount = Math.abs(rawAmount);

                    if (Array.isArray(targetId)) {
                        targetId.forEach(id => mutations.push({
                            type: 'HP',
                            targetId: id,
                            sourceId: owner.id,
                            payload: { amount: finalAmount, isHeal }
                        }));
                    } else if (targetId) {
                        mutations.push({
                            type: 'HP',
                            targetId,
                            sourceId: owner.id,
                            payload: { amount: finalAmount, isHeal }
                        });
                    }
                    break;

                case 'STATUS':
                    if (Array.isArray(targetId)) {
                        targetId.forEach(id => mutations.push({
                            type: 'STATUS',
                            targetId: id,
                            sourceId: owner.id,
                            payload: { status: action.status!, stacks: action.stacks ?? 1 }
                        }));
                    } else if (targetId) {
                        mutations.push({
                            type: 'STATUS',
                            targetId,
                            sourceId: owner.id,
                            payload: { status: action.status!, stacks: action.stacks ?? 1 }
                        });
                    }
                    break;

                case 'ENERGY':
                    if (targetId && !Array.isArray(targetId)) {
                        mutations.push({
                            type: 'ENERGY',
                            targetId: targetId as string,
                            payload: { amount: action.amount ?? 0 }
                        });
                    }
                    break;

                case 'LOG':
                    mutations.push({
                        type: 'LOG',
                        targetId: owner.id,
                        payload: this.interpolateText(action.text ?? '', context, owner, resolvedTargetName)
                    });
                    break;

                case 'DRAW':
                    mutations.push({
                        type: 'EVENT',
                        targetId: owner.id,
                        payload: { type: 'DRAW_CARDS', side: this.getSide(owner, context), count: action.count ?? 1 }
                    });
                    break;
            }
        }

        return mutations;
    },

    resolveTarget(target: HookAction['target'], context: HookContext, owner: IBattleEntity): string | string[] | null {
        if (!target) return null;
        const isOwnerPlayer = context.state.playerParty.some(e => e.id === owner.id);

        switch (target) {
            case 'SELF': return owner.id;
            case 'TARGET': return context.target?.id ?? null;
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
