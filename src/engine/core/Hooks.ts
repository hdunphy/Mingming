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

    // 4. Scans for Status Modifiers (Strengthened, Weakened, Sharp, Dazed)
    // Source side (Attacker)
    if (context.source) {
        for (const effect of context.source.statusEffects) {
            if (effect.type === 'Strengthened') {
                damage *= (1 + (effect.stacks * 0.2));
            } else if (effect.type === 'Weakened') {
                damage *= Math.max(0.1, 1 - (effect.stacks * 0.2));
            } else if (effect.type === 'DarkStance') {
                // Stance system: while in Dark Stance the attacker deals +30% damage.
                damage *= 1.3;
            }
        }
    }

    // Target side (Defender)
    if (context.target) {
        for (const effect of context.target.statusEffects) {
            if (effect.type === 'Dazed') {
                damage *= (1 + (effect.stacks * 0.2));
            } else if (effect.type === 'Sharp') {
                //sharp reduces incoming damage.
                damage *= Math.max(0.1, 1 - (effect.stacks * 0.2));
            }
        }
    }

    return Math.floor(damage);
};
