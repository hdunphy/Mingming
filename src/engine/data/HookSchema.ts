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
    // Ticket 107: the anti-recursion guard. zod strips undeclared keys, so a hook using this
    // without the line below would fire UNGUARDED - which for this particular condition means an
    // infinite status cascade, not a no-op.
    statusAppliedNotIn: z.array(z.string()).optional(),
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
    // Ticket 53: the AND-list form. zod STRIPS unknown keys, so a `counters` block added to
    // hooks.json without this line would be silently dropped and the hook would fire unguarded.
    counters: z.array(z.object({ key: z.string(), operator: z.enum(['LT', 'GT', 'LTE', 'GTE', 'EQ']), value: z.number(), scope: z.enum(['GLOBAL', 'OWNER']).optional() })).optional(),
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
    // Ticket 36. NOTE: zod strips unknown keys, so a field added to HookAction but not
    // listed here is silently dropped between hooks.json and the engine - which is exactly
    // how this one spent three sim runs looking like a no-op.
    escalatePerPlay: z.number().optional(),
    costReduction: z.number().optional(),
    flatBonus: z.number().optional(),
    // Ticket 52: zod strips undeclared keys, so a field missing here does not exist at runtime
    // no matter what hooks.json says (HANDOFF 8c2 - it cost ticket 36 three identical sim runs).
    powerBonus: z.number().optional(),
    multiplier: z.number().optional(),
    text: z.string().optional(),
    dataId: z.string().optional(),
    key: z.string().optional(),
    operator: z.enum(['ADD', 'SET', 'RESET']).optional(),
    scope: z.enum(['GLOBAL', 'OWNER']).optional(),
    appliesTo: z.string().optional(),
    scaling: z.enum(['CURRENT_ENERGY', 'SHARP_STACKS', 'STRENGTH_STACKS', 'ALIVE_ALLIES', 'MISSING_HP', 'OVERHEAL', 'BASE_COST', 'COUNTER', 'SOURCE_DEBUFF_COUNT', 'HEAL_INTENDED', 'TARGET_POISON_STACKS', 'HEAL_POWER']).optional(),
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
    scaling: z.enum(['CURRENT_ENERGY', 'SHARP_STACKS', 'STRENGTH_STACKS', 'ALIVE_ALLIES', 'MISSING_HP', 'OVERHEAL', 'BASE_COST', 'COUNTER', 'SOURCE_DEBUFF_COUNT', 'HEAL_INTENDED', 'TARGET_POISON_STACKS', 'HEAL_POWER']).optional(),
    scalingKey: z.string().optional()
});

export const HookLibraryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    maxCardsPerTurn: z.number().optional(),
    // Ticket 48: zod STRIPS unknown keys, so a field that is not declared here does not exist at
    // runtime no matter what hooks.json says. That is exactly how `escalatePerPlay` cost ticket 36
    // three byte-identical sim runs (HANDOFF 8c2).
    actsWhileAsleep: z.boolean().optional(),
    hooks: z.array(HookDefinitionSchema).optional()
});

export const HookLibrarySchema = z.record(z.string(), HookLibraryItemSchema);
