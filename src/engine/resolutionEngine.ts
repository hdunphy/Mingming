import type { IBattleState, IBattleEntity, ProgramData } from './types';
import { numericBaseCost } from './types';
import { globalBattleEventBus } from './events';
import { type MutationRequest, type HookContext, type HookDefinition, type HookResult, type EventHook, getHook } from './core/Hooks';
import { entityHooksFor } from './core/entityHooks';
// TICKET 163c: re-exported so the test seam keeps its old import path while the rule moved.
export { clearEntityHookCache } from './core/entityHooks';
import { effectHandlers } from './effectHandlers';
import { getOSBehavior } from './data/firmwareRegistry';
import { drawCards, discardCard, exhaustCard, returnCard, searchCard, HAND_SIZE_LIMIT } from './deckLogic';
import { PRNG } from './core/PRNG';
import { GetProgramData } from './data/programRegistry';
import { isSimulating } from './core/simulationDepth';

function addLog(state: IBattleState, message: string): IBattleState {
    // Ticket 144c: a simulated play narrates nothing. See `core/simulationDepth.ts`.
    if (isSimulating()) return state;
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
                    // TICKET 16: `buffer_cache`'s death-prevent branch sat here, reading the relic
                    // id off `activeRelics`. The relics are deleted; a Driver that wants this shape
                    // is a hook (`onHpThresholdCrossed` is how SHIELDWALL does it).
                    newState = effectHandlers['ATTACK'](newState, {
                        // Ticket 186e: the mutation's own source, like the heal above. `SYSTEM` only when
                        // nobody is named, so the ledger says who dealt the damage. (With a
                        // `damageOverride` the handler never reads the source, so nothing else changes.)
                        sourceId: mutation.sourceId || 'SYSTEM',
                        targetId: mutation.targetId,
                        power: 0,
                        // Ticket 16 removed the `buffer_cache` branch that used to bind `amount` as
                        // a local above this block, so the payload is read directly — the same
                        // value, one indirection fewer.
                        damageOverride: mutation.payload.amount,
                        element: mutation.payload.element || 'None',
                        // Ticket 146b. Every engine price in the game comes through here as an HP
                        // mutation, and from inside `handleAttack` they are indistinguishable from
                        // a sword. The caller says which it is; undefined means `attack`.
                        cause: mutation.payload.cause
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
                    sourceId: mutation.sourceId,
                    // Ticket 146b: passed straight through. The mutation's builder is the only
                    // one that knows whether a card or an OS raised it.
                    source: mutation.payload.source
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
                const deck = newState[deckKey];
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

                const toExhaust = deck.hand.slice(0, mutation.payload.amount);
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

                const sourcePileStr: 'DISCARD' | 'EXHAUST' = mutation.payload.sourcePile || 'DISCARD';
                const sourcePile = sourcePileStr === 'EXHAUST' ? deck.exhaust : deck.discard;
                // Ticket 32: optional cost predicate, then clamp to the space actually left in
                // hand - RETURN previously ignored HAND_SIZE_LIMIT and silently dropped the
                // overflow, which makes a "return everything" card unpredictable.
                const maxCost = mutation.payload.filter?.maxCost;
                const eligible = maxCost === undefined
                    ? sourcePile
                    : sourcePile.filter(c => numericBaseCost(GetProgramData(c.dataId).baseCost) <= maxCost);
                const headroom = Math.max(0, HAND_SIZE_LIMIT - deck.hand.length);
                const requested = mutation.payload.amount ?? eligible.length;
                const toReturn = eligible.slice(0, Math.min(requested, headroom));

                toReturn.forEach(c => {
                    deck = returnCard(deck, c.id, sourcePileStr, mutation.payload.destinationPile || 'HAND');
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
    const currentState = initialContext.state;
    const isCancelled = false;

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



/** The (hook, owner) pairs for one phase, in the order the three call sites always built them. */
function collectHookPairs(
    state: IBattleState,
    phase: string,
): { hook: HookDefinition, owner: IBattleEntity }[] {
    const pairs: { hook: HookDefinition, owner: IBattleEntity }[] = [];
    for (const e of state.playerParty) {
        if (e.currentHp <= 0) continue;
        for (const hook of entityHooksFor(e, phase)) pairs.push({ hook, owner: e });
    }
    for (const e of state.enemyParty) {
        if (e.currentHp <= 0) continue;
        for (const hook of entityHooksFor(e, phase)) pairs.push({ hook, owner: e });
    }
    pairs.sort((a, b) => b.hook.priority - a.hook.priority);
    return pairs;
}

function executeResolutionStackInner(
    phase: keyof HookDefinition,
    initialContext: HookContext,
    currentState: IBattleState,
    isCancelled: boolean
): { state: IBattleState; isCancelled: boolean } {

    // 1. Collect Hooks as Pairs (hook, owner), already priority-sorted.
    // We check all alive entities so that "side-wide" or "global" passives work.
    const hookPairs = collectHookPairs(currentState, phase as string);

    // 3. Execute Hooks
    for (const pair of hookPairs) {
        // `phase` is a plain keyof, so the indexed type is the union of every HookDefinition
        // member; this branch only ever runs for the EventHook-shaped triggers.
        const handler = pair.hook[phase] as EventHook | undefined;
        if (!handler) continue;

        const before = currentState;
        const result: HookResult = handler({ ...initialContext, state: currentState }, pair.owner);
        currentState = result.state;

        emitHookFired(pair.hook.id, pair.owner, phase as string, before !== currentState || !!result.isCancelled);

        if (result.isCancelled) {
            isCancelled = true;
            break;
        }
    }

    return { state: currentState, isCancelled };
}

/**
 * HOOK_FIRED — ticket 146b, and the whole basis of 146g's *"unique VFX for each effect to help with
 * the trigger"*.
 *
 * # "FIRED" MEANS IT DID SOMETHING
 *
 * Every hook carrying a phase is CONSULTED on that phase, and most of them decline — a conditional
 * hook whose condition is false returns the state it was handed. Emitting on consultation would put
 * a tell on screen every time an OS looked at the board and did nothing, which is worse than no
 * tell at all: it teaches the player that the icon means nothing.
 *
 * The predicate is reference inequality on the state. Every mutation path in this engine is
 * immutable, so a hook that changed anything returns a different object, and one that returns the
 * same object changed nothing. A cancellation counts too — refusing to let something happen is the
 * most consequential thing a hook can do and it may leave the state untouched.
 *
 * # OUTSIDE AI LOOKAHEAD ONLY
 *
 * `TacticalAI` drives this same reducer to score candidate plays: ticket 127 measured 93,889
 * reducer calls for a single 3v3 decision. Unguarded, the stage would strobe with tells for fights
 * that never happened, and the bus would carry tens of thousands of events a turn. `isSimulating()`
 * is ticket 144c's predicate, added for exactly this class of problem.
 *
 * The `isLive` check is the second guard and not a redundant one: the AI mutes the bus for its
 * search, so cheap-exiting on a muted bus keeps the id resolution below off the hot path entirely.
 */
function emitHookFired(hookId: string, owner: IBattleEntity, trigger: string, didSomething: boolean): void {
    if (!didSomething) return;
    if (isSimulating() || !globalBattleEventBus.isLive) return;

    /*
     * WHICH OS or daemon owns this hook. The event carries the hook id regardless, but 146g keys
     * its authored signatures off the OS, so an unattributed hook would fall back to the family
     * default and the twelve authored tells would never play.
     */
    let osId: string | undefined;
    let daemonId: string | undefined;

    const os = owner.activeOS ? getOSBehavior(owner.activeOS) : undefined;
    if (os?.hooks.some(h => h.id === hookId)) osId = owner.activeOS;

    if (!osId) {
        for (const daemon of owner.daemons ?? []) {
            const data = GetProgramData(daemon.dataId);
            if (data.hooks?.includes(hookId)) { daemonId = daemon.dataId; break; }
        }
    }

    globalBattleEventBus.emit({
        type: 'HOOK_FIRED', osId, daemonId, hookId, ownerId: owner.id, trigger, timestamp: Date.now(),
    });
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
    const currentState = state;
    let damage = initialDamage;

    // Use full party search for global/side-wide hooks. Ticket 144b: memoised, same order.
    const hookPairs = collectHookPairs(currentState, 'onStatusDamageCalculated');

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
    const currentState = state;
    let cost = initialCost;

    // Use full party search for global/side-wide hooks. Ticket 144b: memoised, same order.
    const hookPairs = collectHookPairs(currentState, 'onCostCalculated');

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
    const partyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const triggeredCount = isNatural ? 0 : cardsDrawnCount;

    let newState: IBattleState = {
        ...state,
        [deckKey]: newDeck,
        seed: nextSeed,
        cardsDrawnThisTurn: state.cardsDrawnThisTurn + cardsDrawnCount,
        // Ticket 68: the TRIGGERED counter - draws an effect caused, not the draw-phase refill.
        // `isNatural` was already threaded through here for hook dispatch and was simply never
        // consulted for a counter; this is that flag finally doing the second job it implies.
        nonNaturalCardsDrawnThisTurn: (state.nonNaturalCardsDrawnThisTurn ?? 0) + triggeredCount,
        /*
         * THE PER-UNIT TWIN — Henry, 2026-08-30. `CARDS_DRAWN_TRIGGERED` reads THIS, not the
         * side-wide number above. See `ActionExecutors.getScalingValue` for the ruling.
         *
         * The drawer is identified exactly as the `onCardDraw` dispatch further down identifies it
         * — `sourceId` when one was threaded, otherwise slot 0 — so the counter and the hook can
         * never disagree about who "you" is. The side-wide number stays because `CARDS_DRAWN` still
         * reads it and because a caster-less call site has nothing else to fall back to.
         */
        [partyKey]: triggeredCount === 0 ? state[partyKey] : state[partyKey].map((entity, slot) => {
            const isDrawer = sourceId === undefined ? slot === 0 : entity.id === sourceId;
            return isDrawer
                ? { ...entity, nonNaturalDrawsThisTurn: (entity.nonNaturalDrawsThisTurn ?? 0) + triggeredCount }
                : entity;
        }),
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
        //
        // Ticket 164d: The deck is shared, so a reshuffle happens to the whole side.
        // Dispatch onDeckShuffled once per LIVING member of the shuffling side, each as
        // its own source and target.
        const partyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
        const members = newState[partyKey];
        for (const member of members) {
            if (member.currentHp <= 0) continue;
            const liveMember = newState[partyKey].find(e => e.id === member.id);
            if (!liveMember || liveMember.currentHp <= 0) continue;
            const { state: afterShuffleHooks } = executeResolutionStack('onDeckShuffled', {
                source: liveMember,
                target: liveMember,
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
