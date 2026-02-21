import type { IBattleState, IBattleEntity, ProgramData, StatusType, ActionType } from '../types';

export enum HookPriority {
    SYSTEM = 100,
    GLOBAL = 75,
    ATTACKER = 50,
    PROGRAM = 40,
    DEFENDER = 25,
    LOGGING = 0
}

export type MutationRequest = {
    type: 'HP' | 'ENERGY' | 'STATUS' | 'LOG' | 'EVENT' | 'GENERATE_CARD' | 'CLEANSE' | 'DISCARD' | 'EXHAUST' | 'RETURN' | 'SEARCH';
    targetId: string;
    sourceId?: string; // Optional source of the mutation
    payload: any;
};

export type HookResult = {
    mutations: MutationRequest[];
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
    isNaturalDraw?: boolean;
};

export type HookAction = {
    type: ActionType | 'LOG'; // Hooks can perform actions or log
    target?: 'SELF' | 'TARGET' | 'ALLIES' | 'ENEMIES' | 'RANDOM_ENEMY';
    status?: StatusType;
    stacks?: number;
    amount?: number;
    percentMaxHP?: number;
    text?: string;
    count?: number;
    dataId?: string; // For GENERATE_CARD
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
    multiplier?: number;
    bonus?: number;
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
    onActionStart?: EventHook;
    onModifierPhase?: EventHook;
    onPostDamage?: EventHook;
    onCardDraw?: EventHook;
    onStatusApplied?: EventHook;
    onTurnEnd?: EventHook;
    data?: DataHookDefinition | ModifierDataHookDefinition; // Reference to original data
};
