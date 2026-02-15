import { GetProgramData } from './data/programRegistry';
import type { IBattleState, IBattleEntity, ProgramData, ProgramEntity } from './types';
import { StatusType } from './types';
import { calculateDamage, calculateHeal } from './combatUtils';
import { globalBattleEventBus } from './events';

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

    // Find entities
    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);

    let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!source || !target) return state;

    // Calculate Damage
    // Mock program data for the utils
    const mockProgram = { element: element } as ProgramData;

    const damage = calculateDamage(source, target, mockProgram, power);

    // Apply Damage
    const newCurrentHp = Math.max(0, target.currentHp - damage);

    // Emit Event
    globalBattleEventBus.emit({
        type: 'DAMAGE_TAKEN',
        targetId: target.id,
        amount: damage,
        element: element,
        timestamp: Date.now()
    });

    // Helper to update entity
    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => e.id === targetId ? { ...e, currentHp: newCurrentHp } : e);

    return {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    };
}

function handleHealEffect(state: IBattleState, payload: { sourceId: string; targetId: string; power: number }): IBattleState {
    const { sourceId, targetId, power } = payload;

    const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
    let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
    let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

    if (!source || !target) return state;

    const healAmount = calculateHeal(source, target, power);
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

    return {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    };
}

const DUALITY_MAP: Partial<Record<StatusType, StatusType>> = {
    'Sharp': 'Dazed',
    'Dazed': 'Sharp',
    'Strengthened': 'Weakened',
    'Weakened': 'Strengthened',
};

function handleApplyStatus(state: IBattleState, payload: { targetId: string; status: StatusType; stacks: number }): IBattleState {
    const { targetId, status, stacks } = payload;
    const oppositeStatus = DUALITY_MAP[status];

    // Update entity status list
    const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
        party.map(e => {
            if (e.id !== targetId) return e;

            let newStatusEffects = [...e.statusEffects];
            let remainingStacks = stacks;

            // 1. Check Duality (Opposite)
            if (oppositeStatus) {
                const oppositeIndex = newStatusEffects.findIndex(s => s.type === oppositeStatus);
                if (oppositeIndex !== -1) {
                    const opposite = newStatusEffects[oppositeIndex];

                    if (opposite.stacks > remainingStacks) {
                        // Reduce opposite, consume all new stacks
                        newStatusEffects[oppositeIndex] = { ...opposite, stacks: opposite.stacks - remainingStacks };
                        remainingStacks = 0;
                    } else if (opposite.stacks === remainingStacks) {
                        // Remove opposite, consume all new stacks
                        newStatusEffects.splice(oppositeIndex, 1);
                        remainingStacks = 0;
                    } else {
                        // Remove opposite, some new stacks remain
                        remainingStacks -= opposite.stacks;
                        newStatusEffects.splice(oppositeIndex, 1);
                    }
                }
            }

            // 2. Additive Stacks (Same) or New Instance
            if (remainingStacks > 0) {
                const existingIndex = newStatusEffects.findIndex(s => s.type === status);

                if (existingIndex !== -1) {
                    // Add to existing
                    const existing = newStatusEffects[existingIndex];
                    newStatusEffects[existingIndex] = { ...existing, stacks: existing.stacks + remainingStacks, duration: 3 };
                } else {
                    // Add new
                    newStatusEffects.push({
                        id: crypto.randomUUID(),
                        type: status,
                        duration: 3,
                        stacks: remainingStacks
                    });
                }
            }

            return {
                ...e,
                statusEffects: newStatusEffects
            };
        });

    globalBattleEventBus.emit({
        type: 'STATUS_APPLIED',
        targetId,
        status,
        stacks,
        timestamp: Date.now()
    });

    return {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    };
}

import { drawCards } from './deckLogic';

// ... imports ...

function handleDraw(state: IBattleState, payload: { targetId: string; count: number }): IBattleState {
    const { targetId, count } = payload;

    // 1. Determine which deck to interact with
    const isPlayer = state.playerParty.some(e => e.id === targetId);
    const deckKey = isPlayer ? 'playerDeck' : 'enemyDeck';

    // 2. Delegate to deckLogic
    const newDeckState = drawCards(state[deckKey], count);

    return {
        ...state,
        [deckKey]: newDeckState
    };
}
