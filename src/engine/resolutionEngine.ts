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
                newState = effectHandlers['ATTACK'](newState, {
                    sourceId: 'SYSTEM',
                    targetId: mutation.targetId,
                    power: 0,
                    damageOverride: mutation.payload.isHeal ? -mutation.payload.amount : mutation.payload.amount,
                    element: mutation.payload.element || 'None'
                });
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

    // 1. Collect Hooks
    const entities = [initialContext.source, initialContext.target].filter((e): e is IBattleEntity => !!e);
    const hookIds = new Set<string>();
    entities.forEach(e => {
        if (e.hooks) e.hooks.forEach(h => hookIds.add(h));
        if (e.activeOS) {
            const os = getOSBehavior(e.activeOS);
            if (os) os.hooks.forEach(h => hookIds.add(h.id));
        }
    });

    const hooks: HookDefinition[] = Array.from(hookIds)
        .map(id => {
            const registered = getHook(id as string);
            if (registered) return registered;
            return undefined;
        })
        .filter((h): h is HookDefinition => !!h && !!h[phase]);

    // 2. Sort by Priority
    hooks.sort((a, b) => b.priority - a.priority);

    // 3. Execute Hooks
    for (const hook of hooks) {
        const handler = hook[phase] as any;
        if (!handler) continue;

        const result: HookResult = handler({ ...initialContext, state: currentState });

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
 * Helper to handle card draws with hook triggers.
 */
export function executeDraw(state: IBattleState, side: 'PLAYER' | 'ENEMY', count: number, isNatural: boolean): IBattleState {
    const deckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const { state: newDeck, nextSeed } = drawCards(state[deckKey], count, state.seed);

    let newState = { ...state, [deckKey]: newDeck, seed: nextSeed };

    const cardsDrawnCount = newDeck.hand.length - state[deckKey].hand.length;
    if (cardsDrawnCount > 0) {
        const partyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
        const owner = newState[partyKey].find(e => e.id.startsWith(side === 'PLAYER' ? 'p' : 'e'));

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
