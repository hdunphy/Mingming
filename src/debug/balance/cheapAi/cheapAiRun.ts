/**
 * TICKET 177d — RUN THE MEASUREMENT, OR A SHARD OF IT, AND WRITE THE REPORT.
 *
 * The orchestration both entry points share: `cheapAi.balance.ts` (under `npm run balance`, which
 * runs everything in one process) and `runCheapAiMeasure.ts` (the command line, which can take one
 * shard of the units, or just one phase, or just write the report from what the cache holds).
 *
 * Needs the teacher recording (`results/cheap-ai/teacher-*.jsonl`): the replay units and the matchup
 * list come from it, and the recording's fight count goes in the report.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cheapWeights, cheapWeightsFile } from '../../../engine/ai/cheap/weights';
import { cachePath } from '../walkCache';
import { DEFAULT_OUT_DIR } from './recordTeacher';
import { readTeacherDir, type TeacherDecision } from './teacherData';
import { renderCheapAiReport } from './cheapAiReport';
import {
    DEFAULT_SIZES, measurementUnits, runUnit, type MeasureSizes, type ReplayUnit, type StrengthGame, type Unit,
} from './cheapAiMeasure';

export const REPORT_PATH = 'docs/balance/cheap-ai-177.md';

export interface RunOptions {
    readonly teacherDir?: string;
    readonly cacheDir?: string;
    readonly sizes?: MeasureSizes;
    /** Which units this process computes: `index % shards === shard`. */
    readonly shard?: number;
    readonly shards?: number;
    readonly phase?: 'strength' | 'replay' | 'both';
    readonly log?: (line: string) => void;
}

function loadTeacher(dir: string): { finished: number[]; decisionsOf: (fight: number) => TeacherDecision[] } {
    const data = readTeacherDir(dir);
    if (data.done.length === 0) {
        throw new Error(`[cheapAi] no recorded fights in ${dir}. Run runRecordTeacher.ts first (ticket 177c).`);
    }
    const byFight = new Map<number, TeacherDecision[]>();
    for (const d of data.decisions) {
        const list = byFight.get(d.fight);
        if (list) list.push(d); else byFight.set(d.fight, [d]);
    }
    return { finished: data.done.map((d) => d.fight), decisionsOf: (fight) => byFight.get(fight) ?? [] };
}

/** Compute this process's units (caching each one when `cacheDir` is set). Returns how many it ran. */
export function runUnits(options: RunOptions): number {
    const log = options.log ?? ((line: string) => console.error(line));
    const teacherDir = options.teacherDir ?? DEFAULT_OUT_DIR;
    const { finished, decisionsOf } = loadTeacher(teacherDir);
    const phase = options.phase ?? 'both';
    const shard = options.shard ?? 0;
    const shards = options.shards ?? 1;
    const units = measurementUnits(finished, options.sizes ?? DEFAULT_SIZES)
        .filter((u) => phase === 'both' || u.kind === phase);
    const mine = units.filter((_, i) => i % shards === shard);
    log(`[cheapAi ${shard}/${shards}] ${mine.length} of ${units.length} units (${phase}).`);
    let n = 0;
    const began = Date.now();
    for (const unit of mine) {
        const t = Date.now();
        runUnit(unit, decisionsOf, options.cacheDir);
        n += 1;
        log(`[cheapAi ${shard}/${shards}] ${n}/${mine.length} ${unit.id} in ${((Date.now() - t) / 1000).toFixed(1)} s `
            + `(${((Date.now() - began) / 1000 / 60).toFixed(1)} min elapsed)`);
    }
    return n;
}

/** Units that have no result in the cache, by id. */
export function missingUnits(units: ReadonlyArray<Unit>, cacheDir: string): string[] {
    return units.filter((u) => !existsSync(cachePath(cacheDir, [u.kind, u.id]))).map((u) => u.id);
}

/** Read every unit (from the cache, computing any that are missing when `computeMissing`) and write the report. */
export function writeReport(options: RunOptions & { readonly computeMissing?: boolean; readonly path?: string }): string {
    const teacherDir = options.teacherDir ?? DEFAULT_OUT_DIR;
    const { finished, decisionsOf } = loadTeacher(teacherDir);
    const sizes = options.sizes ?? DEFAULT_SIZES;
    const units = measurementUnits(finished, sizes);
    if (options.cacheDir && !options.computeMissing) {
        const missing = missingUnits(units, options.cacheDir);
        if (missing.length > 0) {
            throw new Error(`[cheapAi] ${missing.length} unit(s) not measured yet, e.g. ${missing.slice(0, 3).join(', ')}.`);
        }
    }
    const games: StrengthGame[] = [];
    const replay: ReplayUnit[] = [];
    for (const unit of units) {
        const result = runUnit(unit, decisionsOf, options.cacheDir);
        if (unit.kind === 'strength') games.push(...(result as StrengthGame[]));
        else replay.push(result as ReplayUnit);
    }
    const text = renderCheapAiReport({
        games, replay, sizes,
        weights: cheapWeights(), weightsSource: cheapWeightsFile().source,
        teacherFights: finished.length,
        generatedBy: 'src/debug/balance/cheapAi/cheapAi.balance.ts (npm run balance), or runCheapAiMeasure.ts --report',
    });
    const path = options.path ?? REPORT_PATH;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text.endsWith('\n') ? text : text + '\n');
    return path;
}
