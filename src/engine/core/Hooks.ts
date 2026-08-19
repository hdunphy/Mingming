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
 * Ticket 77: the stance percentages, as a knob rather than two literals.
 *
 * `dark` is the ATTACKER's bonus while in DarkStance, `light` the DEFENDER's reduction
 * while in LightStance. Shipped at 0.35/0.35 (ticket 78; they were 0.30). Henry: "maybe she needs a higher bonus, but
 * I still like the mechanics" - so the sweep needed a dial, and leaving it here means the
 * next person does not have to re-find these two multiplications.
 *
 * **0.35, not the 0.50 that ticket 77's table pointed at.** That table measured the bonus on
 * top of the BROKEN AI and a deck that still ran `purify`; ticket 78 fixed both, and all
 * three changes stack. Re-swept against the full 31-deck grid with the other two in place:
 * 0.50 -> 74.0% field with EIGHT cells above 90%, 0.40 -> 64.9%, **0.35 -> 59.8% and the only
 * arm with no 0% and no 100% cell in either direction**, 0.30 -> 53.1% with a 0% cell left.
 * Henry picked 0.35 off that sweep. Re-sweep before moving it again - the right number
 * depends on what else has changed.
 */
/**
 * TICKET 95: the two shapes the duality statuses can take, as one switchable model.
 *
 * Henry, after playing: *"the statuses don't feel very noticeable. Like a very small change in
 * damage output maybe 1-2 dmg once you hit the cap."* He is describing the live shape exactly -
 * 2% per stack against a +-25% cap, which at level 15 is one or two points of damage on a card
 * that deals ten. You spend a card to apply them and see nothing.
 *
 * PERCENT (live): each stack multiplies damage by `pctPerStack`, the net swing capped at `pctCap`.
 *   Bounded by construction, and the reason the cap exists is real - uncapped multipliers on both
 *   sides used to multiply a mirror down to ~1% damage and deadlock it.
 *
 * POWER (Henry's proposal): each stack is worth `powerPerStack` POWER on the relevant side, added
 *   before the pace divisor, STAB and resistances - the ticket-26 law that a bonus riding the power
 *   is the only kind the scorer can price. UNCAPPED, because the valve is the duality itself:
 *   Weakened cancels Strengthened stack for stack, Sharp cancels Dazed, and sheds/cleanses exist.
 *   A deadlock needs both sides to out-stack each other indefinitely, which the cancel prevents.
 *
 * Sweeping this is ticket 95's grid; nothing is decided here. `STATUS_MODEL` ships at the live
 * values so importing this file changes no number.
 */
export interface StatusDamageModel {
    shape: 'PERCENT' | 'POWER';
    /** PERCENT: damage multiplier per stack. */
    pctPerStack: number;
    /** PERCENT: cap on the net swing, either direction. */
    pctCap: number;
    /** POWER: power added per stack, before the divisor. Uncapped by design. */
    powerPerStack: number;
}

export const STATUS_MODEL: StatusDamageModel = {
    // TICKET 102 (Henry, off ticket 95's grid): SHIPPED as POWER, +1 per stack.
    //
    // The percent shape was invisible - 2% a stack against a 25% cap is one or two points of damage
    // at level 15, so a card spent on a status bought nothing a player could see. Power rides the
    // pace divisor, STAB and resistances like any other power bonus (the ticket-26 law), so a stack
    // is worth the same fraction of a hit at every level, and it does not cap.
    //
    // The grid's warning, kept here because it is the live risk: the duality cancel only valves a
    // deck that FACES another status deck. An OS that generates stacks against an opponent who
    // applies none has nothing eating them - `sleipnir_v1` measured 43.3% -> 85.5% on that alone.
    // The bound belongs on generation, not on the effect.
    shape: 'POWER',
    pctPerStack: 0.02,
    pctCap: 0.25,
    powerPerStack: 1,
};

export const STANCE_BONUS = { dark: 0.35, light: 0.35 };

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
    const { pctPerStack: STATUS_PCT_PER_STACK, pctCap: STATUS_PCT_CAP } = STATUS_MODEL;
    const cappedPct = (stacks: number) => Math.min(STATUS_PCT_CAP, stacks * STATUS_PCT_PER_STACK);

    // Ticket 95: under the POWER shape the four duality statuses are not a multiplier at all -
    // they are added to the card's POWER before the pace divisor, in `combatUtils.calculateDamage`.
    // Returning early here is what keeps the two shapes from double-counting.
    const powerShape = STATUS_MODEL.shape === 'POWER';

    // Source side (Attacker)
    if (context.source) {
        for (const effect of context.source.statusEffects) {
            if (effect.type === 'Strengthened') {
                if (!powerShape) damage *= (1 + cappedPct(effect.stacks));
            } else if (effect.type === 'Weakened') {
                if (!powerShape) damage *= (1 - cappedPct(effect.stacks));
            } else if (effect.type === 'DarkStance') {
                // Stance system: while in Dark Stance the attacker deals more damage.
                // Ticket 77: a knob, not a literal - Henry wanted the bonus swept before
                // concluding anything about hel_v1's OS.
                damage *= 1 + STANCE_BONUS.dark;
            }
        }
    }

    // Target side (Defender)
    if (context.target) {
        for (const effect of context.target.statusEffects) {
            if (effect.type === 'Dazed') {
                if (!powerShape) damage *= (1 + cappedPct(effect.stacks));
            } else if (effect.type === 'Sharp') {
                //sharp reduces incoming damage.
                if (!powerShape) damage *= (1 - cappedPct(effect.stacks));
            } else if (effect.type === 'LightStance') {
                // Stance system (ticket 36): while in Light Stance the DEFENDER takes -30%
                // damage. Symmetric with the source-side DarkStance +30% branch above, and
                // flat rather than stack-scaled because StanceBehavior.onApply caps stacks
                // at 1. LightStance used to grant +50% healing; that moved to hel_v2's
                // firmware, where the frame actually wants it.
                damage *= 1 - STANCE_BONUS.light;
            }
        }
    }

    return Math.floor(damage);
};
