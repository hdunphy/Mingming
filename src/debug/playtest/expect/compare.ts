/**
 * TICKET 180e — PREDICTION AGAINST RESULT: a difference per key that disagrees.
 *
 * Names are compared without case or spacing, and a unit given by id counts as that unit's name.
 * A key the prediction does not have is not looked at. `status` and `self` are compared whole, so a
 * status the agent did not foresee is a difference too.
 */
import type { IBattleState } from '../../../engine/types';
import type { Outcome } from './outcome';
import { PREDICTION_KEYS, type Prediction } from './prediction';

export interface Difference {
    readonly key: string;
    readonly predicted: unknown;
    readonly actual: unknown;
}

const norm = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

function normalizeCounts(counts: Readonly<Record<string, number>>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, n] of Object.entries(counts)) if (n !== 0) out[norm(name)] = n;
    return out;
}

const sortKeys = (v: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)));

export function compare(prediction: Prediction, outcome: Outcome, before: IBattleState): Difference[] {
    const nameOf = (given: string): string => {
        const byId = [...before.playerParty, ...before.enemyParty].find((e) => e.id === given);
        return norm(byId ? byId.name : given);
    };
    const differences: Difference[] = [];
    for (const key of PREDICTION_KEYS) {
        if (!(key in prediction)) continue;
        const predicted = prediction[key];
        let actual: unknown = outcome[key];
        let same: boolean;
        switch (key) {
            case 'kills': {
                const want = (predicted as ReadonlyArray<string>).map(nameOf).sort();
                const got = outcome.kills.map(norm).sort();
                same = JSON.stringify(want) === JSON.stringify(got);
                break;
            }
            case 'self':
                same = JSON.stringify(sortKeys(normalizeCounts(predicted as Record<string, number>)))
                    === JSON.stringify(sortKeys(normalizeCounts(outcome.self)));
                break;
            case 'status': {
                const flatten = (m: Readonly<Record<string, Readonly<Record<string, number>>>>, keyOf: (n: string) => string): Record<string, unknown> => {
                    const out: Record<string, unknown> = {};
                    for (const [unit, counts] of Object.entries(m)) {
                        const n = normalizeCounts(counts);
                        if (Object.keys(n).length > 0) out[keyOf(unit)] = sortKeys(n);
                    }
                    return sortKeys(out);
                };
                same = JSON.stringify(flatten(predicted as Record<string, Record<string, number>>, nameOf))
                    === JSON.stringify(flatten(outcome.status, norm));
                break;
            }
            default:
                same = predicted === outcome[key];
        }
        if (!same) {
            if (key === 'status' || key === 'self') actual = outcome[key];
            differences.push({ key, predicted, actual });
        }
    }
    return differences;
}
