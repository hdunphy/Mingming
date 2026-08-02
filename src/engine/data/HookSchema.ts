import { z } from 'zod';

const HookConditionSchema = z.object({
    source: z.string().optional(),
    target: z.string().optional(),
    isNaturalDraw: z.boolean().optional(),
    isFromPlay: z.boolean().optional(),
    actionType: z.string().optional(),
    programElement: z.string().optional(),
    isAttack: z.boolean().optional(),
    isToken: z.boolean().optional(),
    statusApplied: z.string().optional(),
    statusAppliedIn: z.array(z.string()).optional(),
    programCategoryIn: z.array(z.string()).optional(),
    programCategoryNot: z.array(z.string()).optional(),
    programAppliesStatus: z.boolean().optional(),
    sourceDebuffCount: z.object({ operator: z.enum(['LT', 'GT', 'LTE', 'GTE', 'EQ']), value: z.number() }).optional(),
    baseCost: z.union([
        z.number(),
        z.object({ operator: z.enum(['LT', 'GT', 'LTE', 'GTE', 'EQ', 'NEQ']), value: z.number() })
    ]).optional(),
    triggerPhase: z.string().optional(),
    targetStatus: z.object({ status: z.string(), minStacks: z.number().optional() }).optional(),
    sourceStatus: z.object({ status: z.string(), minStacks: z.number().optional() }).optional(),
    counter: z.object({ key: z.string(), operator: z.enum(['LT', 'GT', 'LTE', 'GTE', 'EQ']), value: z.number(), scope: z.enum(['GLOBAL', 'OWNER']).optional() }).optional(),
    currentEnergy: z.object({ operator: z.enum(['LT', 'GT', 'LTE', 'GTE', 'EQ']), value: z.number() }).optional()
});

const HookActionSchema = z.object({
    type: z.string(),
    target: z.string().optional(),
    status: z.string().optional(),
    stacks: z.number().optional(),
    power: z.number().optional(),
    element: z.string().optional(),
    amount: z.number().optional(),
    percentMaxHP: z.number().optional(),
    costReduction: z.number().optional(),
    flatBonus: z.number().optional(),
    multiplier: z.number().optional(),
    healOverride: z.number().optional(),
    text: z.string().optional(),
    dataId: z.string().optional(),
    key: z.string().optional(),
    operator: z.enum(['ADD', 'SET', 'RESET']).optional(),
    scope: z.enum(['GLOBAL', 'OWNER']).optional(),
    appliesTo: z.string().optional(),
    scaling: z.enum(['CURRENT_ENERGY', 'SHARP_STACKS', 'STRENGTH_STACKS', 'ALIVE_ALLIES', 'MISSING_HP', 'OVERHEAL', 'BASE_COST', 'COUNTER']).optional(),
    scalingKey: z.string().optional()
});

const HookDefinitionSchema = z.object({
    id: z.string(),
    trigger: z.string(),
    priority: z.number(),
    when: HookConditionSchema.optional(),
    condition: z.any().optional(),
    do: z.array(HookActionSchema).optional(),
    multiplier: z.number().optional(),
    bonus: z.number().optional(),
    scaling: z.enum(['CURRENT_ENERGY', 'SHARP_STACKS', 'STRENGTH_STACKS', 'ALIVE_ALLIES', 'MISSING_HP', 'OVERHEAL', 'BASE_COST', 'COUNTER']).optional(),
    scalingKey: z.string().optional()
});

export const HookLibraryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    maxCardsPerTurn: z.number().optional(),
    hooks: z.array(HookDefinitionSchema).optional()
});

export const HookLibrarySchema = z.record(z.string(), HookLibraryItemSchema);
