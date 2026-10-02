/**
 * TICKET 177b — THE WEIGHTS THE CHEAP POLICY PLAYS WITH, VALIDATED ON LOAD.
 *
 * `weights.json` is the file Henry reads and hand-edits (and 177c's fitter writes). This module is
 * the one place it is imported, so every consumer gets the validated numbers or a loud error.
 */

import raw from './weights.json';
import { parseWeights, type CheapWeights, type WeightsFile } from './weightsSchema';
import { FEATURE_NAMES } from './features';

/*
 * LAZY, ON PURPOSE. `features.ts` imports `evaluateState` from `TacticalAI.ts`, and 177e makes
 * `TacticalAI.ts` import the cheap policy back, so the two files are a cycle. A cycle is harmless
 * while nothing in it does work at import time and fatal if something does: parsing the weights
 * here at the top level would read `FEATURE_NAMES` before `features.ts` has finished evaluating
 * whenever `features.ts` is the file loaded first. Parsing on first use costs one validation.
 */
let loaded: WeightsFile | null = null;

/** The validated contents of `weights.json`, parsed on first use. */
export function cheapWeightsFile(): WeightsFile {
    if (loaded === null) loaded = parseWeights(raw);
    return loaded;
}

/** The shipped weights, as a plain feature → number record. */
export function cheapWeights(): CheapWeights {
    return cheapWeightsFile().weights;
}

/**
 * The weights as the readable table of the ticket: biggest first, one line each, in the feature's
 * own units. `kills a target: +3 · hp removed per 10: +1 …` is the plain-English version of this.
 */
export function weightsTable(weights: CheapWeights): string {
    const rows = [...FEATURE_NAMES]
        .map((name) => ({ name, weight: weights[name] }))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight) || (a.name < b.name ? -1 : 1));
    const width = Math.max(...rows.map((r) => r.name.length));
    return rows
        .map((r) => `${r.name.padEnd(width)}  ${(r.weight >= 0 ? '+' : '') + r.weight.toPrecision(4)}`)
        .join('\n');
}
