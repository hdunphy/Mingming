import type { IBattleState, IBattleEntity, ProgramData, StatusType, ActionType, ProgramCategory } from '../types';

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
    source?: 'SELF' | 'ALLY' | 'OPPONENT';
    target?: 'SELF' | 'ALLY' | 'OPPONENT';
    actionType?: ActionType;
    programElement?: string;
    baseCost?: number | { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number };
    statusApplied?: StatusType;
    statusAppliedIn?: StatusType[]; // Passes when the applied status is any of these
    programCategoryIn?: string[]; // Passes when a program is in context and its category matches one of these
    programCategoryNot?: string[]; // Passes when a program is in context and its category matches NONE of these
    programAppliesStatus?: boolean; // Passes when the program in context does (true) / does not (false) contain a STATUS action
    sourceDebuffCount?: { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number }; // Number of negative statuses on context.source
    isNaturalDraw?: boolean;
    isToken?: boolean;
    targetStatus?: { status: StatusType; minStacks?: number };
    sourceStatus?: { status: StatusType; minStacks?: number };
    counter?: { key: string; operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number; scope?: CounterScope };
    currentEnergy?: { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number };
};

export type HookAction = {
    type: ActionType | 'LOG' | 'COUNTER' | 'DRAW' | 'MAX_ENERGY'; // Hooks can perform actions or log
    target?: 'SELF' | 'TARGET' | 'SOURCE' | 'ALLIES' | 'ENEMIES' | 'RANDOM_ENEMY';
    status?: StatusType;
    stacks?: number;
    amount?: number;
    power?: number;
    element?: Element;
    percentMaxHP?: number;
    costReduction?: number;
    flatBonus?: number;
    multiplier?: number;
    text?: string;
    count?: number;
    dataId?: string; // For GENERATE_CARD
    key?: string; // For COUNTER key
    operator?: 'ADD' | 'SET' | 'RESET'; // For COUNTER operation
    scope?: CounterScope; // For COUNTER: 'OWNER' (default, per-entity) or 'GLOBAL'
    appliesTo?: ProgramCategory; // For BUFF_NEXT_PROGRAM: restrict the buff to the next card of this category
    scaling?: 'CURRENT_ENERGY' | 'SHARP_STACKS' | 'STRENGTH_STACKS' | 'ALIVE_ALLIES' | 'MISSING_HP' | 'OVERHEAL' | 'BASE_COST' | 'COUNTER';
    scalingKey?: string; // e.g., the key if scaling is 'COUNTER'
};

export type DataHookDefinition = {
    id: string;
    trigger: keyof Omit<HookDefinition, 'id' | 'priority' | 'onDamageCalculated' | 'onStatusDamageCalculated'>;
    priority: HookPriority;
    when?: HookCondition;
    condition?: (context: HookContext, owner: IBattleEntity) => boolean; // For custom complex logic
    do: HookAction[];
};

export type ModifierDataHookDefinition = {
    id: string;
    trigger: 'onDamageCalculated' | 'onStatusDamageCalculated';
    priority: HookPriority;
    when?: HookCondition;
    condition?: (context: HookContext, owner: IBattleEntity) => boolean; // For custom complex logic
    multiplier?: number;
    bonus?: number;
    scaling?: 'CURRENT_ENERGY' | 'SHARP_STACKS' | 'STRENGTH_STACKS' | 'ALIVE_ALLIES' | 'MISSING_HP' | 'OVERHEAL' | 'BASE_COST' | 'COUNTER';
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
    onActionStart?: EventHook;
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
    data?: DataHookDefinition | ModifierDataHookDefinition; // Reference to original data
};
