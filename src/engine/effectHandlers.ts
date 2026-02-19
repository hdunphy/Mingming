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

export type EffectHandler = (state: IBattleState, payload: any) => IBattleState;

export const effectHandlers: Record<string, EffectHandler> = {
    'ATTACK': handleAttack,
    'HEAL': handleHealEffect,
    'APPLY_STATUS': handleApplyStatus,
    'DRAW': handleDraw,
    'REMOVE_STATUS': handleRemoveStatus,
    'GENERATE_CARD': handleGenerateCard
};

// --- XP Helpers ---

function calculateDeathXp(defeatedUnit: IBattleEntity): number {
    // Death Exp = 1/5 of XP for next level
    return Math.floor(getExpForLevel(defeatedUnit.level + 1) / 5);
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

    if (wakesUp) {
        // Apply Awoken immediately
        newState = handleApplyStatus(newState, {
            targetId: target.id,
            status: 'Awoken',
            stacks: 1
        });
    }

    newState = addLog(newState, `  → ${target.name} takes ${damage} damage${newCurrentHp <= 0 ? ' ☠️ DEFEATED' : ''}`);

    // Death / XP Handling
    if (newCurrentHp <= 0) {
        newState = checkDefeat(newState, targetId);
    }

    return newState;
}

export function checkDefeat(state: IBattleState, targetId: string): IBattleState {
    const target = state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId);
    if (!target) return state;

    const xpYield = calculateDeathXp(target);
    const targetIsPlayer = state.playerParty.some(e => e.id === targetId);
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
        const xpPerUnit = Math.floor(xpYield / aliveOpponents.length);
        newState = addLog(newState, `  ✨ ${xpYield} XP split among ${aliveOpponents.length} allies (${xpPerUnit} each)`);

        for (const ally of aliveOpponents) {
            newState = addExperience(newState, ally.id, xpPerUnit);
        }
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

    // 4.5 Check Defeat (from immediate damage if any)
    const currentTarget = newState.playerParty.find(e => e.id === targetId) || newState.enemyParty.find(e => e.id === targetId);
    if (currentTarget && currentTarget.currentHp <= 0) {
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

    return newState;
}


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

function handleRemoveStatus(state: IBattleState, payload: { targetId: string; status: string }): IBattleState {
    const { targetId, status } = payload;

    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== targetId) return e;
            return {
                ...e,
                statusEffects: e.statusEffects.filter(s => s.type !== status)
            };
        });

    let newState: IBattleState = {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    };

    newState = addLog(newState, `  ✨ ${status} removed from target`);
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
