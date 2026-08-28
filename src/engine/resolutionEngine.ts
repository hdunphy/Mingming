import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { numericBaseCost } from './types';
import { globalBattleEventBus } from './events';
import { type MutationRequest, type HookContext, type HookDefinition, type HookResult, getHook } from './core/Hooks';
import { effectHandlers } from './effectHandlers';
import { getOSBehavior } from './data/firmwareRegistry';
import { drawCards, discardCard, exhaustCard, returnCard, searchCard, HAND_SIZE_LIMIT } from './deckLogic';
import { PRNG } from './core/PRNG';
import { GetProgramData } from './data/programRegistry';

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
                        flatHeal: mutation.payload.amount,
                        // Ticket 56: a CARD heal arrives here already resolved to HP, so its
                        // printed power would otherwise be lost. `HealExecutor` attaches it; an
                        // engine heal (firmware percentMaxHP, Regen) has none and leaves it
                        // undefined, which is what keeps NOURISH_ROUTINE reading "every heal she
                        // CASTS" rather than every heal she receives.
                        healPower: mutation.payload.healPower
                    });
                } else {
                    const target = newState.playerParty.find(e => e.id === mutation.targetId) || newState.enemyParty.find(e => e.id === mutation.targetId);
                    let amount = mutation.payload.amount;

                    if (target && target.currentHp - amount <= 0 && newState.activeRelics.includes('buffer_cache')) {
                        // Check if it's a player unit (optional? description says "a Mingming")
                        const isPlayerUnit = newState.playerParty.some(e => e.id === target.id);
                        if (isPlayerUnit) {
                            amount = target.currentHp - 1;
                            newState = addLog(newState, `🛡️ [BUFFER CACHE] ${target.name} stayed at 1 HP!`);

                            // To make it once per battle, we could remove it from activeRelics, 
                            // but the description says "The first time a Mingming would be knocked out".
                            // If we have 3 Mingmings, does it apply to each? 
                            // "The first time A Mingming" usually means the first one to hit 0.
                            // Let's remove it from activeRelics to make it truly once-per-battle.
                            newState = {
                                ...newState,
                                activeRelics: newState.activeRelics.filter(r => r !== 'buffer_cache')
                            };
                        }
                    }

                    newState = effectHandlers['ATTACK'](newState, {
                        sourceId: 'SYSTEM',
                        targetId: mutation.targetId,
                        power: 0,
                        damageOverride: amount,
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
                            currentEnergy: Math.max(0, e.currentEnergy + mutation.payload.amount)
                        } : e
                    ),
                    enemyParty: newState.enemyParty.map(e =>
                        e.id === mutation.targetId ? {
                            ...e,
                            currentEnergy: Math.max(0, e.currentEnergy + mutation.payload.amount)
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

                break;
            case 'LOG':
                newState = addLog(newState, mutation.payload);
                break;
            case 'EVENT':
                globalBattleEventBus.emit(mutation.payload);
                break;
            case 'GENERATE_CARD':
                newState = effectHandlers['GENERATE_CARD'](newState, {
                    sourceId: mutation.sourceId || 'SYSTEM',
                    dataId: mutation.payload.dataId
                });
                break;
            case 'CLEANSE':
                newState = effectHandlers['CLEANSE'](newState, {
                    targetId: mutation.targetId,
                    statusTarget: mutation.payload.statusTarget
                });
                break;
            case 'DISCARD': {
                const isPlayerTarget = newState.playerParty.some(e => e.id === mutation.targetId);
                const deckKey = isPlayerTarget ? 'playerDeck' : 'enemyDeck';
                let deck = newState[deckKey];
                const amount = mutation.payload.amount;
                const isRandom = mutation.payload.isRandom;

                const isCostPriority = mutation.payload.isCostPriority;

                let toDiscard = [...deck.hand];
                if (isRandom) {
                    const prng = new PRNG(newState.seed);
                    const { shuffled, nextSeed } = prng.shuffle(toDiscard);
                    toDiscard = shuffled.slice(0, amount);
                    newState = { ...newState, seed: nextSeed };
                } else if (isCostPriority) {
                    // Paying a DISCARD cost is a DECISION, not a coin flip: shed the cards
                    // whose loss helps most or hurts least. Cards with a discardEffect go
                    // first (discarding them is upside - Feather Cache draws, War Molt
                    // buffs), then the cheapest card, then hand order. No RNG at all, so a
                    // replayed battle sheds exactly the same cards.
                    const ranked = deck.hand.map((entity, index) => {
                        const data = GetProgramData(entity.dataId);
                        const hasDiscardEffect = !!(data.discardEffect && data.discardEffect.length > 0);
                        const cost = typeof data.baseCost === 'number' ? data.baseCost : 99;
                        return { entity, hasDiscardEffect, cost, index };
                    });
                    ranked.sort((a, b) =>
                        (Number(b.hasDiscardEffect) - Number(a.hasDiscardEffect))
                        || (a.cost - b.cost)
                        || (a.index - b.index));
                    toDiscard = ranked.slice(0, amount).map(r => r.entity);
                } else {
                    toDiscard = toDiscard.slice(0, amount); // Top N cards
                }

                // CARDS_DISCARDED scaling (Carrion Swoop) counts every card that
                // actually leaves the hand, however it left - cost, Tempest, or an
                // enemy FORCE_DISCARD.
                const shedSide = isPlayerTarget ? 'PLAYER' : 'ENEMY';
                newState = {
                    ...newState,
                    cardsDiscardedThisTurn: (newState.cardsDiscardedThisTurn ?? 0) + toDiscard.length,
                    discardedByEffect: [
                        ...(newState.discardedByEffect ?? []),
                        ...toDiscard.map(c => `${shedSide}:${c.id}`)
                    ]
                };

                toDiscard.forEach(c => {
                    // Update the state with the discarded card first to avoid stale state during hooks
                    let currentDeck = newState[deckKey];
                    currentDeck = discardCard(currentDeck, c.id);
                    newState = { ...newState, [deckKey]: currentDeck };

                    const discardedData = GetProgramData(c.dataId);
                    const owner = isPlayerTarget
                        ? newState.playerParty.find(e => e.id === mutation.targetId)
                        : newState.enemyParty.find(e => e.id === mutation.targetId);

                    if (owner) {
                        const context: HookContext = {
                            source: owner,
                            program: discardedData,
                            state: newState,
                            triggerDepth: 0
                        };

                        // 1. Fire global/daemon onDiscarded listeners
                        const { state: afterGlobalHooks } = executeResolutionStack('onDiscarded', context);
                        newState = afterGlobalHooks;
                        context.state = newState;

                        // 2. Fire the card's own explicit hooks (e.g. "Fragmented Code")
                        if (discardedData.hooks) {
                            discardedData.hooks.forEach(hookId => {
                                const registered = getHook(hookId);
                                if (registered && registered.onDiscarded) {
                                    const result = registered.onDiscarded(context, owner);
                                    newState = result.state;
                                    context.state = newState;
                                }
                            });
                        }
                    }
                });
                break;
            }
            case 'EXHAUST': {
                const isPlayerTarget = newState.playerParty.some(e => e.id === mutation.targetId);
                const deckKey = isPlayerTarget ? 'playerDeck' : 'enemyDeck';
                let deck = newState[deckKey];

                let toExhaust = deck.hand.slice(0, mutation.payload.amount);
                toExhaust.forEach(c => {
                    deck = exhaustCard(deck, c.id, 'HAND');
                });
                newState = { ...newState, [deckKey]: deck };
                break;
            }
            case 'RETURN': {
                const isPlayerTarget = newState.playerParty.some(e => e.id === mutation.targetId);
                const deckKey = isPlayerTarget ? 'playerDeck' : 'enemyDeck';
                let deck = newState[deckKey];

                let sourcePileStr = mutation.payload.sourcePile || 'DISCARD';
                let sourcePile = sourcePileStr === 'EXHAUST' ? deck.exhaust : deck.discard;
                // Ticket 32: optional cost predicate, then clamp to the space actually left in
                // hand - RETURN previously ignored HAND_SIZE_LIMIT and silently dropped the
                // overflow, which makes a "return everything" card unpredictable.
                const maxCost = mutation.payload.filter?.maxCost;
                const eligible = maxCost === undefined
                    ? sourcePile
                    : sourcePile.filter(c => numericBaseCost(GetProgramData(c.dataId).baseCost) <= maxCost);
                const headroom = Math.max(0, HAND_SIZE_LIMIT - deck.hand.length);
                const requested = mutation.payload.amount ?? eligible.length;
                let toReturn = eligible.slice(0, Math.min(requested, headroom));

                toReturn.forEach(c => {
                    deck = returnCard(deck, c.id, sourcePileStr as any, mutation.payload.destinationPile || 'HAND');
                });
                newState = { ...newState, [deckKey]: deck };
                break;
            }
            case 'MAX_ENERGY': {
                const isPlayerTarget = newState.playerParty.some((e: IBattleEntity) => e.id === mutation.targetId);
                const partyKey = isPlayerTarget ? 'playerParty' : 'enemyParty';
                const party = newState[partyKey];
                const entityIndex = party.findIndex((e: IBattleEntity) => e.id === mutation.targetId);
                if (entityIndex > -1) {
                    const e = party[entityIndex];
                    const amount = mutation.payload.amount || 1;
                    const newParty = [...party];
                    newParty[entityIndex] = { ...e, maxEnergy: e.maxEnergy + amount, currentEnergy: e.currentEnergy + amount };
                    newState = { ...newState, [partyKey]: newParty };
                }
                break;
            }
            case 'SEARCH': {
                const isPlayerTarget = newState.playerParty.some(e => e.id === mutation.targetId);
                const deckKey = isPlayerTarget ? 'playerDeck' : 'enemyDeck';
                let deck = newState[deckKey];
                deck = searchCard(deck, mutation.payload.amount, mutation.payload.criteria, true);
                newState = { ...newState, [deckKey]: deck };
                break;
            }
            case 'DRAW': {
                const isPlayerTarget = newState.playerParty.some((e: IBattleEntity) => e.id === mutation.targetId);
                const side = isPlayerTarget ? 'PLAYER' : 'ENEMY';
                newState = executeDraw(newState, side, mutation.payload.amount || 1, false, mutation.targetId);
                break;
            }
            case 'COUNTER': {
                const counterKey = mutation.payload.key;
                if (!counterKey) break;

                const op = mutation.payload.operator || 'ADD';
                const val = mutation.payload.amount || 1;

                const currentCounters = newState.counters || {};
                let currentVal = currentCounters[counterKey] || 0;

                if (op === 'ADD') {
                    currentVal += val;
                } else if (op === 'SET') {
                    currentVal = val;
                } else if (op === 'RESET') {
                    currentVal = 0;
                }

                newState = {
                    ...newState,
                    counters: {
                        ...currentCounters,
                        [counterKey]: currentVal
                    }
                };
                break;
            }
        }
    }

    return newState;
}

/**
 * Gathers and executes hooks for a specific lifecycle phase.
 */
// Module-level re-entrancy counter. Contexts are frequently rebuilt with
// triggerDepth: 0 mid-cascade, which made the context-based check ineffective —
// this counter tracks ACTUAL synchronous nesting regardless of context plumbing,
// so a hook cycle (A triggers B triggers A...) terminates instead of hanging.
let resolutionStackDepth = 0;
const MAX_RESOLUTION_DEPTH = 12;

export function executeResolutionStack(
    phase: keyof HookDefinition,
    initialContext: HookContext
): { state: IBattleState; isCancelled: boolean } {
    let currentState = initialContext.state;
    let isCancelled = false;

    if (initialContext.triggerDepth > 5 || resolutionStackDepth >= MAX_RESOLUTION_DEPTH) {
        console.warn(`CRITICAL_EVENT_OVERFLOW: Max trigger depth reached (phase: ${phase}).`);
        return { state: initialContext.state, isCancelled: true };
    }
    resolutionStackDepth++;
    try {
        return executeResolutionStackInner(phase, initialContext, currentState, isCancelled);
    } finally {
        resolutionStackDepth--;
    }
}

/**
 * General-purpose HP threshold event (ticket 12). A unit "crosses" when a single
 * HP-loss application takes it from >=threshold to <threshold of maxHp. Only
 * downward crossings fire; healing back above the line re-arms the unit by
 * construction (the next drop is a fresh crossing). Detection lives at the three
 * HP-loss sites (handleAttack — which also serves intents, hook damage and HP
 * mutations —, status-apply overflow damage, and end-of-turn DoT ticks).
 */
export const HP_CROSSING_THRESHOLD = 0.5;

export function crossedDownHalf(prevHp: number, newHp: number, maxHp: number): boolean {
    if (maxHp <= 0) return false;
    return prevHp / maxHp >= HP_CROSSING_THRESHOLD && newHp / maxHp < HP_CROSSING_THRESHOLD;
}

/** Fire the onHpThresholdCrossed stack for a unit that just crossed downward. */
export function fireHpThresholdCrossed(state: IBattleState, unitId: string): IBattleState {
    const unit = state.playerParty.find(e => e.id === unitId) || state.enemyParty.find(e => e.id === unitId);
    if (!unit) return state;
    const { state: afterHooks } = executeResolutionStack('onHpThresholdCrossed', {
        source: unit,
        target: unit,
        state,
        triggerDepth: 0
    });
    return afterHooks;
}

function executeResolutionStackInner(
    phase: keyof HookDefinition,
    initialContext: HookContext,
    currentState: IBattleState,
    isCancelled: boolean
): { state: IBattleState; isCancelled: boolean } {

    // 1. Collect Hooks as Pairs (hook, owner)
    // We check all alive entities so that "side-wide" or "global" passives work.
    const entities = [...currentState.playerParty, ...currentState.enemyParty].filter(e => e.currentHp > 0);
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
        currentState = result.state;

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
    const entities = [...currentState.playerParty, ...currentState.enemyParty].filter(e => e.currentHp > 0);
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
 * Specifically for resolving programmatic energy cost scaling.
 */
export function executeCostCalculated(
    state: IBattleState,
    source: IBattleEntity,
    target: IBattleEntity | undefined,
    program: ProgramData,
    initialCost: number
): { state: IBattleState; cost: number } {
    let currentState = state;
    let cost = initialCost;

    // Use full party search for global/side-wide hooks
    const entities = [...currentState.playerParty, ...currentState.enemyParty].filter(e => e.currentHp > 0);
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
            if (registered && registered.onCostCalculated) {
                hookPairs.push({ hook: registered, owner: e });
            }
        });
    });

    hookPairs.sort((a, b) => b.hook.priority - a.hook.priority);

    const context: HookContext = {
        source,
        target,
        program,
        state: currentState,
        triggerDepth: 0
    };

    for (const pair of hookPairs) {
        if (pair.hook.onCostCalculated) {
            cost = pair.hook.onCostCalculated(cost, context, pair.owner);
        }
    }

    return { state: currentState, cost: Math.max(0, parseFloat((cost).toPrecision(4))) }; // keep to 4 precision just in case but we'll probably just floor
}

/**
 * Helper to handle card draws with hook triggers.
 */
export function executeDraw(state: IBattleState, side: 'PLAYER' | 'ENEMY', count: number, isNatural: boolean, sourceId?: string): IBattleState {
    const deckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const { state: newDeck, nextSeed, shuffled } = drawCards(
        state[deckKey], count, state.seed, state.resolvingCardInstanceId);
    const cardsDrawnCount = newDeck.hand.length - state[deckKey].hand.length;
    let newState: IBattleState = {
        ...state,
        [deckKey]: newDeck,
        seed: nextSeed,
        cardsDrawnThisTurn: state.cardsDrawnThisTurn + cardsDrawnCount,
        // Ticket 68: the TRIGGERED counter - draws an effect caused, not the draw-phase refill.
        // `isNatural` was already threaded through here for hook dispatch and was simply never
        // consulted for a counter; this is that flag finally doing the second job it implies.
        nonNaturalCardsDrawnThisTurn: (state.nonNaturalCardsDrawnThisTurn ?? 0)
            + (isNatural ? 0 : cardsDrawnCount)
    };

    if (shuffled) {
        newState = {
            ...newState,
            counters: { ...newState.counters, ['deck_shuffles']: (newState.counters['deck_shuffles'] || 0) + 1 }
        };

        // Ticket 53: `onDeckShuffled` existed as a hook TYPE since ticket 07 and nothing ever
        // dispatched it, which is why ticket 07 could pin "no onDeckShuffled in hooks.json" as an
        // invariant. valkyrie_v2's REBIRTH_CYCLE_OS is its first consumer, so it is wired here -
        // the one place that knows both that a reshuffle happened AND the battle state.
        //
        // The loop question was reviewed before wiring it: a reshuffle can only happen inside a
        // draw, the hook does not draw, and nothing in the registry generates cards into a
        // drawpile, so this cannot re-enter itself.
        const shuffler = (side === 'PLAYER' ? newState.playerParty : newState.enemyParty)[0];
        if (shuffler) {
            const { state: afterShuffleHooks } = executeResolutionStack('onDeckShuffled', {
                source: shuffler,
                target: shuffler,
                state: newState,
                triggerDepth: 0,
            } as never);
            newState = afterShuffleHooks;
        }
    }

    if (cardsDrawnCount > 0) {
        const partyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';

        for (let i = 0; i < cardsDrawnCount; i++) {
            // Rebuild the context each iteration: reusing a stale context would
            // make every onCardDraw resolution start from the pre-loop snapshot,
            // discarding the effects of earlier iterations (e.g. Kraken applying
            // 1 Dazed instead of N on a multi-card draw).
            const currentOwner = sourceId
                ? newState[partyKey].find(e => e.id === sourceId)
                : newState[partyKey][0];
            const context: HookContext = {
                source: currentOwner,
                state: newState,
                triggerDepth: 0,
                isNaturalDraw: isNatural
            };
            const { state: afterHook } = executeResolutionStack('onCardDraw', context);
            newState = afterHook;
        }
    }

    return newState;
}
