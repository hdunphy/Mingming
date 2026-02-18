import type { IBattleEntity } from '../types';
import {
    type HookDefinition,
    type HookContext,
    type HookResult,
    HookPriority
} from './HookTypes';
import { getOSBehavior } from '../data/firmwareRegistry';

export * from './HookTypes';

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
    entities.forEach(e => {
        if (e.hooks) e.hooks.forEach(h => hookIds.add(h));
        if (e.activeOS) {
            const os = getOSBehavior(e.activeOS);
            if (os) os.hooks.forEach(h => hookIds.add(h.id));
        }
    });

    const hooks: HookDefinition[] = Array.from(hookIds)
        .map(id => getHook(id as string))
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
