/**
 * TICKET 177c — FIT THE CHEAP POLICY'S WEIGHTS TO THE RECORDED TEACHER.
 *
 * Reads `results/cheap-ai/teacher-*.jsonl`, holds out 20% of the FIGHTS (`isHeldOut`), fits the
 * softmax on the rest (`fitting.ts`), prints the weights as a table sorted by size and the top-1
 * agreement with the full AI on the decisions the fit never saw, and (unless told not to) writes the
 * weights to `src/engine/ai/cheap/weights.json`.
 *
 * The held-out number is the headline and it is read against two plain baselines printed beside it:
 * the hand-set weights from 177b, and "always end the turn" (the share of decisions where the full
 * AI's answer is to stop). An agreement that does not clear those is not a policy.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import {
    DEFAULT_FIT_OPTIONS, fitSoftmax, top1Agreement, vectorToWeights, weightsToVector,
    type FitDecision, type FitOptions, type FitResult,
} from '../../../engine/ai/cheap/fitting';
import { FEATURE_NAMES, type FeatureName } from '../../../engine/ai/cheap/features';
import { parseWeights, type CheapWeights } from '../../../engine/ai/cheap/weightsSchema';
import { weightsTable } from '../../../engine/ai/cheap/weights';
import { isHeldOut, readTeacherDir, type TeacherDecision } from './teacherData';

export const DEFAULT_WEIGHTS_PATH = 'src/engine/ai/cheap/weights.json';

export interface FitReport {
    readonly fights: { readonly train: number; readonly heldOut: number };
    readonly decisions: { readonly train: number; readonly heldOut: number };
    readonly fit: FitResult;
    readonly weights: CheapWeights;
    readonly agreement: {
        readonly trainTop1: number;
        readonly heldOutTop1: number;
        /** Held-out, hand-set 177b weights. */
        readonly handSetHeldOutTop1: number;
        /** Held-out, a policy that always ends the turn. */
        readonly alwaysEndTurnHeldOut: number;
        /** Held-out, among the decisions where the teacher ended the turn / played a card. */
        readonly heldOutWhenTeacherEnds: number;
        readonly heldOutWhenTeacherPlays: number;
    };
}

const asFit = (d: TeacherDecision): FitDecision => ({ features: d.features, chosen: d.chosen });

/** Split recorded decisions by fight into train and held-out. */
export function splitDecisions(decisions: ReadonlyArray<TeacherDecision>): { train: TeacherDecision[]; heldOut: TeacherDecision[] } {
    const train: TeacherDecision[] = [];
    const heldOut: TeacherDecision[] = [];
    for (const d of decisions) (isHeldOut(d.fight) ? heldOut : train).push(d);
    return { train, heldOut };
}

export function fitReport(
    decisions: ReadonlyArray<TeacherDecision>,
    handSet: CheapWeights,
    options: FitOptions = DEFAULT_FIT_OPTIONS,
): FitReport {
    const { train, heldOut } = splitDecisions(decisions);
    if (train.length === 0 || heldOut.length === 0) {
        throw new Error(`[fitWeights] need decisions on both sides of the split (train ${train.length}, held-out ${heldOut.length}).`);
    }
    const trainFit = train.map(asFit);
    const testFit = heldOut.map(asFit);
    const fit = fitSoftmax(trainFit, options);
    const weights = vectorToWeights(fit.weights);

    const endIndex = (d: TeacherDecision): number => d.keys.indexOf('END_TURN');
    const alwaysEnd = heldOut.filter((d) => d.chosen === endIndex(d)).length / heldOut.length;
    const teacherEnds = heldOut.filter((d) => d.chosen === endIndex(d));
    const teacherPlays = heldOut.filter((d) => d.chosen !== endIndex(d));
    const on = (rows: TeacherDecision[]): number => (rows.length === 0 ? 0 : top1Agreement(rows.map(asFit), fit.weights));

    return {
        fights: {
            train: new Set(train.map((d) => d.fight)).size,
            heldOut: new Set(heldOut.map((d) => d.fight)).size,
        },
        decisions: { train: train.length, heldOut: heldOut.length },
        fit,
        weights,
        agreement: {
            trainTop1: top1Agreement(trainFit, fit.weights),
            heldOutTop1: top1Agreement(testFit, fit.weights),
            handSetHeldOutTop1: top1Agreement(testFit, weightsToVector(handSet)),
            alwaysEndTurnHeldOut: alwaysEnd,
            heldOutWhenTeacherEnds: on(teacherEnds),
            heldOutWhenTeacherPlays: on(teacherPlays),
        },
    };
}

const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;

export function printFitReport(report: FitReport): void {
    const a = report.agreement;
    console.log(`\nFit on ${report.fights.train} fights / ${report.decisions.train} decisions; `
        + `held out ${report.fights.heldOut} fights / ${report.decisions.heldOut} decisions.`);
    console.log(`Gradient descent: ${report.fit.iterations} steps, training loss ${report.fit.trainLoss.toFixed(4)}.\n`);
    console.log('Weights (raw feature units, biggest first):');
    console.log(weightsTable(report.weights));
    console.log('\nTop-1 agreement with the full AI:');
    console.log(`  held-out, fitted weights        ${pct(a.heldOutTop1)}`);
    console.log(`  held-out, hand-set 177b weights ${pct(a.handSetHeldOutTop1)}`);
    console.log(`  held-out, always end the turn   ${pct(a.alwaysEndTurnHeldOut)}`);
    console.log(`  held-out, teacher ends the turn ${pct(a.heldOutWhenTeacherEnds)}   teacher plays a card ${pct(a.heldOutWhenTeacherPlays)}`);
    console.log(`  training                        ${pct(a.trainTop1)}`);
}

export function writeWeights(path: string, weights: CheapWeights, source: string): void {
    const ordered = Object.fromEntries(FEATURE_NAMES.map((name: FeatureName) => [name, Number(weights[name].toPrecision(6))]));
    const file = parseWeights({ source, weights: ordered });
    writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
}

export function readHandSet(path: string): CheapWeights {
    return parseWeights(JSON.parse(readFileSync(path, 'utf8'))).weights;
}

/** The whole job: read, fit, print, optionally write. */
export function fitFromDir(dir: string, weightsPath: string, write: boolean, options?: FitOptions): FitReport {
    const data = readTeacherDir(dir);
    if (data.decisions.length === 0) throw new Error(`[fitWeights] no finished fights in ${dir}.`);
    const handSet = readHandSet(weightsPath);
    const report = fitReport(data.decisions, handSet, options);
    printFitReport(report);
    if (write) {
        writeWeights(
            weightsPath, report.weights,
            `fitted by fitWeights.ts (ticket 177c): ${report.fights.train} fights / ${report.decisions.train} decisions, `
            + `held-out top-1 agreement with full ${pct(report.agreement.heldOutTop1)}`,
        );
        console.log(`\nWrote ${weightsPath}`);
    }
    return report;
}
