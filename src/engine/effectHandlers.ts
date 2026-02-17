import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { StatusType, getExpForLevel } from './types';
import { calculateDamage, calculateHeal } from './combatUtils';
import { globalBattleEventBus } from './events';
import { getStatusBehavior } from './StatusBehaviors';
import { GetMingmingData } from './data/mingmingRegistry';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

const HAND_SIZE_LIMIT = 9;

export type EffectHandler = (state: IBattleState, payload: any) => IBattleState;

export const effectHandlers: Record<string, EffectHandler> = {
    'ATTACK': handleAttack,
    'HEAL': handleHealEffect,
    'APPLY_STATUS': handleApplyStatus,
    'DRAW': handleDraw
};

// --- XP Helpers ---

function calculateDeathXp(defeatedUnit: IBattleEntity): number {
    // Death Exp = 1/5 of XP for next level
    return Math.floor(getExpForLevel(defeatedUnit.level + 1) / 5);
}

function handleLevelUp(entity: IBattleEntity): IBattleEntity {
    // Check if current XP exceeds threshold for next level
    const xpNeeded = getExpForLevel(entity.level + 1);
    if (entity.experience >= xpNeeded) {
        const newLevel = entity.level + 1;

        // Lookup base stats from registry
        const definition = GetMingmingData(entity.definitionId);
        const baseHp = definition.baseStats.hp;
        const baseAtk = definition.baseStats.attack;
        const baseDef = definition.baseStats.defense;

        const hpIV = entity.hpIV ?? 0;
        const atkIV = entity.attackIV ?? 0;
        const defIV = entity.defenseIV ?? 0;

        // Recalculate stats using the Unity Legacy Formula
        const newMaxHp = Math.floor(((2 * baseHp) + hpIV) * newLevel / 100) + newLevel + 10;
        const newAttack = Math.floor(((2 * baseAtk) + atkIV) * newLevel / 100) + 5;
        const newDefense = Math.floor(((2 * baseDef) + defIV) * newLevel / 100) + 5;

        const hpDiff = newMaxHp - entity.maxHp;

        const leveledEntity: IBattleEntity = {
            ...entity,
            level: newLevel,
            maxHp: newMaxHp,
            currentHp: entity.currentHp + hpDiff, // Heal by the amount gained
            attack: newAttack,
            defense: newDefense
        };

        return handleLevelUp(leveledEntity); // Recursive level up
    }
    return entity;
}

function addExperience(state: IBattleState, entityId: string, amount: number): IBattleState {
    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== entityId) return e;
            const updated = handleLevelUp({ ...e, experience: e.experience + amount });
            if (updated.level > e.level) {
                globalBattleEventBus.emit({
                    type: 'LEVEL_UP',
                    targetId: e.id,
                    newLevel: updated.level,
                    timestamp: Date.now()
                });
            }
            return updated;
        });

    return {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    };
}


function handleAttack(state: IBattleState, payload: { sourceId: string; targetId: string; power: number; element: any }): IBattleState {
    const { sourceId, targetId, power, element } = payload;

    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);

    let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!source || !target) return state;

    // Calculate Damage
    const mockProgram = { element: element } as ProgramData;
    const damage = calculateDamage(source, target, mockProgram, power, state);

    // Apply Damage
    const newCurrentHp = Math.max(0, target.currentHp - damage);

    // Wake up if Asleep and taken damage
    let wakesUp = false;
    if (damage > 0) {
        const sleepIndex = target.statusEffects.findIndex(s => s.type === 'Asleep');
        if (sleepIndex !== -1) {
            wakesUp = true;
        }
    }

    // Emit Event
    globalBattleEventBus.emit({
        type: 'DAMAGE_TAKEN',
        targetId: target.id,
        amount: damage,
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

            let newStatus = e.statusEffects;
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

    newState = addLog(newState, `  → ${target.name} takes ${damage} damage${newCurrentHp <= 0 ? ' ☠️ DEFEATED' : ''}`);

    // Death / XP Handling: Award XP to the entire opposing side
    if (newCurrentHp <= 0) {
        const xpYield = calculateDeathXp(target);

        // Determine which side the defeated target belongs to
        const targetIsPlayer = state.playerParty.some(e => e.id === targetId);
        const opposingSide = targetIsPlayer ? newState.enemyParty : newState.playerParty;
        const aliveOpponents = opposingSide.filter(e => e.currentHp > 0);

        if (aliveOpponents.length > 0) {
            const xpPerUnit = Math.floor(xpYield / aliveOpponents.length);
            newState = addLog(newState, `  ✨ ${xpYield} XP split among ${aliveOpponents.length} allies (${xpPerUnit} each)`);

            for (const ally of aliveOpponents) {
                newState = addExperience(newState, ally.id, xpPerUnit);
            }
        }
    }

    return newState;
}

function handleHealEffect(state: IBattleState, payload: { sourceId: string; targetId: string; power: number }): IBattleState {
    const { sourceId, targetId, power } = payload;
    // ... find entities ...
    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
    let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!source || !target) return state;

    const healAmount = calculateHeal(source, target, power);
    // ...
    // Standard Heal Logic
    // ...
    const newCurrentHp = Math.min(target.maxHp, target.currentHp + healAmount);

    globalBattleEventBus.emit({
        type: 'HEAL',
        targetId: target.id,
        amount: healAmount,
        sourceId: source.id,
        timestamp: Date.now()
    });

    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => e.id === targetId ? { ...e, currentHp: newCurrentHp } : e);

    let newState: IBattleState = {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    } as IBattleState;

    newState = addLog(newState, `  → ${target.name} heals ${healAmount} HP`);

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

    const sourceEntity = sourceId
        ? (state.playerParty.find(e => e.id === sourceId) || state.enemyParty.find(e => e.id === sourceId))
        : undefined;

    const initialTarget = state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId);
    if (!initialTarget) return state;

    // 1. Scaling
    const scaledStacks = behavior.getScaledStacks(stacks, sourceEntity, power);

    // 2. Duality cancellation
    const oppositeStatus = DUALITY_MAP[status];
    let currentEffects = [...initialTarget.statusEffects];
    let remainingStacks = scaledStacks;
    let dualityLogs: string[] = [];

    if (oppositeStatus) {
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
    let newState = state;

    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== targetId) return e;
            const newHp = Math.max(0, e.currentHp - immediateDamage);
            return { ...e, currentHp: newHp, statusEffects: finalEffects };
        });

    newState = {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    };

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

    return newState;
}

import { drawCards } from './deckLogic';

// ... imports ...

function handleDraw(state: IBattleState, payload: { sourceId: string; targetId: string; count: number }): IBattleState {
    const { count, sourceId } = payload;

    // Draw into the deck of the side that owns the source (the caster)
    const isPlayerSource = state.playerParty.some(e => e.id === sourceId);
    const deckKey = isPlayerSource ? 'playerDeck' : 'enemyDeck';

    // 2. Delegate to deckLogic (with Seed)
    const { state: newDeckState, nextSeed } = drawCards(state[deckKey], count, state.seed);

    return {
        ...state,
        seed: nextSeed,
        [deckKey]: newDeckState
    };
}
