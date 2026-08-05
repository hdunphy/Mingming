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
    //
    // docs/power_curve_spec.md rev 3: these four stack indefinitely (no cap on the
    // StatusEffectInstance itself — PermanentStatusBehavior.onApply never clamps
    // `stacks`, deliberately, so cards that read raw stack count for their own
    // scaling — e.g. fenrir_v1's Strengthened-doubler daemon — still have a real
    // number to work with). What's capped here is the *damage effect*: each stack
    // is worth 2%, capped at a net 25% swing either way. This is also the fix for
    // the mirror-match deadlock these used to cause — uncapped, the old 10%-floor
    // formula let attacker-Weakened x defender-Sharp multiply down to ~1% net
    // damage; capped at 25% each, the worst case is 0.75 x 0.75 = 56% net damage,
    // which resolves in a handful of turns instead of never.
    const STATUS_PCT_PER_STACK = 0.02;
    const STATUS_PCT_CAP = 0.25;
    const cappedPct = (stacks: number) => Math.min(STATUS_PCT_CAP, stacks * STATUS_PCT_PER_STACK);

    // Source side (Attacker)
    if (context.source) {
        for (const effect of context.source.statusEffects) {
            if (effect.type === 'Strengthened') {
                damage *= (1 + cappedPct(effect.stacks));
            } else if (effect.type === 'Weakened') {
                damage *= (1 - cappedPct(effect.stacks));
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
                damage *= (1 + cappedPct(effect.stacks));
            } else if (effect.type === 'Sharp') {
                //sharp reduces incoming damage.
                damage *= (1 - cappedPct(effect.stacks));
            }
        }
    }

    return Math.floor(damage);
};
