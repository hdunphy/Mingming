/**
 * TICKET 169a — the shape of `data/tiers.json`, checked at load.
 *
 * A tier is DATA: what its wild enemies run, how many extra elites its map holds, and whether the
 * gym leader's Driver plays in every gauntlet fight. The file never holds a number that scales a
 * stat, because there is nowhere in the schema to put one — that is ticket 29's standing law
 * (*"harder means different content, never bigger numbers"*) made structural.
 *
 * Every row lists the WHOLE state for its tier, not just what changed, so a designer reading one
 * row sees everything. A bad file throws at load (the pattern `events/eventSchema.ts` set).
 */

import { z } from 'zod';

/** Mirrors `AiTier` in `ai/TacticalAI.ts`. `full` is the gauntlet's grade and is never a wild's. */
export const TIER_WILD_AI = ['greedy', 'lite', 'full'] as const;

export const TierRuleSchema = z.object({
    tier: z.number().int().min(0),
    name: z.string().min(1),
    description: z.string().min(1),
    /** Wild enemies play their firmware (ticket 60's old tier-2 rung). */
    wildFirmware: z.boolean(),
    /** How well wild enemies play (ticket 60's old tier-3 rung). */
    wildAi: z.enum(TIER_WILD_AI),
    /** Wilds converted to elites in every biome (169b). */
    extraElitesPerBiome: z.number().int().min(0),
    /** The leader's Driver is active in gauntlet fights 1 and 2 as well as the boss (169c). */
    leaderDriverEveryFight: z.boolean(),
});

export const TiersFileSchema = z.object({
    tiers: z.array(TierRuleSchema).min(1),
    /** Gym id to the Driver id fights 1 and 2 carry at a tier with `leaderDriverEveryFight`. */
    leaderDrivers: z.record(z.string(), z.string().min(1)),
});

export type TierRule = z.infer<typeof TierRuleSchema>;
export type TiersFile = z.infer<typeof TiersFileSchema>;

/** Parse the whole file. Throws on a bad file, or on tiers that are not 0, 1, 2... in order. */
export function parseTiers(raw: unknown): TiersFile {
    const file = TiersFileSchema.parse(raw);
    file.tiers.forEach((row, index) => {
        if (row.tier !== index) {
            throw new Error(`tiers.json: row ${index} says tier ${row.tier}; the rows must be 0, 1, 2... in order`);
        }
    });
    return file;
}
