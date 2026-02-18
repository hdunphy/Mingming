import type { IBattleState, IBattleEntity, ProgramData } from '../types';

export enum HookPriority {
    SYSTEM = 100,
    GLOBAL = 75,
    ATTACKER = 50,
    PROGRAM = 40,
    DEFENDER = 25,
    LOGGING = 0
}

export type MutationRequest = {
    type: 'HP' | 'ENERGY' | 'STATUS' | 'LOG' | 'EVENT';
    targetId: string;
    payload: any;
};

export type HookResult = {
    mutations: MutationRequest[];
    isCancelled?: boolean;
};

export type HookContext = {
    source?: IBattleEntity;
    target?: IBattleEntity;
    program?: ProgramData;
    state: IBattleState;
    triggerDepth: number;
};

export type DamageModifierHook = (
    currentDamage: number,
    context: HookContext
) => number;

export type EventHook = (
    context: HookContext
) => HookResult;

export type HookDefinition = {
    id: string;
    priority: number;
    onDamageCalculated?: DamageModifierHook;
    onActionStart?: EventHook;
    onModifierPhase?: EventHook;
    onPostDamage?: EventHook;
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

    // 1. Collect Hooks
    const hookIds = new Set<string>();
    entities.forEach(e => e.hooks?.forEach(h => hookIds.add(h)));

    const hooks: HookDefinition[] = Array.from(hookIds)
        .map(id => hookRegistry[id])
        .filter((h): h is HookDefinition => !!h && !!h.onDamageCalculated);

    // 2. Sort by Priority
    hooks.sort((a, b) => b.priority - a.priority);

    // 3. Apply Modifiers
    hooks.forEach(hook => {
        if (hook.onDamageCalculated) {
            damage = hook.onDamageCalculated(damage, context);
        }
    });

    return Math.floor(damage);
};
