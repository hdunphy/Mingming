import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { StatusType } from './types';
import { calculateDamage, calculateHeal } from './combatUtils';
import { globalBattleEventBus } from './events';
import { getStatusBehavior } from './StatusBehaviors';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

const HAND_SIZE_LIMIT = 9;

type EffectHandler = (state: IBattleState, payload: any) => IBattleState;

export const effectHandlers: Record<string, EffectHandler> = {
    'ATTACK': handleAttack,
    'HEAL': handleHealEffect,
    'APPLY_STATUS': handleApplyStatus,
    'DRAW': handleDraw
};

// ... (other handlers remain the same, I will target the imports and handleDraw specifically) ...


function handleAttack(state: IBattleState, payload: { sourceId: string; targetId: string; power: number; element: any }): IBattleState {
    const { sourceId, targetId, power, element } = payload;


    // Find entities (Helper to avoid duplication? Maybe move to utils someday)
    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);

    let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!source || !target) return state;

    // Calculate Damage (Passing state for Hooks)
    const mockProgram = { element: element } as ProgramData;
    const damage = calculateDamage(source, target, mockProgram, power, state); // <--- Updated

    // Apply Damage
    const newCurrentHp = Math.max(0, target.currentHp - damage);

    // Wake up if Asleep and taken damage
    let wakesUp = false;
    if (damage > 0) {
        // ... (Asleep logic similar to before)
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

function handleDraw(state: IBattleState, payload: { targetId: string; count: number }): IBattleState {
    const { targetId, count } = payload;

    // 1. Determine which deck to interact with
    const isPlayer = state.playerParty.some(e => e.id === targetId);
    const deckKey = isPlayer ? 'playerDeck' : 'enemyDeck';

    // 2. Delegate to deckLogic (with Seed)
    const { state: newDeckState, nextSeed } = drawCards(state[deckKey], count, state.seed);

    return {
        ...state,
        seed: nextSeed,
        [deckKey]: newDeckState
    };
}
