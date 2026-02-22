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
    baseCost: z.union([
        z.number(),
        z.object({ operator: z.enum(['LT', 'GT', 'LTE', 'GTE', 'EQ', 'NEQ']), value: z.number() })
    ]).optional(),
    triggerPhase: z.string().optional()
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
    healOverride: z.number().optional(),
    text: z.string().optional(),
    dataId: z.string().optional()
});

const HookDefinitionSchema = z.object({
    id: z.string(),
    trigger: z.string(),
    priority: z.number(),
    when: HookConditionSchema.optional(),
    condition: z.any().optional(),
    do: z.array(HookActionSchema).optional(),
    multiplier: z.number().optional(),
    bonus: z.number().optional()
});

export const HookLibraryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    hooks: z.array(HookDefinitionSchema).optional()
});

export const HookLibrarySchema = z.record(z.string(), HookLibraryItemSchema);
