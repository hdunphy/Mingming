import type { IBattleState, IBattleEntity, ProgramData, StatusType } from '../types';

export enum HookPriority {
    SYSTEM = 100,
    GLOBAL = 75,
    ATTACKER = 50,
    PROGRAM = 40,
    DEFENDER = 25,
    LOGGING = 0
}

export type MutationRequest = {
    type: 'HP' | 'ENERGY' | 'STATUS' | 'LOG' | 'EVENT';
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
    programCategory?: 'Attack' | 'Heal' | 'Status' | 'Special';
    programElement?: string;
    baseCost?: number | { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number };
    statusApplied?: StatusType;
    isNaturalDraw?: boolean;
};

export type HookAction = {
    type: 'HP' | 'ENERGY' | 'STATUS' | 'LOG' | 'DRAW';
    target?: 'SELF' | 'TARGET' | 'ALLIES' | 'ENEMIES' | 'RANDOM_ENEMY';
    status?: StatusType;
    stacks?: number;
    amount?: number;
    percentMaxHP?: number;
    isHeal?: boolean; // Explicit heal flag
    text?: string;
    count?: number;
};

export type DataHookDefinition = {
    id: string;
    trigger: keyof Omit<HookDefinition, 'id' | 'priority' | 'onDamageCalculated'>;
    priority: HookPriority;
    when?: HookCondition;
    do: HookAction[];
};

export type ModifierDataHookDefinition = {
    id: string;
    trigger: 'onDamageCalculated';
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
    onActionStart?: EventHook;
    onModifierPhase?: EventHook;
    onPostDamage?: EventHook;
    onCardDraw?: EventHook;
    onStatusApplied?: EventHook;
    onTurnEnd?: EventHook;
    data?: DataHookDefinition | ModifierDataHookDefinition; // Reference to original data
};
