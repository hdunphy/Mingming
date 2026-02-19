import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { globalBattleEventBus } from './events';
import { HookPriority, type MutationRequest, type HookContext, type HookDefinition, type HookResult, getHook } from './core/Hooks';
import { effectHandlers } from './effectHandlers';
import { getOSBehavior } from './data/firmwareRegistry';
import { drawCards } from './deckLogic';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

/**
 * Applies a list of mutations to the state in a single atomic update.
 */
export function applyMutations(state: IBattleState, mutations: MutationRequest[]): IBattleState {
    let newState = state;

    for (const mutation of mutations) {
        switch (mutation.type) {
            case 'HP':
                if (mutation.payload.isHeal) {
                    newState = effectHandlers['HEAL'](newState, {
                        sourceId: mutation.sourceId || 'SYSTEM',
                        targetId: mutation.targetId,
                        power: 0,
                        healOverride: mutation.payload.amount
                    });
                } else {
                    newState = effectHandlers['ATTACK'](newState, {
                        sourceId: 'SYSTEM',
                        targetId: mutation.targetId,
                        power: 0,
                        damageOverride: mutation.payload.amount,
                        element: mutation.payload.element || 'None'
                    });
                }
                break;
            case 'ENERGY':
                newState = {
                    ...newState,
                    playerParty: newState.playerParty.map(e =>
                        e.id === mutation.targetId ? {
                            ...e,
                            currentEnergy: Math.max(0, Math.min(e.maxEnergy, e.currentEnergy + mutation.payload.amount))
                        } : e
                    ),
                    enemyParty: newState.enemyParty.map(e =>
                        e.id === mutation.targetId ? {
                            ...e,
                            currentEnergy: Math.max(0, Math.min(e.maxEnergy, e.currentEnergy + mutation.payload.amount))
                        } : e
                    )
                };
                break;
            case 'STATUS':
                newState = effectHandlers['APPLY_STATUS'](newState, {
                    targetId: mutation.targetId,
                    status: mutation.payload.status,
                    stacks: mutation.payload.stacks,
                    sourceId: mutation.sourceId
                });

                // Trigger onStatusApplied hook
                {
                    const target = newState.playerParty.find(e => e.id === mutation.targetId) || newState.enemyParty.find(e => e.id === mutation.targetId);
                    const source = mutation.sourceId
                        ? (newState.playerParty.find(e => e.id === mutation.sourceId) || newState.enemyParty.find(e => e.id === mutation.sourceId))
                        : undefined;

                    const context: HookContext = {
                        source: source,
                        target: target,
                        state: newState,
                        triggerDepth: 0,
                        statusApplied: mutation.payload.status
                    };
                    const { state: afterHook } = executeResolutionStack(newState, 'onStatusApplied', context);
                    newState = afterHook;
                }
                break;
            case 'LOG':
                newState = addLog(newState, mutation.payload);
                break;
            case 'EVENT':
                globalBattleEventBus.emit(mutation.payload);
                break;
        }
    }

    return newState;
}

import { GetProgramData } from './data/programRegistry';

/**
 * Gathers and executes hooks for a specific lifecycle phase.
 */
export function executeResolutionStack(
    state: IBattleState,
    phase: keyof HookDefinition,
    initialContext: HookContext
): { state: IBattleState; isCancelled: boolean } {
    let currentState = state;
    let isCancelled = false;

    if (initialContext.triggerDepth > 5) {
        console.warn("CRITICAL_EVENT_OVERFLOW: Max trigger depth reached.");
        return { state: currentState, isCancelled: true };
    }

    // 1. Collect Hooks as Pairs (hook, owner)
    // We check all alive entities so that "side-wide" or "global" passives work.
    const entities = [...state.playerParty, ...state.enemyParty].filter(e => e.currentHp > 0);
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
            if (registered && registered[phase]) {
                hookPairs.push({ hook: registered, owner: e });
            }
        });
    });

    // 2. Sort by Priority
    hookPairs.sort((a, b) => b.hook.priority - a.hook.priority);

    // 3. Execute Hooks
    for (const pair of hookPairs) {
        const handler = pair.hook[phase] as any;
        if (!handler) continue;

        const result: HookResult = handler({ ...initialContext, state: currentState }, pair.owner);

        if (result.mutations.length > 0) {
            currentState = applyMutations(currentState, result.mutations);
        }

        if (result.isCancelled) {
            isCancelled = true;
            break;
        }
    }

    return { state: currentState, isCancelled };
}

/**
 * Specifically for status damage scaling (unaffected by isCancelled usually).
 */
export function executeStatusDamageCalculated(
    state: IBattleState,
    target: IBattleEntity,
    initialDamage: number,
    _statusType: string
): { state: IBattleState; damage: number } {
    let currentState = state;
    let damage = initialDamage;

    // Use full party search for global/side-wide hooks
    const entities = [...state.playerParty, ...state.enemyParty].filter(e => e.currentHp > 0);
    const hookPairs: { hook: HookDefinition, owner: IBattleEntity }[] = [];

    entities.forEach(e => {
        const entityHooks = new Set<string>();
        if (e.hooks) e.hooks.forEach(h => entityHooks.add(h));
        if (e.activeOS) {
            const os = getOSBehavior(e.activeOS);
            if (os) os.hooks.forEach(h => entityHooks.add(h.id));
        }
        if (e.daemons) {
            e.daemons.forEach(daemon => {
                const data = GetProgramData(daemon.dataId);
                if (data.hooks) data.hooks.forEach(h => entityHooks.add(h));
            });
        }

        entityHooks.forEach(id => {
            const registered = getHook(id);
            if (registered && registered.onStatusDamageCalculated) {
                hookPairs.push({ hook: registered, owner: e });
            }
        });
    });

    hookPairs.sort((a, b) => b.hook.priority - a.hook.priority);

    const context: HookContext = {
        target,
        state: currentState,
        triggerDepth: 0
    };

    for (const pair of hookPairs) {
        if (pair.hook.onStatusDamageCalculated) {
            damage = pair.hook.onStatusDamageCalculated(damage, context, pair.owner);
        }
    }

    return { state: currentState, damage: Math.floor(damage) };
}

/**
 * Helper to handle card draws with hook triggers.
 */
export function executeDraw(state: IBattleState, side: 'PLAYER' | 'ENEMY', count: number, isNatural: boolean, sourceId?: string): IBattleState {
    const deckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const { state: newDeck, nextSeed } = drawCards(state[deckKey], count, state.seed);

    let newState = { ...state, [deckKey]: newDeck, seed: nextSeed };

    const cardsDrawnCount = newDeck.hand.length - state[deckKey].hand.length;
    if (cardsDrawnCount > 0) {
        const partyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
        const owner = sourceId
            ? newState[partyKey].find(e => e.id === sourceId)
            : newState[partyKey][0]; // Replaced ID prefix check with a simple party membership check (first entity in party)

        const context: HookContext = {
            source: owner,
            state: newState,
            triggerDepth: 0,
            isNaturalDraw: isNatural
        };

        for (let i = 0; i < cardsDrawnCount; i++) {
            const { state: afterHook } = executeResolutionStack(newState, 'onCardDraw', context);
            newState = afterHook;
        }
    }

    return newState;
}
