// `Element` is in this list for a reason worth keeping: without it, `HookAction.element` below
// resolved to the DOM's global `Element` interface, because `lib: ["DOM"]` is on and the game's
// union was never imported here. Found by ticket 55 — the `(action as any).element` reaches in
// `HookFactory` were papering over it.
import type { Element, IBattleState, IBattleEntity, ProgramData, StatusType, ActionType, ProgramCategory } from '../types';

/**
 * Counter scoping: 'OWNER' (the default for hook counters) namespaces the key
 * per hook-owning entity (`key:ownerId`) so two units running the same OS keep
 * independent counts. 'GLOBAL' uses the raw key for genuinely battle-wide
 * counters (e.g. deck_shuffles, last_overheal).
 */
export type CounterScope = 'GLOBAL' | 'OWNER';

export function resolveCounterKey(key: string, scope: CounterScope | undefined, owner: IBattleEntity): string {
    return scope === 'GLOBAL' ? key : `${key}:${owner.id}`;
}

export enum HookPriority {
    SYSTEM = 100,
    GLOBAL = 75,
    ATTACKER = 50,
    PROGRAM = 40,
    DEFENDER = 25,
    LOGGING = 0
}

export type MutationRequest = {
    type: 'HP' | 'ENERGY' | 'MAX_ENERGY' | 'STATUS' | 'LOG' | 'EVENT' | 'GENERATE_CARD' | 'CLEANSE' | 'DISCARD' | 'EXHAUST' | 'RETURN' | 'SEARCH' | 'COUNTER' | 'DRAW';
    targetId: string;
    sourceId?: string; // Optional source of the mutation
    /*
     * The second and last `any` ticket 55 left, for `ProgramAction`'s reason at one remove.
     *
     * A mutation's payload shape is decided by its `type`, and the fourteen types carry genuinely
     * different ones — `{ amount, isHeal, element }` for HP, `{ key, operator, amount }` for
     * COUNTER, a whole event object for EVENT. The right type is a discriminated union keyed on
     * `type`, which is a day's work across `applyMutations`, `HookFactory` and every hook that
     * builds one, and it is only worth doing at the same time as `ProgramAction`'s.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
};

export type HookResult = {
    state: IBattleState;
    isCancelled?: boolean;
};

export type HookContext = {
    source?: IBattleEntity;
    target?: IBattleEntity;
    program?: ProgramData;
    state: IBattleState;
    triggerDepth: number;
    isNaturalDraw?: boolean; // For Kraken's OS
    statusApplied?: StatusType; // For Fenrir's OS
};

export type HookCondition = {
    /** 'ANY' = explicit always-match on this axis (ConditionValidator handles it by name). */
    source?: 'SELF' | 'ALLY' | 'OPPONENT' | 'ANY';
    target?: 'SELF' | 'ALLY' | 'OPPONENT' | 'ANY';
    actionType?: ActionType;
    programElement?: string;
    baseCost?: number | { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number };
    statusApplied?: StatusType;
    statusAppliedIn?: StatusType[]; // Passes when the applied status is any of these
    /**
     * TICKET 107: passes when the applied status is NOT any of these - the guard for a hook that
     * REACTS to a status application by APPLYING a status, which would otherwise re-trigger itself.
     * draugr_v2's Poison rider is the first: "statuses draugr applies to an enemy also apply
     * 1 Poison" would apply Poison, see its own Poison, and apply more.
     *
     * An allow-list (`statusAppliedIn`) can express the same guard today and was the cheaper
     * change, but it misstates the rule - the rider is "any status except my own" - and it rots
     * silently the moment a new card applies a status nobody remembered to add to the list.
     */
    statusAppliedNotIn?: StatusType[];
    programCategoryIn?: string[]; // Passes when a program is in context and its category matches one of these
    programCategoryNot?: string[]; // Passes when a program is in context and its category matches NONE of these
    programAppliesStatus?: boolean; // Passes when the program in context does (true) / does not (false) contain a STATUS action
    sourceDebuffCount?: { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number }; // Number of negative statuses on context.source
    isNaturalDraw?: boolean;
    isToken?: boolean;
    targetStatus?: { status: StatusType; minStacks?: number };
    sourceStatus?: { status: StatusType; minStacks?: number };
    counter?: { key: string; operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number; scope?: CounterScope };
    /** Ticket 53: AND-list of counter checks, for hooks that need more than one (GENESIS_FIRMWARE). Composes with `counter`. */
    counters?: Array<{ key: string; operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number; scope?: CounterScope }>;
    currentEnergy?: { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number };
    /**
     * TICKET 68: passes from battle turn `N` onward (`state.turn >= N`). The escalation clause of an
     * enemy Driver — WAR FOOTING grants 1 Strengthened a turn and 2 from turn 4 — and the first hook
     * condition that reads the CLOCK rather than the board.
     *
     * `state.turn` is a full round, not a side-turn: `processPreTurn` increments it only when the
     * active side flips back to PLAYER, so both sides see the same number and "turn 4" means the
     * same moment whoever is asking. An escalating aura written against side-turns would tick twice
     * as fast for the side that moves first.
     *
     * A floor rather than an operator pair, because escalation is the only thing anything has wanted
     * from the clock and a floor cannot be written backwards. If a hook ever needs "before turn N",
     * that grows a sibling here rather than an operator.
     */
    turnAtLeast?: number;
};

export type HookAction = {
    // `'HP'` is here because `lib/hooks.json` uses it and `HookFactory` dispatches on it; it was
    // missing from this union, which is why that comparison needed a cast to compile (ticket 55).
    type: ActionType | 'HP' | 'LOG' | 'COUNTER' | 'DRAW' | 'MAX_ENERGY'; // Hooks can perform actions or log
    target?: 'SELF' | 'TARGET' | 'SOURCE' | 'ALLIES' | 'ENEMIES' | 'RANDOM_ENEMY';
    status?: StatusType;
    stacks?: number;
    amount?: number;
    power?: number;
    element?: Element;
    percentMaxHP?: number;
    /**
     * Ticket 36: multiply this action by `1 + escalatePerPlay x (plays already made by the
     * owner this turn)`. Composes with `scaling` rather than replacing it, and resets every
     * turn with `playsThisTurn`.
     *
     * It exists because hel_v2's UNDERWORLD_GATEWAY had a flat per-cast price and she has no
     * Energy limit, so nothing stopped her emptying and refilling her hand on turn one - 6.5
     * casts on the turn she scored a first-turn kill. A flat toll cannot brake that: doubling
     * it moved section 2.3 by 48 points and the FTK count by zero. An escalating one does,
     * without capping her casts, which is the OS's whole identity.
     */
    escalatePerPlay?: number;
    costReduction?: number;
    flatBonus?: number;
    /**
     * Ticket 52: raw power added to the primed card's FIRST ATTACK action only.
     *
     * Distinct from `flatBonus`, which the reducer adds to every `power` field on the card
     * AND to STATUS stacks AND to HEAL power. That is the right shape for "make the next card
     * bigger" and the wrong one for UNSTOPPABLE_MASS, which is meant to prime one hit.
     */
    powerBonus?: number;
    multiplier?: number;
    text?: string;
    count?: number;
    dataId?: string; // For GENERATE_CARD
    key?: string; // For COUNTER key
    operator?: 'ADD' | 'SET' | 'RESET'; // For COUNTER operation
    scope?: CounterScope; // For COUNTER: 'OWNER' (default, per-entity) or 'GLOBAL'
    appliesTo?: ProgramCategory; // For BUFF_NEXT_PROGRAM: restrict the buff to the next card of this category
    scaling?: 'CURRENT_ENERGY' | 'SHARP_STACKS' | 'STRENGTH_STACKS' | 'ALIVE_ALLIES' | 'MISSING_HP' | 'OVERHEAL' | 'BASE_COST' | 'COUNTER' | 'SOURCE_DEBUFF_COUNT' | 'HEAL_INTENDED' | 'TARGET_POISON_STACKS' | 'HEAL_POWER';
    scalingKey?: string; // e.g., the key if scaling is 'COUNTER'
};

export type DataHookDefinition = {
    id: string;
    trigger: keyof Omit<HookDefinition, 'id' | 'priority' | 'onDamageCalculated' | 'onStatusDamageCalculated' | 'onHealCalculated'>;
    priority: HookPriority;
    when?: HookCondition;
    condition?: (context: HookContext, owner: IBattleEntity) => boolean; // For custom complex logic
    do: HookAction[];
};

export type ModifierDataHookDefinition = {
    id: string;
    trigger: 'onDamageCalculated' | 'onStatusDamageCalculated' | 'onCostCalculated' | 'onHealCalculated';
    priority: HookPriority;
    when?: HookCondition;
    condition?: (context: HookContext, owner: IBattleEntity) => boolean; // For custom complex logic
    multiplier?: number;
    bonus?: number;
    scaling?: 'CURRENT_ENERGY' | 'SHARP_STACKS' | 'STRENGTH_STACKS' | 'ALIVE_ALLIES' | 'MISSING_HP' | 'OVERHEAL' | 'BASE_COST' | 'COUNTER' | 'SOURCE_DEBUFF_COUNT' | 'HEAL_INTENDED' | 'TARGET_POISON_STACKS' | 'HEAL_POWER';
    scalingKey?: string;
};

export type DamageModifierHook = (
    currentDamage: number,
    context: HookContext,
    owner: IBattleEntity
) => number;

export type EventHook = (
    context: HookContext,
    owner: IBattleEntity
) => HookResult;

export type HookDefinition = {
    id: string;
    priority: number;
    onDamageCalculated?: DamageModifierHook;
    onStatusDamageCalculated?: DamageModifierHook; // New hook for Burn/Poison scaling
    onCostCalculated?: DamageModifierHook; // Same signature as damage hook (returns a number)
    /** Ticket 36: healing had NO modifier path at all - `onHeal` fires after the heal resolves
     *  and is a reaction hook. Same signature as the damage modifier (takes a number, returns
     *  one) so it slots into the existing modifier family unchanged. */
    onHealCalculated?: DamageModifierHook;
    onActionStart?: EventHook;
    /** Ticket 36: symmetric partner to onActionStart, dispatched ONCE PER PROGRAM after the
     *  multi-hit action loop finishes - never once per action, or a multi-action card would
     *  flip Hel's stance mid-card. End-of-action rather than start is the whole design: the
     *  card that sets a stance must not benefit from it, only the next card does. */
    onActionEnd?: EventHook;
    onModifierPhase?: EventHook;
    onPostDamage?: EventHook;
    onCardDraw?: EventHook;
    onStatusApplied?: EventHook;
    onStatusRemoved?: EventHook;
    onTurnStart?: EventHook;
    onTurnEnd?: EventHook;
    onDeckShuffled?: EventHook;
    onHeal?: EventHook;
    onUnitFainted?: EventHook;
    onDiscarded?: EventHook;
    /**
     * General-purpose threshold event (ticket 12): fires once whenever any unit
     * crosses from >=50% to <50% of maxHp via any HP loss (attack, DoT tick,
     * recoil, self-damage). Healing back above the line re-arms the unit
     * naturally, since only downward crossings are detected. context.source and
     * context.target are both the unit that crossed. First consumer: nidhoggr_v2
     * BLOOD_SCENT_OS.
     */
    onHpThresholdCrossed?: EventHook;
    data?: DataHookDefinition | ModifierDataHookDefinition; // Reference to original data
};
