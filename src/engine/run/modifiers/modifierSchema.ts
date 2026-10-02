/**
 * TICKET 169f — the shape of `data/modifiers.json`, checked at load.
 *
 * A modifier is DATA: an id, a name, the description the run-start screen prints as written, and the
 * few numbers its effect reads. The effect itself is code, one small file per modifier, and it asks
 * for its number through `modifierNumber` rather than writing it down a second time. A bad file
 * throws at load (the pattern `tiers/tierSchema.ts` and `events/eventSchema.ts` set).
 */

import { z } from 'zod';

export const ModifierSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    /** Junk Start: how many Corrupted Data join the starting deck. */
    junkCount: z.number().int().min(1).optional(),
    /** Tight Budget: how much dearer every marketplace and workshop price is, in percent. */
    pricePercent: z.number().int().min(1).optional(),
});

export type ModifierDefinition = z.infer<typeof ModifierSchema>;

/** The numbers a modifier row may carry. */
export type ModifierNumberKey = 'junkCount' | 'pricePercent';

/** Parse the whole file. Throws on a bad row or a duplicate id. */
export function parseModifiers(raw: unknown): ReadonlyArray<ModifierDefinition> {
    const modifiers = z.array(ModifierSchema).parse(raw);
    const seen = new Set<string>();
    for (const modifier of modifiers) {
        if (seen.has(modifier.id)) throw new Error(`modifiers.json: duplicate id "${modifier.id}"`);
        seen.add(modifier.id);
    }
    return modifiers;
}
