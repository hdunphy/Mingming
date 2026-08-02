import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { StatusType, getExpForLevel, calculateStandardStat, calculateHealth } from './types';
import { calculateDamage, calculateHeal } from './combatUtils';
import { globalBattleEventBus } from './events';
import { getStatusBehavior } from './StatusBehaviors';
import { GetMingmingData } from './data/mingmingRegistry';
import { drawCards } from './deckLogic';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

const HAND_SIZE_LIMIT = 9;

import { executeResolutionStack } from './resolutionEngine';

export type EffectHandler = (state: IBattleState, payload: any) => IBattleState;

export const effectHandlers: Record<string, EffectHandler> = {
    'ATTACK': handleAttack,
    'HEAL': handleHealEffect,
    'APPLY_STATUS': handleApplyStatus,
    'GENERATE_CARD': handleGenerateCard,
    'CLEANSE': handleCleanse
};

// --- XP Helpers ---

/**
 * XP a specific receiver earns for a knockout (before party split).
 *
 * Design (2026-08): decelerating pace with level-gap scaling.
 * - Base = the defeated unit's LEVEL SPAN (XP between its level and the next),
 *   not its cumulative total. The old cumulative/5 formula grew with the CUBE
 *   of level while the cost of a level grows with the SQUARE — past level ~13
 *   a single same-level KO granted more than a full level, so players leveled
 *   every battle, accelerating forever.
 * - Divisor grows slowly with the receiver's level (3, +1 per 10 levels), so
 *   high levels take visibly longer: ~3 same-level KOs per level at Lv5
 *   (solo), ~5 at Lv22, before the party split.
 * - Pokemon-style gap multiplier (2*their / (their + yours), clamped 0.5-1.5):
 *   stomping low-level sectors yields half XP; punching up pays a bonus.
 */
export function calculateDeathXp(defeatedUnit: IBattleEntity, receiver: IBattleEntity): number {
    const span = getExpForLevel(defeatedUnit.level + 1) - getExpForLevel(defeatedUnit.level);
    const gap = Math.min(1.5, Math.max(0.5,
        (2 * defeatedUnit.level) / (defeatedUnit.level + receiver.level)));
    const divisor = 3 + Math.floor(receiver.level / 10);
    return Math.max(1, Math.floor((span * gap) / divisor));
}

interface LevelUpResult {
    entity: IBattleEntity;
    events: any[];
}

function handleLevelUp(entity: IBattleEntity, events: any[] = []): LevelUpResult {
    const xpNeeded = getExpForLevel(entity.level + 1);
    if (entity.experience >= xpNeeded) {
        const oldLevel = entity.level;
        const newLevel = entity.level + 1;

        const definition = GetMingmingData(entity.definitionId);
        const baseHp = definition.baseStats.hp;
        const baseAtk = definition.baseStats.attack;
        const baseDef = definition.baseStats.defense;

        const hpIV = entity.hpIV ?? 0;
        const atkIV = entity.attackIV ?? 0;
        const defIV = entity.defenseIV ?? 0;

        const newMaxHp = calculateHealth(definition.baseStats.hp, hpIV, newLevel);
        const newAttack = calculateStandardStat(definition.baseStats.attack, atkIV, newLevel);
        const newDefense = calculateStandardStat(definition.baseStats.defense, defIV, newLevel);

        const hpDiff = newMaxHp - entity.maxHp;

        const oldStats = { hp: entity.maxHp, attack: entity.attack, defense: entity.defense };
        const newStats = { hp: newMaxHp, attack: newAttack, defense: newDefense };

        const leveledEntity: IBattleEntity = {
            ...entity,
            level: newLevel,
            maxHp: newMaxHp,
            currentHp: entity.currentHp + hpDiff,
            attack: newAttack,
            defense: newDefense
        };

        events.push({
            entityId: entity.id,
            nickname: entity.name,
            oldLevel,
            newLevel,
            oldStats,
            newStats
        });

        return handleLevelUp(leveledEntity, events);
    }
    return { entity, events };
}

function addExperience(state: IBattleState, entityId: string, amount: number): IBattleState {
    console.log(`[addExperience] Distributing ${amount} XP to ${entityId}.`);
    let levelUpEvents: any[] = [];

    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== entityId) return e;
            const { entity: updated, events } = handleLevelUp({ ...e, experience: e.experience + amount });
            if (events.length > 0) {
                levelUpEvents = [...levelUpEvents, ...events];
                globalBattleEventBus.emit({
                    type: 'LEVEL_UP',
                    targetId: e.id,
                    newLevel: updated.level,
                    timestamp: Date.now()
                });
            }
            return updated;
        });

    const newPlayerParty = updateParty(state.playerParty);
    const newEnemyParty = updateParty(state.enemyParty);

    return {
        ...state,
        playerParty: newPlayerParty,
        enemyParty: newEnemyParty,
        levelUpQueue: [...state.levelUpQueue, ...levelUpEvents]
    };
}


function handleAttack(state: IBattleState, payload: { sourceId: string; targetId: string; power: number; element: any; damageOverride?: number; program?: ProgramData; action?: any }): IBattleState {
    const { sourceId, targetId, power, element, damageOverride } = payload;

    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);

    let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!target) return state;

    // Calculate Damage
    let damage = 0;
    if (damageOverride !== undefined) {
        damage = damageOverride;
    } else if (source) {
        const programToUse = payload.program || ({ element: element } as ProgramData);
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
    let statusLogs: string[] = [];

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

    // Wake up if Asleep and actually taken damage (a shield that absorbs the
    // full hit should not wake the sleeper, so check post-mitigation damage).
    let wakesUp = false;
    if (finalDamage > 0) {
        const sleepIndex = target.statusEffects.findIndex(s => s.type === 'Asleep');
        if (sleepIndex !== -1) {
            wakesUp = true;
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
    for (const log of statusLogs) {
        newState = addLog(newState, log);
    }

    // Death / XP Handling
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
    const opposingSideKey = targetIsPlayer ? 'enemyParty' : 'playerParty';
    const opposingSide = state[opposingSideKey];
    const aliveOpponents = opposingSide.filter(e => e.currentHp > 0);

    let newState = state;

    // Clear Daemons upon fainting
    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => e.id === targetId ? { ...e, daemons: [] } : e);

    newState = {
        ...newState,
        playerParty: updateParty(newState.playerParty),
        enemyParty: updateParty(newState.enemyParty)
    };

    if (aliveOpponents.length > 0) {
        // Per-receiver yield (level-gap + deceleration are receiver-specific),
        // then split across the living party.
        let totalAwarded = 0;
        const awards: { id: string; amount: number }[] = [];
        for (const ally of aliveOpponents) {
            const amount = Math.max(1, Math.floor(calculateDeathXp(target, ally) / aliveOpponents.length));
            awards.push({ id: ally.id, amount });
            totalAwarded += amount;
        }
        newState = addLog(newState, `  ✨ ${totalAwarded} XP split among ${aliveOpponents.length} allies`);

        for (const award of awards) {
            newState = addExperience(newState, award.id, award.amount);
        }
    }

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

function handleHealEffect(state: IBattleState, payload: { sourceId: string; targetId: string; power: number; healOverride?: number }): IBattleState {
    const { sourceId, targetId, power, healOverride } = payload;
    // ... find entities ...
    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
    let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!target) return state;
    if (!source && healOverride === undefined) return state;

    const healAmount = healOverride !== undefined ? healOverride : calculateHeal(source as any, target, power);
    // ...
    // Standard Heal Logic
    // ...
    const newCurrentHp = Math.min(target.maxHp, target.currentHp + healAmount);
    const overheal = Math.max(0, target.currentHp + healAmount - target.maxHp);

    globalBattleEventBus.emit({
        type: 'HEAL',
        targetId: target.id,
        amount: healAmount,
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
            last_overheal: overheal
        }
    } as IBattleState;

    newState = addLog(newState, `  → ${target.name} heals ${healAmount} HP`);

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
    let currentEffects = [...initialTarget.statusEffects];
    let remainingStacks = scaledStacks;
    let dualityLogs: string[] = [];

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

    // 4.5 Check Defeat (from immediate damage if any). Only trigger when this
    // application actually killed the target — applying a status to an entity
    // that was already dead must not re-award death XP / re-fire faint hooks.
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
