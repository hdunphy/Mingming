import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { StatusType } from './types';
import { calculateDamage, calculateHeal } from './combatUtils';
import { globalBattleEventBus } from './events';

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

// --- Burn Logic & Post Turn Handler ---
export function resolvestatusEffects(state: IBattleState): IBattleState {
    // Determine active party for Post-Turn (The player whose turn just ended)
    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const activeParty = state[activePartyKey];

    const updatedParty = activeParty.map(entity => {
        let currentHp = entity.currentHp;
        let defense = entity.defense;

        const burnEffect = entity.statusEffects.find(s => s.type === 'Burn');
        if (burnEffect) {

            const burnConfig = DEFAULT_GAME_CONFIG.status.burnStacks;
            const stacks = burnEffect.stacks;

            const { damagePercent, defShredPercent } = burnConfig[stacks - 1] ?? burnConfig[burnConfig.length - 1];

            // Apply Burn Damage
            const burnDamage = Math.floor(entity.maxHp * damagePercent);
            if (burnDamage > 0) {
                currentHp = Math.max(0, currentHp - burnDamage);
                globalBattleEventBus.emit({
                    type: 'DAMAGE_TAKEN',
                    targetId: entity.id,
                    amount: burnDamage,
                    element: 'Fire',
                    timestamp: Date.now()
                });
            }

            // Apply Defense Shred
            if (defShredPercent > 0) {
                const shredAmount = Math.floor(entity.defense * defShredPercent);
                // Defense reduction is permanent "Shred" in this implementation
                defense = Math.max(0, defense - shredAmount);

                globalBattleEventBus.emit({
                    type: 'STATUS_APPLIED', // Using STATUS_APPLIED as a generic "stat change" indicator if no specific event
                    targetId: entity.id,
                    status: 'Weakened', // Mocking a stat change event or could add a STAT_CHANGE event
                    stacks: shredAmount,
                    timestamp: Date.now()
                });
            }
        }

        return { ...entity, currentHp, defense };
    });

    return {
        ...state,
        [activePartyKey]: updatedParty
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

    let newState: IBattleState = {
        ...state,
        playerParty: updateParty(state.playerParty),
        enemyParty: updateParty(state.enemyParty)
    } as IBattleState;

    const targetEntity = state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId);
    const targetName = targetEntity?.name || targetId;
    newState = addLog(newState, `  → ${targetName} gains ${status} (${stacks} stacks)`);

    return newState;
}

import { drawCards } from './deckLogic';
import { DEFAULT_GAME_CONFIG } from './data/gameConfig';

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
