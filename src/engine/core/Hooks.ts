import type { IBattleEntity } from '../types';
import {
    type HookDefinition,
    type HookContext,
    type HookResult,
    HookPriority
} from './HookTypes';
import { getHook } from './HookRegistry';
import { getOSBehavior } from '../data/firmwareRegistry';

export * from './HookTypes';
export { getHook, registerHook } from './HookRegistry';

import { GetProgramData } from '../data/programRegistry';

export const applyDamageModifiers = (
    initialDamage: number,
    context: HookContext
): number => {
    let damage = initialDamage;
    const entities = [context.source, context.target].filter((e): e is IBattleEntity => !!e);

    // 1. Collect Hooks as Pairs
    const hookPairs: { hook: HookDefinition, owner: IBattleEntity }[] = [];
    entities.forEach(e => {
        const entityHooks = new Set<string>();
        if (e.hooks) e.hooks.forEach(h => entityHooks.add(h));
        if (e.activeOS) {
            const os = getOSBehavior(e.activeOS);
            if (os) os.hooks.forEach(h => entityHooks.add(h.id));
        }
        // Scan Daemons
        if (e.daemons) {
            e.daemons.forEach(daemon => {
                const data = GetProgramData(daemon.dataId);
                if (data.hooks) {
                    data.hooks.forEach(h => entityHooks.add(h));
                }
            });
        }

        entityHooks.forEach(id => {
            const registered = getHook(id);
            if (registered && registered.onDamageCalculated) {
                hookPairs.push({ hook: registered, owner: e });
            }
        });
    });

    // 2. Sort by Priority
    hookPairs.sort((a, b) => b.hook.priority - a.hook.priority);

    // 3. Apply Modifiers
    hookPairs.forEach(pair => {
        if (pair.hook.onDamageCalculated) {
            damage = pair.hook.onDamageCalculated(damage, context, pair.owner);
        }
    });

    return Math.floor(damage);
};
