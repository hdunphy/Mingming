import type { IBattleState, IBattleEntity, IDamageRecord, ProgramData, Element, StatusEffectInstance, AttackActionData } from './types';
import { StatusType } from './types';
import type { HookContext } from './core/Hooks';
import { calculateDamage, calculateHeal, getModifierBreakdown } from './combatUtils';
import { globalBattleEventBus } from './events';
import { getStatusBehavior } from './StatusBehaviors';
import { applyHealModifiers } from './core/Hooks';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

// TICKET 131b: was a fourth private `= 9`, which ticket 32's consolidation missed. A private copy
// meant the effect-driven draw path and the turn refill could disagree about the cap the moment
// either number moved - which is exactly what this commit does.
import { HAND_SIZE_LIMIT } from './deckLogic';

import { executeResolutionStack, crossedDownHalf, fireHpThresholdCrossed } from './resolutionEngine';

/**
 * The payload each effect handler takes, keyed by the registry key that reaches it. Named
 * here rather than inlined so the registry, the handlers and every caller are checked against
 * one declaration - `EffectHandler` used to take `payload: any`, so nothing was.
 */
export type EffectPayloads = {
    ATTACK: {
        sourceId: string;
        targetId: string;
        power: number;
        element: Element;
        damageOverride?: number;
        program?: ProgramData;
        action?: AttackActionData;
    };
    HEAL: { sourceId: string; targetId: string; power: number; flatHeal?: number; healPower?: number };
    APPLY_STATUS: { targetId: string; status: StatusType; stacks: number; sourceId?: string; power?: number };
    GENERATE_CARD: { sourceId: string; dataId: string };
    CLEANSE: { targetId: string; statusTarget?: StatusType };
};

export type EffectHandler<K extends keyof EffectPayloads = keyof EffectPayloads> =
    (state: IBattleState, payload: EffectPayloads[K]) => IBattleState;

export const effectHandlers: { [K in keyof EffectPayloads]: EffectHandler<K> } = {
    'ATTACK': handleAttack,
    'HEAL': handleHealEffect,
    'APPLY_STATUS': handleApplyStatus,
    'GENERATE_CARD': handleGenerateCard,
    'CLEANSE': handleCleanse
};

function handleAttack(state: IBattleState, payload: EffectPayloads['ATTACK']): IBattleState {
    const { sourceId, targetId, power, element, damageOverride } = payload;

    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);

    const source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!target) return state;

    // Calculate Damage
    let damage = 0;
    // Type effectiveness vs the target (1 = neutral); surfaced in the log below.
    // Cheap recompute of calculateModifier's matrix part — no math change.
    let effectiveness = 1;
    if (damageOverride !== undefined) {
        damage = damageOverride;
    } else if (source) {
        const programToUse = payload.program || ({ element: element } as ProgramData);
        effectiveness = getModifierBreakdown(source, target, programToUse).effectiveness;
        damage = calculateDamage(source, target, programToUse, power, state);

        //Is this the best place to keep scaling logic? We might end up with more. TBD
        // Scaling logic (e.g., Seed Bomb)
        if (payload.action?.scaling === 'CARDS_PLAYED') {
            const multiplier = state.cardsPlayedThisTurn;
            damage = Math.floor(damage * multiplier);
            // Use addLog indirectly or just track for logging if needed
        }
    }

    // Apply Status Post-Damage (Shields)
    let finalDamage = damage;
    let newStatus = [...target.statusEffects];
    const statusLogs: string[] = [];

    if (finalDamage > 0 && newStatus.length > 0) {
        for (const effect of [...newStatus]) {
            if (!newStatus.some(s => s.id === effect.id)) continue;
            const behavior = getStatusBehavior(effect.type);
            if (behavior) {
                const result = behavior.onPostDamage(finalDamage, target, newStatus);
                finalDamage = result.damage;
                newStatus = result.updatedInstances;
                statusLogs.push(...result.logs);
            }
        }
    }

    // Apply Damage
    const newCurrentHp = Math.max(0, target.currentHp - finalDamage);

    /*
     * THE LEDGER (`IDamageRecord`) — written here because here is the only place that knows all
     * three numbers at once, and they stop being recoverable one line later.
     *
     * `damage` is pre-shield and pre-floor; `finalDamage` is post-shield and pre-floor; the floor
     * is the `Math.max` directly above. So this is the last statement in the engine at which
     * "what the card hit for" still exists as a value — after it, only the HP delta survives, and
     * the HP delta is what the preview used to read and what Henry saw lying to him.
     *
     * `absorbed` is derived from the two damage figures rather than returned by the shield
     * behaviour: `onPostDamage` already reports its result as a reduced damage number, and asking
     * every behaviour to *also* report how much it took would be a second source for one fact.
     */
    const damageRecord: IDamageRecord = {
        sourceId,
        targetId,
        raw: damage,
        absorbed: damage - finalDamage,
        applied: target.currentHp - newCurrentHp,
        element,
    };

    // Ticket 48: Asleep loses ONE STACK per incoming attack instead of ending on the first point
    // of damage. It is applied at ASLEEP_INITIAL_STACKS (3), so it takes three attacks to break -
    // plus the natural 1/turn decay in `StatusBehaviors.ts`, which is unchanged. Both clocks run.
    //
    // Three deliberate departures from the old rule:
    //  - No `finalDamage > 0` requirement. A fully absorbed hit still counts, which is what stops
    //    `glacier_wall` from keeping Draugr asleep forever - a live anti-synergy before this.
    //  - `sourceId === 'SYSTEM'` is skipped. That literal is how `resolutionEngine` dispatches
    //    status and hook HP mutations through this handler, and skipping it is what enforces
    //    "statuses do not wake him". End-of-turn DoT ticks bypass `handleAttack` entirely, but
    //    TRIGGER_STATUS and Burn overflow do not - without this guard a poison detonate would
    //    wake him.
    //  - `onStatusRemoved` fires only when the last stack goes, not on every chip.
    let wakesUp = false;
    let sleepChipped = false;
    if (sourceId !== 'SYSTEM') {
        const sleeping = target.statusEffects.find(s => s.type === 'Asleep');
        if (sleeping) {
            sleepChipped = true;
            wakesUp = sleeping.stacks <= 1;
        }
    }

    // Emit Event. `amount` stays post-shield/pre-floor so no existing listener changes meaning;
    // the ledger rides along so the floating numbers can say what the shield took (ruling 2).
    globalBattleEventBus.emit({
        type: 'DAMAGE_TAKEN',
        targetId: target.id,
        amount: finalDamage,
        element: element,
        damage: damageRecord,
        timestamp: Date.now()
    });

    if (wakesUp) {
        globalBattleEventBus.emit({
            type: 'STATUS_REMOVED',
            targetId: target.id,
            status: 'Asleep',
            timestamp: Date.now()
        });
    }

    // Update Party
    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== targetId) return e;

            if (wakesUp) {
                newStatus = newStatus.filter(s => s.type !== 'Asleep');
                // Ticket 48: the natural expiry path in `battleReducer` has always granted a turn
                // of StableOS on waking, and `statusGlossary` has always CLAIMED the damage path
                // does too. It did not. Matching them closes that drift and is load-bearing for
                // draugr_v1: StableOS is what forces an awake turn after every wake, which is the
                // whole two-turn rhythm.
                if (!newStatus.some(s => s.type === 'StableOS')) {
                    const stableApply = getStatusBehavior('StableOS').onApply(newStatus, 1, e);
                    newStatus = stableApply.updatedEffects;
                }
            } else if (sleepChipped) {
                newStatus = newStatus.map(s =>
                    s.type === 'Asleep' ? { ...s, stacks: s.stacks - 1 } : s);
            }

            return { ...e, currentHp: newCurrentHp, statusEffects: newStatus };
        });

    let newState: IBattleState = {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty),
        damageLedger: [...(state.damageLedger ?? []), damageRecord]
    } as IBattleState;

    if (wakesUp) {
        const afterDamageTarget = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
        if (afterDamageTarget) {
            const context: HookContext = {
                target: afterDamageTarget,
                statusApplied: 'Asleep', // Reusing this property for the status name in hooks
                state: newState,
                triggerDepth: 0
            };
            const { state: afterHook } = executeResolutionStack('onStatusRemoved', context);
            newState = afterHook;
        }
    }

    newState = addLog(newState, `  → ${target.name} takes ${finalDamage} damage${newCurrentHp <= 0 ? ' ☠️ DEFEATED' : ''}`);
    if (effectiveness > 1) {
        newState = addLog(newState, '  ▶ Super effective!');
    } else if (effectiveness < 1) {
        newState = addLog(newState, '  ▷ Not very effective...');
    }
    for (const log of statusLogs) {
        newState = addLog(newState, log);
    }

    // Threshold event (ticket 12): handleAttack is the shared choke point for
    // card attacks, intent attacks, hook ATTACK actions and HP mutations, so a
    // single check here covers them all.
    if (crossedDownHalf(target.currentHp, newCurrentHp, target.maxHp)) {
        newState = fireHpThresholdCrossed(newState, targetId);
    }

    // Death Handling
    if (newCurrentHp <= 0) {
        newState = checkDefeat(newState, targetId);
    }

    return newState;
}

/**
 * THE BEREAVEMENT RALLY — one Energized to every survivor on the side that just lost a member.
 *
 * Steam-release [ticket 70](../../docs/wayfinder/steam-release/tickets/70-first-ko-snowball.md),
 * ruled by Henry on 2026-08-29 after six measured arms.
 *
 * # WHAT IT IS FOR
 *
 * A KO used to cost its side **~52% of a turn**: -33.3% energy (the dead unit stops refilling) and
 * -28.9% cards (`battleReducer`'s PRE_TURN draw is `sum(cardDraw over ALIVE) - aliveCount + 1`).
 * Measured over 60 battles, the side that scored the first KO won **91.7%** of the time and the
 * loser lost all three members in every decided game. Henry's own play report named it: *"the first
 * mingming defeated causes a massive advantage for the remaining 3 roster."*
 *
 * This grant takes the comeback rate from **8.3% to 16.7%** while leaving battle length untouched
 * at **6.5 turns** — which was the whole requirement: *"I don't like the games ending faster… I want
 * to maintain game length but fine with 15-20% comeback rate."*
 *
 * # WHY ENERGY AND NOT CARDS, WHICH IS THE COUNTERINTUITIVE PART
 *
 * The card half of the cliff was measured too, alone and combined, across four further arms. **It
 * does nothing.** Granting the bereaved side 2 cards a turn moved the comeback rate from 8.3% to
 * 8.3% (206 cards) and 10.0% (836 cards) — paired flips of 3:3 and 4:3, symmetric churn rather than
 * a weak signal. Adding cards to *this* rule made it worse, 16.7% -> 13.3%, twice.
 *
 * The side is **energy-constrained, not card-constrained**: extra cards arrive in a hand it cannot
 * afford to play. Corroborated independently by overkill, which rises when energy is granted
 * (17.8 -> 22.2 damage, because more plays actually resolve) and not when cards are (17.8 -> 16.8).
 *
 * **So do not "complete" this rule by adding a draw bonus.** That was measured and it is inert.
 *
 * # WHY IT IS ONE STACK, ONCE, TO EACH SURVIVOR
 *
 * `Energized` is consumed whole at the unit's next PRE_TURN refill, so this is a **single extra
 * energy on the turn after the death** — not a standing repair. The standing version was measured
 * too: it reaches 20.0% comebacks but shortens fights to 6.0 turns, which is the trade Henry
 * rejected.
 *
 * # BOTH SIDES, ALWAYS
 *
 * The enemy gets it as readily as the player. That is what was measured, and a rule that only
 * rescued the player would be a difficulty setting wearing a mechanic's clothes — the map's
 * standing law is that difficulty is never stat scaling.
 */
export const BEREAVEMENT_ENERGIZED_STACKS = 1;

/**
 * Apply the rally to the side that just lost `faintedIsPlayer`'s member.
 *
 * Routed through `getStatusBehavior('Energized').onApply` rather than pushing a status object
 * directly — that is what builds a well-formed `StatusEffectInstance` (with its `id`) and what
 * stacks correctly on top of an `Energized` a card already granted. The measurement harness pushed
 * a literal and got away with it because the refill only reads `type` and `stacks`; shipped code
 * does not get to rely on that.
 */
function applyBereavementRally(state: IBattleState, faintedIsPlayer: boolean): IBattleState {
    const key = faintedIsPlayer ? 'playerParty' : 'enemyParty';
    const behavior = getStatusBehavior('Energized' as StatusType);
    let granted = 0;

    const party = state[key].map((entity: IBattleEntity) => {
        // The fallen member is skipped by the same `currentHp > 0` test the refill uses; a dead
        // unit holding Energized would be a status nothing will ever consume.
        if (entity.currentHp <= 0) return entity;
        const { updatedEffects } = behavior.onApply(
            [...entity.statusEffects], BEREAVEMENT_ENERGIZED_STACKS, entity);
        granted += 1;
        return { ...entity, statusEffects: updatedEffects };
    });

    if (granted === 0) return state;

    return {
        ...state,
        [key]: party,
        // PROC-VISIBLE, the standing law for passives (ticket 16): a rule that silently hands out
        // energy is exactly the invisible modifier the vision bans. The player is told.
        logs: [...state.logs, `  ⚡ The fallen rally: +${BEREAVEMENT_ENERGIZED_STACKS} Energized to ${granted} survivor${granted === 1 ? '' : 's'}`],
    } as IBattleState;
}

export function checkDefeat(state: IBattleState, targetId: string): IBattleState {
    const target = state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId);
    if (!target) return state;

    const targetIsPlayer = state.playerParty.some(e => e.id === targetId);
    console.log(`[checkDefeat] Checking defeat for ${target.name} (${targetId}) (Internal side: ${targetIsPlayer ? 'PLAYER' : 'ENEMY'}).`);
    let newState = state;

    // Clear Daemons upon fainting
    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => e.id === targetId ? { ...e, daemons: [] } : e);

    newState = {
        ...newState,
        playerParty: updateParty(newState.playerParty),
        enemyParty: updateParty(newState.enemyParty)
    };

    // Ticket 21: a knockout used to award XP here, split across the living party, and could
    // level a unit mid-battle. Leveling is removed — the engine is frozen at CALIBRATION_LEVEL,
    // and progression is acquisition (species, OS, cards, rolls), never stat growth. A faint now
    // clears daemons and fires `onUnitFainted`, and nothing else.

    // Trigger onUnitFainted hook
    {
        const context: HookContext = {
            target: target,
            state: newState,
            triggerDepth: 0
        };
        const { state: afterHook } = executeResolutionStack('onUnitFainted', context);
        newState = afterHook;
    }

    // TICKET 70: the rally, AFTER `onUnitFainted` so those hooks still see the side as it was at
    // the moment of death. `checkDefeat` is the single chokepoint for a faint and all three of its
    // call sites are guarded on the alive->dead transition, so this fires exactly once per death.
    newState = applyBereavementRally(newState, targetIsPlayer);

    return newState;
}

/**
 * Ticket 43: `flatHeal` is the ENGINE-INTERNAL flat-HP path, used by hook and mutation heals
 * (`applyMutations` HP with `isHeal`, e.g. a percentMaxHP firmware heal). It is deliberately not
 * reachable from card data any more - `healOverride` was removed from `HealActionData` because a
 * flat heal does not scale with level, so it was overpowered early and negligible late.
 */
function handleHealEffect(state: IBattleState, payload: EffectPayloads['HEAL']): IBattleState {
    const { sourceId, targetId, power, flatHeal, healPower } = payload;
    // ... find entities ...
    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
    const source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!target) return state;
    if (!source && flatHeal === undefined) return state;

    // healAmount is the INTENDED heal (calculateHeal no longer clamps to missing
    // HP). This is the single choke point where intended vs applied diverge:
    // the applied heal is clamped to max HP below and the overflow is recorded
    // as the `last_overheal` counter for onHeal hooks (AUDHUMBLA v2).
    // Ticket 36: `onHealCalculated` runs here and ONLY here. Both pipelines converge on
    // this line - card heals arrive via calculateHeal, engine flat heals as `flatHeal` -
    // so one call covers every heal in the game and cannot double-apply. This replaced the
    // old LightStance +50%, which was hardcoded twice and disagreed between the two paths.
    //
    // `source` is only undefined on the flatHeal path (guarded above), and that path never
    // reaches calculateHeal - the ternary short-circuits first. The compiler cannot correlate
    // the two, so the narrowing is asserted rather than inferred.
    const intendedHeal = flatHeal !== undefined ? flatHeal : calculateHeal(source as IBattleEntity, target, power);
    const healAmount = applyHealModifiers(intendedHeal, {
        source: source,
        target: target,
        state: state,
        triggerDepth: 0
    });
    const newCurrentHp = Math.min(target.maxHp, target.currentHp + healAmount);
    const appliedHeal = newCurrentHp - target.currentHp;
    const overheal = Math.max(0, target.currentHp + healAmount - target.maxHp);

    globalBattleEventBus.emit({
        type: 'HEAL',
        targetId: target.id,
        amount: appliedHeal,
        sourceId: source?.id || sourceId,
        timestamp: Date.now()
    });

    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => e.id === targetId ? { ...e, currentHp: newCurrentHp } : e);

    let newState: IBattleState = {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty),
        counters: {
            ...(state.counters || {}),
            last_overheal: overheal,
            // Ticket 53: NOURISH_ROUTINE reads ALL healing, not just the overflow. Overheal-only
            // was structurally a switch - it fires never while she is behind, or constantly once
            // she is already unkillable - which is what made audhumbla's mirror a 61-turn 0/400.
            // This is the heal AFTER onHealCalculated and BEFORE the max-HP clamp, so a heal at
            // full HP still converts and a buffed heal converts at its buffed size.
            last_heal_intended: healAmount,
            // Ticket 56: NOURISH_ROUTINE is denominated in PRINTED POWER, not in HP healed.
            // `power` is the number on the card; `calculateHeal` turns it into HP at
            // `maxHp * power / 400`, which is ~4.5x smaller on an 86-HP frame - that conversion
            // is exactly what made the HP-denominated dial round a third of audhumbla_v2's deck
            // to zero damage. An ENGINE flat heal (`flatHeal`) has no printed power and records
            // 0, so it does not convert: the OS reads "every heal she CASTS".
            last_heal_power: healPower ?? (flatHeal !== undefined ? 0 : power)
        }
    } as IBattleState;

    newState = addLog(newState, overheal > 0
        ? `  → ${target.name} heals ${appliedHeal} HP (${overheal} Overheal)`
        : `  → ${target.name} heals ${appliedHeal} HP`);

    // Trigger onHeal hook
    {
        const context: HookContext = {
            source: source,
            target: newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId),
            state: newState,
            triggerDepth: 0
        };
        const { state: afterHook } = executeResolutionStack('onHeal', context);
        newState = afterHook;
    }

    return newState;
}

// ... Duality Map ...
// ... handleApplyStatus ...

// --- Duality Map (pre-step before behavior.onApply) ---

const DUALITY_MAP: Partial<Record<StatusType, StatusType>> = {
    'Sharp': 'Dazed',
    'Dazed': 'Sharp',
    'Strengthened': 'Weakened',
    'Weakened': 'Strengthened',
};

function handleApplyStatus(state: IBattleState, payload: EffectPayloads['APPLY_STATUS']): IBattleState {
    const { targetId, status, stacks, sourceId, power } = payload;
    const behavior = getStatusBehavior(status);
    if (!behavior) {
        return addLog(state, `  ⚠️ Error: Status effect "${status}" is not defined in StatusBehaviors!`);
    }

    const sourceEntity = sourceId
        ? (state.playerParty.find(e => e.id === sourceId) || state.enemyParty.find(e => e.id === sourceId))
        : undefined;

    let newState = state;

    const initialTarget = state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId);
    if (!initialTarget) return state;

    // CC Immunity Check (StableOS)
    if ((status === 'Stunned' || status === 'Asleep') && initialTarget.statusEffects.some(s => s.type === 'StableOS')) {
        return addLog(state, `  🛡️ ${initialTarget.name} resisted ${status} (StableOS Active)`);
    }

    // 1. Scaling
    const scaledStacks = behavior.getScaledStacks(stacks, sourceEntity, power);

    // 2. Duality cancellation
    const oppositeStatus = DUALITY_MAP[status];
    const currentEffects = [...initialTarget.statusEffects];
    let remainingStacks = scaledStacks;
    const dualityLogs: string[] = [];

    if (oppositeStatus && remainingStacks > 0) {
        const oppositeIndex = currentEffects.findIndex(s => s.type === oppositeStatus);
        if (oppositeIndex !== -1) {
            const opposite = currentEffects[oppositeIndex];
            if (opposite.stacks > remainingStacks) {
                currentEffects[oppositeIndex] = { ...opposite, stacks: opposite.stacks - remainingStacks };
                dualityLogs.push(`  ✨ ${initialTarget.name}'s ${oppositeStatus} reduced by ${remainingStacks} by ${status}`);
                remainingStacks = 0;
            } else if (opposite.stacks === remainingStacks) {
                currentEffects.splice(oppositeIndex, 1);
                dualityLogs.push(`  ✨ ${initialTarget.name}'s ${oppositeStatus} canceled by ${status}`);
                remainingStacks = 0;
            } else {
                remainingStacks -= opposite.stacks;
                currentEffects.splice(oppositeIndex, 1);
                dualityLogs.push(`  ✨ ${initialTarget.name}'s ${oppositeStatus} canceled by ${status}`);
            }
        }
    }

    let finalEffects = currentEffects;
    let immediateDamage = 0;
    let behaviorLogs: string[] = [];

    // 3. Behavior Logic (only if stacks remaining after duality)
    if (remainingStacks > 0) {
        const result = behavior.onApply(currentEffects, remainingStacks, initialTarget, sourceEntity, power);
        finalEffects = result.updatedEffects;
        immediateDamage = result.immediateDamage;
        behaviorLogs = result.logs;
    }

    // 4. Update State
    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== targetId) return e;
            const newHp = Math.max(0, e.currentHp - immediateDamage);
            return { ...e, currentHp: newHp, statusEffects: finalEffects };
        });

    /*
     * IMMEDIATE STATUS DAMAGE IS DAMAGE, AND IT GOES IN THE LEDGER.
     *
     * A Burn overflow burst comes out of `behavior.onApply`, not out of `handleAttack`, so it never
     * touched the ledger when the ledger was first written — and the parity suite caught it the
     * same hour, on two cards, before this shipped (`sun_eaters_plunge` previewed 17 against 29
     * actual). That is the whole reason the suite now asserts `ledger-adds-up` against the HP the
     * pool really moved rather than trusting the ledger to be complete.
     *
     * `absorbed: 0` is a statement, not a placeholder: this path deliberately does not run
     * `onPostDamage`, so no shield sees this damage and none can eat it.
     */
    const beforeHp = initialTarget.currentHp;
    const immediateRecord: IDamageRecord | null = immediateDamage > 0 ? {
        sourceId: sourceId ?? 'SYSTEM',
        targetId,
        raw: immediateDamage,
        absorbed: 0,
        applied: beforeHp - Math.max(0, beforeHp - immediateDamage),
        element: 'None',
    } : null;

    newState = {
        ...newState,
        playerParty: updateParty(newState.playerParty),
        enemyParty: updateParty(newState.enemyParty),
        ...(immediateRecord
            ? { damageLedger: [...(newState.damageLedger ?? []), immediateRecord] }
            : {}),
    };

    // Threshold event (ticket 12): overflow/immediate damage (e.g. Burn overflow
    // burst) bypasses handleAttack, so it needs its own crossing check.
    const afterOverflowTarget = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
    if (immediateDamage > 0 && afterOverflowTarget
        && crossedDownHalf(initialTarget.currentHp, afterOverflowTarget.currentHp, initialTarget.maxHp)) {
        newState = fireHpThresholdCrossed(newState, targetId);
    }

    // 4.5 Check Defeat (from immediate damage if any). Only trigger when this
    // application actually killed the target — applying a status to an entity
    // that was already dead must not re-fire faint hooks.
    const currentTarget = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
    if (currentTarget && currentTarget.currentHp <= 0 && initialTarget.currentHp > 0) {
        newState = checkDefeat(newState, targetId);
        newState = addLog(newState, `  ☠️ ${currentTarget.name} DEFEATED`);
    }

    // 5. Logging & Events
    for (const log of dualityLogs) newState = addLog(newState, log);
    for (const log of behaviorLogs) newState = addLog(newState, log);

    if (remainingStacks > 0) {
        newState = addLog(newState, `  → ${initialTarget.name} gains ${status} (${remainingStacks} stacks)`);
        globalBattleEventBus.emit({
            type: 'STATUS_APPLIED',
            targetId,
            status,
            stacks: remainingStacks,
            timestamp: Date.now()
        });
    }

    if (immediateRecord) {
        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN',
            targetId: initialTarget.id,
            amount: immediateDamage,
            element: 'None',
            damage: immediateRecord,
            timestamp: Date.now()
        });
    }

    // Trigger onStatusApplied hook
    {
        const postTarget = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
        if (postTarget) {
            const context: HookContext = {
                source: sourceEntity,
                target: postTarget,
                state: newState,
                triggerDepth: 0,
                statusApplied: status
            };
            const { state: afterHook } = executeResolutionStack('onStatusApplied', context);
            newState = afterHook;
        }
    }

    return newState;
}


// Removing dead code `handleDraw` and `handleRemoveStatus`

function handleCleanse(state: IBattleState, payload: EffectPayloads['CLEANSE']): IBattleState {
    const { targetId, statusTarget } = payload;
    let newState = state;

    const isDebuff = (status: StatusType) => {
        return ['Poison', 'Burn', 'Weakened', 'Bleed', 'Dazed', 'Stunned', 'Asleep'].includes(status);
    };

    const cleansedTracker: { entity: IBattleEntity, statuses: StatusEffectInstance[] }[] = [];

    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== targetId) return e;
            const newStatus = e.statusEffects.filter(s => {
                if (statusTarget) return s.type !== statusTarget;
                return !isDebuff(s.type); // If none specified, cleanse all debuffs
            });
            const removed = e.statusEffects.filter(s => !newStatus.includes(s));
            if (removed.length > 0) cleansedTracker.push({ entity: e, statuses: removed });
            return { ...e, statusEffects: newStatus };
        });

    newState = {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    };

    const target = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
    if (target) {
        newState = addLog(newState, `  ✨ ${target.name} was cleansed!`);
    }

    for (const { entity, statuses } of cleansedTracker) {
        const afterCleanseEntity = newState.playerParty.find(e => e.id === entity.id) || newState.enemyParty.find(e => e.id === entity.id);
        if (!afterCleanseEntity) continue;
        for (const s of statuses) {
            const context: HookContext = {
                target: afterCleanseEntity,
                statusApplied: s.type, // Reusing this property for the status name in hooks
                state: newState,
                triggerDepth: 0
            };
            const { state: afterHook } = executeResolutionStack('onStatusRemoved', context);
            newState = afterHook;
        }
    }

    return newState;
}

function handleGenerateCard(state: IBattleState, payload: EffectPayloads['GENERATE_CARD']): IBattleState {
    const { sourceId, dataId } = payload;
    const isPlayerSource = state.playerParty.some(e => e.id === sourceId);
    const deckKey = isPlayerSource ? 'playerDeck' : 'enemyDeck';
    const deck = state[deckKey];

    if (deck.hand.length >= HAND_SIZE_LIMIT) {
        return addLog(state, `  ⚠️ Hand full, cannot generate ${dataId}`);
    }

    const newCard = {
        id: crypto.randomUUID(),
        dataId: dataId,
        currentCost: 0, // Generated tokens are usually 0 cost
        isPlayable: true
    };

    return {
        ...state,
        [deckKey]: {
            ...deck,
            hand: [...deck.hand, newCard]
        }
    };
}
