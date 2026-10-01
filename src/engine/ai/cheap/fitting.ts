/**
 * TICKET 177c — FITTING THE WEIGHTS: A SOFTMAX OVER EACH DECISION'S LEGAL ACTIONS.
 *
 * The data is "among these actions, the full AI took that one". The model is the cheap policy
 * itself: score = Σ weight × feature, and the probability of an action is the softmax of the scores
 * across the decision's legal actions (multinomial logistic regression, one "class" per legal action
 * rather than per fixed label). Training minimises the mean negative log-probability of the teacher's
 * choice plus `l2 × Σ w²`, by plain full-batch gradient descent. No library, no randomness: the
 * result is a function of the data and the options, bit for bit.
 *
 * SCALES. The features live on very different scales (a kill is 0 or 1; `evalDelta` runs into the
 * thousands and into the hundred-thousands when a fight ends). Descent and the L2 penalty both need
 * them comparable, so the fit runs on features divided by a per-feature scale — the 99th percentile
 * of the feature's absolute value, so one terminal-score outlier cannot flatten the whole column —
 * and the weights it hands back are converted to RAW feature units, which is what `weights.json`
 * and the policy use. A feature that is zero everywhere has scale 1 and a weight of exactly 0.
 *
 * STEP SIZE. A fixed step with a guard: if a step would raise the loss it is taken back and the step
 * halved. That is still plain gradient descent, and it keeps one set of options working on any
 * dataset.
 *
 * Engine module: pure, no I/O, no `Math.random`, no `Date.now()`.
 */

import { FEATURE_NAMES, type FeatureName } from './features';

export interface FitDecision {
    /** One feature row per legal action, `FEATURE_NAMES.length` numbers each. */
    readonly features: ReadonlyArray<ReadonlyArray<number>>;
    /** Index of the action the teacher chose. */
    readonly chosen: number;
}

export interface FitOptions {
    /** L2 penalty on the (scaled) weights. The ticket's value is 0.01. */
    readonly l2: number;
    readonly iterations: number;
    readonly learningRate: number;
}

export const DEFAULT_FIT_OPTIONS: FitOptions = { l2: 0.01, iterations: 1500, learningRate: 0.5 };

export interface FitResult {
    /** Weights in RAW feature units, in `FEATURE_NAMES` order. */
    readonly weights: number[];
    readonly scales: number[];
    /** Mean negative log-likelihood on the training data, without the penalty. */
    readonly trainLoss: number;
    readonly iterations: number;
}

const D = FEATURE_NAMES.length;

interface Packed {
    /** All actions' feature rows, back to back, `D` numbers each. */
    readonly x: Float64Array;
    /** `start[i]` is the first ROW of decision i; `start[n]` is the total row count. */
    readonly start: Int32Array;
    readonly chosen: Int32Array;
    readonly n: number;
}

function pack(decisions: ReadonlyArray<FitDecision>): Packed {
    let rows = 0;
    for (const d of decisions) rows += d.features.length;
    const x = new Float64Array(rows * D);
    const start = new Int32Array(decisions.length + 1);
    const chosen = new Int32Array(decisions.length);
    let row = 0;
    decisions.forEach((d, i) => {
        start[i] = row;
        chosen[i] = d.chosen;
        for (const features of d.features) {
            for (let k = 0; k < D; k += 1) x[row * D + k] = features[k];
            row += 1;
        }
    });
    start[decisions.length] = row;
    return { x, start, chosen, n: decisions.length };
}

/** The per-feature scale: the 99th percentile of |x|, or 1 when the column is all zeros. */
export function featureScales(decisions: ReadonlyArray<FitDecision>): number[] {
    const packed = pack(decisions);
    const rows = packed.start[packed.n];
    const scales: number[] = [];
    for (let k = 0; k < D; k += 1) {
        const column = new Float64Array(rows);
        for (let r = 0; r < rows; r += 1) column[r] = Math.abs(packed.x[r * D + k]);
        column.sort();
        const q = rows === 0 ? 0 : column[Math.min(rows - 1, Math.floor(0.99 * rows))];
        // Fall back to the max when the 99th percentile is 0 but the feature is not constant zero
        // (a rare event: a kill, a death). Dividing by the max keeps it from being invisible.
        const max = rows === 0 ? 0 : column[rows - 1];
        const s = q > 0 ? q : max;
        scales.push(s > 0 ? s : 1);
    }
    return scales;
}

/** Mean negative log-likelihood of the teacher's choices, and the gradient, for scaled weights `w`. */
function lossAndGradient(p: Packed, scaled: Float64Array, w: Float64Array, grad: Float64Array | null): number {
    if (grad) grad.fill(0);
    let loss = 0;
    const scores: number[] = [];
    for (let i = 0; i < p.n; i += 1) {
        const first = p.start[i];
        const count = p.start[i + 1] - first;
        scores.length = count;
        let max = -Infinity;
        for (let j = 0; j < count; j += 1) {
            let s = 0;
            const base = (first + j) * D;
            for (let k = 0; k < D; k += 1) s += w[k] * scaled[base + k];
            scores[j] = s;
            if (s > max) max = s;
        }
        let sum = 0;
        for (let j = 0; j < count; j += 1) {
            scores[j] = Math.exp(scores[j] - max);
            sum += scores[j];
        }
        const logSum = Math.log(sum) + max;
        const chosenScore = Math.log(scores[p.chosen[i]]) + max;
        loss += logSum - chosenScore;
        if (grad) {
            for (let j = 0; j < count; j += 1) {
                const prob = scores[j] / sum - (j === p.chosen[i] ? 1 : 0);
                if (prob === 0) continue;
                const base = (first + j) * D;
                for (let k = 0; k < D; k += 1) grad[k] += prob * scaled[base + k];
            }
        }
    }
    if (grad) for (let k = 0; k < D; k += 1) grad[k] /= p.n;
    return loss / p.n;
}

export function fitSoftmax(
    decisions: ReadonlyArray<FitDecision>,
    options: FitOptions = DEFAULT_FIT_OPTIONS,
): FitResult {
    const usable = decisions.filter((d) => d.features.length > 0 && d.chosen >= 0 && d.chosen < d.features.length);
    if (usable.length === 0) throw new Error('[fitting] no decisions to fit.');

    const scales = featureScales(usable);
    const p = pack(usable);
    const scaled = new Float64Array(p.x.length);
    for (let r = 0; r < p.x.length / D; r += 1) {
        for (let k = 0; k < D; k += 1) scaled[r * D + k] = p.x[r * D + k] / scales[k];
    }

    const w = new Float64Array(D);
    const grad = new Float64Array(D);
    const penalty = (v: Float64Array): number => {
        let s = 0;
        for (let k = 0; k < D; k += 1) s += v[k] * v[k];
        return options.l2 * s;
    };

    let step = options.learningRate;
    let current = lossAndGradient(p, scaled, w, grad) + penalty(w);
    let done = 0;
    for (let it = 0; it < options.iterations; it += 1) {
        // gradient of (loss + l2 Σw²)
        const g = new Float64Array(D);
        let norm = 0;
        for (let k = 0; k < D; k += 1) {
            g[k] = grad[k] + 2 * options.l2 * w[k];
            norm += g[k] * g[k];
        }
        if (Math.sqrt(norm) < 1e-7) break;

        // Take the step; if it did not help, take it back and halve it.
        for (;;) {
            const trial = new Float64Array(D);
            for (let k = 0; k < D; k += 1) trial[k] = w[k] - step * g[k];
            const trialLoss = lossAndGradient(p, scaled, trial, null) + penalty(trial);
            if (trialLoss <= current || step < 1e-12) {
                w.set(trial);
                break;
            }
            step /= 2;
        }
        current = lossAndGradient(p, scaled, w, grad) + penalty(w);
        done = it + 1;
    }

    const trainLoss = lossAndGradient(p, scaled, w, null);
    return {
        weights: Array.from(w, (v, k) => v / scales[k]),
        scales,
        trainLoss,
        iterations: done,
    };
}

/** Index of the highest-scoring action; ties go to the earlier one, exactly as the policy does. */
export function argmaxScore(features: ReadonlyArray<ReadonlyArray<number>>, weights: ReadonlyArray<number>): number {
    let best = 0;
    let bestScore = -Infinity;
    for (let j = 0; j < features.length; j += 1) {
        let s = 0;
        for (let k = 0; k < D; k += 1) s += weights[k] * features[j][k];
        if (s > bestScore) {
            bestScore = s;
            best = j;
        }
    }
    return best;
}

/** The share of decisions where the weights' top-scoring action is the teacher's choice. */
export function top1Agreement(decisions: ReadonlyArray<FitDecision>, weights: ReadonlyArray<number>): number {
    let hit = 0;
    let total = 0;
    for (const d of decisions) {
        if (d.features.length === 0) continue;
        total += 1;
        if (argmaxScore(d.features, weights) === d.chosen) hit += 1;
    }
    return total === 0 ? 0 : hit / total;
}

export function weightsToVector(weights: Readonly<Record<FeatureName, number>>): number[] {
    return FEATURE_NAMES.map((name) => weights[name]);
}

export function vectorToWeights(vector: ReadonlyArray<number>): Record<FeatureName, number> {
    return Object.fromEntries(FEATURE_NAMES.map((name, k) => [name, vector[k]])) as Record<FeatureName, number>;
}
