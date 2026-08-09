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

/**
 * Ticket 36: healing had no modifier path at all. `onHeal` fires AFTER the heal has
 * resolved (a reaction hook - audhumbla_v2 converts overheal into damage with it), so
 * there was nowhere to scale a heal before it landed. This is the heal-side twin of
 * `applyDamageModifiers`: same hook collection (entity hooks + OS hooks + daemons),
 * same priority sort, applied at the single heal choke point in effectHandlers.
 */
export const applyHealModifiers = (
    initialHeal: number,
    context: HookContext
): number => {
    let heal = initialHeal;
    // DEDUPED BY ID. A self-heal has source === target, so the naive [source, target] pair
    // collects the same entity twice and every one of its hooks gets applied twice - hel_v2's
    // 1.5x became 2.25x on her own heals, which is every heal she casts. `applyDamageModifiers`
    // carried the identical bug for self-DAMAGE cards and was fixed to match in ticket 38.
    const entities = [context.source, context.target]
        .filter((e): e is IBattleEntity => !!e)
        .filter((e, i, arr) => arr.findIndex(other => other.id === e.id) === i);

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
            if (registered && registered.onHealCalculated) {
                hookPairs.push({ hook: registered, owner: e });
            }
        });
    });

    // 2. Sort by Priority
    hookPairs.sort((a, b) => b.hook.priority - a.hook.priority);

    // 3. Apply Modifiers
    hookPairs.forEach(pair => {
        if (pair.hook.onHealCalculated) {
            heal = pair.hook.onHealCalculated(heal, context, pair.owner);
        }
    });

    return Math.floor(heal);
};

export const applyDamageModifiers = (
    initialDamage: number,
    context: HookContext
): number => {
    let damage = initialDamage;
    // Ticket 38: DEDUPED BY ID. On a self-damage card (`forage`, `dark_pact`, fenrir's recoil)
    // source === target, so the naive pair collected the caster twice and applied every hook it
    // owns twice - core_overclock_daemon's 1.2x became 1.44x, thermal_overload's 1.25x became
    // 1.5625x, and only against yourself. Found in ticket 36 on the heal side, where hel_v2's
    // 1.5x healing measured 2.25x; left until now because fixing it re-gates every tuned species.
    const entities = [context.source, context.target]
        .filter((e): e is IBattleEntity => !!e)
        .filter((e, i, arr) => arr.findIndex(other => other.id === e.id) === i);

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
            } else if (effect.type === 'LightStance') {
                // Stance system (ticket 36): while in Light Stance the DEFENDER takes -30%
                // damage. Symmetric with the source-side DarkStance +30% branch above, and
                // flat rather than stack-scaled because StanceBehavior.onApply caps stacks
                // at 1. LightStance used to grant +50% healing; that moved to hel_v2's
                // firmware, where the frame actually wants it.
                damage *= 0.7;
            }
        }
    }

    return Math.floor(damage);
};
