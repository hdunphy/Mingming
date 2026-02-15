import { IBattleState, IBattleEntity, ProgramData } from '../types';

export type HookContext = {
    source?: IBattleEntity;
    target?: IBattleEntity;
    program?: ProgramData;
    state: IBattleState;
};

export type DamageModifierHook = (
    currentDamage: number,
    context: HookContext
) => number;

export type HookDefinition = {
    id: string;
    onDamageCalculated?: DamageModifierHook;
    // Add more hooks here (onHeal, onTurnStart, etc.)
};

const hookRegistry: Record<string, HookDefinition> = {};

export const registerHook = (definition: HookDefinition) => {
    hookRegistry[definition.id] = definition;
};

export const getHook = (id: string): HookDefinition | undefined => {
    return hookRegistry[id];
};

export const applyDamageModifiers = (
    initialDamage: number,
    context: HookContext
): number => {
    let damage = initialDamage;
    const entities = [context.source, context.target].filter((e): e is IBattleEntity => !!e);

    // Collect all hook IDs from participating entities
    // In the future, we might check Global State hooks too
    const hookIds: string[] = [];
    entities.forEach(e => {
        if (e.hooks) hookIds.push(...e.hooks);
        // Also check status effects for hooks? 
        // For now, let's assume hooks are explicitly in the 'hooks' array.
    });

    hookIds.forEach(id => {
        const hook = hookRegistry[id];
        if (hook && hook.onDamageCalculated) {
            damage = hook.onDamageCalculated(damage, context);
        }
    });

    return Math.floor(damage);
};
