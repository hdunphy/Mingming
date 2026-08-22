import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { StatusType } from './types';
import { calculateDamage, calculateHeal, getModifierBreakdown } from './combatUtils';
import { globalBattleEventBus } from './events';
import { getStatusBehavior } from './StatusBehaviors';
import { applyHealModifiers } from './core/Hooks';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

const HAND_SIZE_LIMIT = 9;

import { executeResolutionStack, crossedDownHalf, fireHpThresholdCrossed } from './resolutionEngine';

export type EffectHandler = (state: IBattleState, payload: any) => IBattleState;

export const effectHandlers: Record<string, EffectHandler> = {
    'ATTACK': handleAttack,
    'HEAL': handleHealEffect,
    'APPLY_STATUS': handleApplyStatus,
    'GENERATE_CARD': handleGenerateCard,
    'CLEANSE': handleCleanse
};

function handleAttack(state: IBattleState, payload: { sourceId: string; targetId: string; power: number; element: any; damageOverride?: number; program?: ProgramData; action?: any }): IBattleState {
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

    // Emit Event
    globalBattleEventBus.emit({
        type: 'DAMAGE_TAKEN',
        targetId: target.id,
        amount: finalDamage,
        element: element,
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
        enemyParty: updateParty(state.enemyParty)
    } as IBattleState;

    if (wakesUp) {
        const afterDamageTarget = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
        if (afterDamageTarget) {
            const context = {
                target: afterDamageTarget,
                statusApplied: 'Asleep', // Reusing this property for the status name in hooks
                state: newState,
                triggerDepth: 0
            };
            const { state: afterHook } = executeResolutionStack('onStatusRemoved', context as any);
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
        const context = {
            target: target,
            state: newState,
            triggerDepth: 0
        };
        const { state: afterHook } = executeResolutionStack('onUnitFainted', context as any);
        newState = afterHook;
    }

    return newState;
}

/**
 * Ticket 43: `flatHeal` is the ENGINE-INTERNAL flat-HP path, used by hook and mutation heals
 * (`applyMutations` HP with `isHeal`, e.g. a percentMaxHP firmware heal). It is deliberately not
 * reachable from card data any more - `healOverride` was removed from `HealActionData` because a
 * flat heal does not scale with level, so it was overpowered early and negligible late.
 */
function handleHealEffect(state: IBattleState, payload: { sourceId: string; targetId: string; power: number; flatHeal?: number; healPower?: number }): IBattleState {
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
    const intendedHeal = flatHeal !== undefined ? flatHeal : calculateHeal(source as any, target, power);
    const healAmount = applyHealModifiers(intendedHeal, {
        source: source,
        target: target,
        state: state,
        triggerDepth: 0
    } as any);
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
        const context = {
            source: source,
            target: newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId),
            state: newState,
            triggerDepth: 0
        };
        const { state: afterHook } = executeResolutionStack('onHeal', context as any);
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

function handleApplyStatus(state: IBattleState, payload: { targetId: string; status: StatusType; stacks: number; sourceId?: string; power?: number }): IBattleState {
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

    newState = {
        ...newState,
        playerParty: updateParty(newState.playerParty),
        enemyParty: updateParty(newState.enemyParty)
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

    if (immediateDamage > 0) {
        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN',
            targetId: initialTarget.id,
            amount: immediateDamage,
            element: 'None',
            timestamp: Date.now()
        });
    }

    // Trigger onStatusApplied hook
    {
        const postTarget = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
        if (postTarget) {
            const context = {
                source: sourceEntity,
                target: postTarget,
                state: newState,
                triggerDepth: 0,
                statusApplied: status
            };
            const { state: afterHook } = executeResolutionStack('onStatusApplied', context as any);
            newState = afterHook;
        }
    }

    return newState;
}


// Removing dead code `handleDraw` and `handleRemoveStatus`

function handleCleanse(state: IBattleState, payload: { targetId: string; statusTarget?: StatusType }): IBattleState {
    const { targetId, statusTarget } = payload;
    let newState = state;

    const isDebuff = (status: StatusType) => {
        return ['Poison', 'Burn', 'Weakened', 'Bleed', 'Dazed', 'Stunned', 'Asleep'].includes(status);
    };

    const cleansedTracker: { entity: IBattleEntity, statuses: any[] }[] = [];

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
            const context = {
                target: afterCleanseEntity,
                statusApplied: s.type, // Reusing this property for the status name in hooks
                state: newState,
                triggerDepth: 0
            };
            const { state: afterHook } = executeResolutionStack('onStatusRemoved', context as any);
            newState = afterHook;
        }
    }

    return newState;
}

function handleGenerateCard(state: IBattleState, payload: { sourceId: string; dataId: string }): IBattleState {
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
