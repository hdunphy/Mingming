/**
 * TICKET 177b — THE SHAPE OF `weights.json`, CHECKED.
 *
 * One finite number per feature in `FEATURE_NAMES`, no more and no fewer, so a typo in a hand edit
 * ("enemyKils") is an error at load time rather than a feature quietly scored at zero. `source` is
 * free text saying where the numbers came from (hand-set, or which fit); it is for the reader.
 */

import { z } from 'zod';
import { FEATURE_NAMES, type FeatureName } from './features';

/** Built on use rather than at import: see the note in `weights.ts` about the import cycle. */
function weightsFileSchema() {
    const weightsShape = Object.fromEntries(
        FEATURE_NAMES.map((name) => [name, z.number().finite()]),
    ) as Record<FeatureName, z.ZodNumber>;
    return z.object({
        source: z.string(),
        weights: z.object(weightsShape).strict(),
    }).strict();
}

export type WeightsFile = { source: string; weights: Record<FeatureName, number> };
export type CheapWeights = Readonly<Record<FeatureName, number>>;

/** Parse and validate a weights document. Throws a readable error naming what is wrong. */
export function parseWeights(raw: unknown): WeightsFile {
    const result = weightsFileSchema().safeParse(raw);
    if (!result.success) {
        const detail = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        throw new Error(`[cheap/weightsSchema] weights.json is not valid: ${detail}`);
    }
    return result.data as WeightsFile;
}
