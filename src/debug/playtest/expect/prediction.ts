/**
 * TICKET 180e — THE AGENT'S PREDICTION, `--expect '<json>'`.
 *
 *   {"hits": 2, "kills": ["Huldra"], "status": {"Huldra": {"Dazed": 2}}, "self": {"Strengthened": 1},
 *    "draw": 1, "energy": -2, "created": 0, "exhausted": 1}
 *
 * Every key is optional. Damage amounts are NOT predicted (the agent reads them off the move's
 * preview if it wants them; a number it could only guess would be noise). Units are named as the
 * screen names them; an id is accepted too. Statuses are the names the screen prints. A key the
 * agent leaves out is simply not checked, and a key it gives is checked in full: `status` and
 * `self` list every status change the move makes, not just the one the agent cared about.
 */
export interface Prediction {
    readonly hits?: number;
    readonly kills?: ReadonlyArray<string>;
    readonly status?: Readonly<Record<string, Readonly<Record<string, number>>>>;
    readonly self?: Readonly<Record<string, number>>;
    readonly draw?: number;
    readonly energy?: number;
    readonly created?: number;
    readonly exhausted?: number;
}

export const PREDICTION_KEYS: ReadonlyArray<keyof Prediction> = ['hits', 'kills', 'status', 'self', 'draw', 'energy', 'created', 'exhausted'];

const NUMBER_KEYS: ReadonlyArray<keyof Prediction> = ['hits', 'draw', 'energy', 'created', 'exhausted'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCounts = (v: unknown): v is Record<string, number> => isRecord(v) && Object.values(v).every((n) => Number.isInteger(n));

/** A prediction, or the reason it cannot be read. Unknown keys are refused so a typo is caught, not ignored. */
export function parsePrediction(raw: unknown): { readonly ok: true; readonly prediction: Prediction } | { readonly ok: false; readonly reason: string } {
    if (!isRecord(raw)) return { ok: false, reason: '--expect must be a JSON object.' };
    for (const key of Object.keys(raw)) {
        if (!(PREDICTION_KEYS as ReadonlyArray<string>).includes(key)) {
            return { ok: false, reason: `--expect has no key "${key}". The keys are: ${PREDICTION_KEYS.join(', ')}.` };
        }
    }
    for (const key of NUMBER_KEYS) {
        if (key in raw && !Number.isInteger(raw[key])) return { ok: false, reason: `--expect "${key}" must be a whole number.` };
    }
    if ('kills' in raw && !(Array.isArray(raw.kills) && raw.kills.every((k) => typeof k === 'string'))) {
        return { ok: false, reason: '--expect "kills" must be a list of unit names.' };
    }
    if ('self' in raw && !isCounts(raw.self)) return { ok: false, reason: '--expect "self" must look like {"StatusName": stacks}.' };
    if ('status' in raw && !(isRecord(raw.status) && Object.values(raw.status).every(isCounts))) {
        return { ok: false, reason: '--expect "status" must look like {"UnitName": {"StatusName": stacks}}.' };
    }
    return { ok: true, prediction: raw as Prediction };
}
