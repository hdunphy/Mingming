/**
 * TICKET 177c — WHAT A RECORDED DECISION LOOKS LIKE ON DISK, AND HOW IT IS READ BACK.
 *
 * One JSON object per line. Two kinds:
 *
 *   {"k":"d","f":12,"t":3,"s":"P","c":4,"a":["p1>e1:h3",…,"END_TURN"],"x":[[…14 numbers…],…]}
 *       a DECISION: fight index, turn, acting side, the index of the action the full AI chose, the
 *       legal actions (in `legalActions` order, reducer no-ops already dropped), and one feature row
 *       per action in `FEATURE_NAMES` order.
 *
 *   {"k":"done","f":12,"n":31,"w":"PLAYER","t":9,"ms":41234}
 *       a FIGHT FINISHED: written in the SAME append as the fight's decisions, so a file never holds
 *       half a fight, and "which fights are done" is "which fights have a `done` line".
 *
 * A file's FIRST line is {"k":"meta","features":[…names…]}: the feature list its numbers are in. The
 * numbers mean nothing under a different list, so a reader that finds another one stops with a clear
 * message instead of fitting noise.
 *
 * Action keys are `source>target:card` (instance ids) or `END_TURN`. They are enough to replay a
 * fight from its index (`teacherFight`) by applying each chosen action in turn, which is how 177d
 * asks `greedy` and `lite` what they would have chosen at the same states.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BattleAction } from '../../../engine/battleReducer';
import { FEATURE_NAMES } from '../../../engine/ai/cheap/features';

export interface TeacherDecision {
    readonly fight: number;
    readonly turn: number;
    readonly side: 'PLAYER' | 'ENEMY';
    readonly chosen: number;
    readonly keys: ReadonlyArray<string>;
    /** One row per key, `FEATURE_NAMES.length` numbers each. */
    readonly features: ReadonlyArray<ReadonlyArray<number>>;
}

export interface FightDone {
    readonly fight: number;
    readonly decisions: number;
    readonly winner: string;
    readonly turns: number;
    readonly ms: number;
}

export function actionKey(action: BattleAction): string | null {
    if (action.type === 'END_TURN') return 'END_TURN';
    if (action.type === 'PLAY_PROGRAM') {
        return `${action.payload.sourceId}>${action.payload.targetId}:${action.payload.programId}`;
    }
    return null;
}

export function actionFromKey(key: string): BattleAction {
    if (key === 'END_TURN') return { type: 'END_TURN' };
    const match = /^(.+)>(.+):([^:]+)$/.exec(key);
    if (!match) throw new Error(`[teacherData] not an action key: ${key}`);
    return { type: 'PLAY_PROGRAM', payload: { sourceId: match[1], targetId: match[2], programId: match[3] } };
}

const round = (n: number): number => Number(n.toFixed(5));

export function decisionLine(d: TeacherDecision): string {
    return JSON.stringify({
        k: 'd', f: d.fight, t: d.turn, s: d.side === 'PLAYER' ? 'P' : 'E', c: d.chosen,
        a: d.keys, x: d.features.map((row) => row.map(round)),
    });
}

/** The first line of every file: which features the rows are in, so stale data cannot be misread. */
export function metaLine(): string {
    return JSON.stringify({ k: 'meta', features: FEATURE_NAMES });
}

/** Throws when a file's meta line is missing or names a different feature list than this build's. */
export function assertSameFeatures(text: string, label: string): void {
    const first = text.split('\n', 1)[0];
    let features: unknown;
    try {
        features = (JSON.parse(first) as { features?: unknown }).features;
    } catch {
        features = undefined;
    }
    if (JSON.stringify(features) !== JSON.stringify(FEATURE_NAMES)) {
        throw new Error(
            `[teacherData] ${label} was recorded with a different feature list than this build's `
            + `(${JSON.stringify(features)} vs ${JSON.stringify(FEATURE_NAMES)}). Re-record it or move it aside.`,
        );
    }
}

export function doneLine(d: FightDone): string {
    return JSON.stringify({ k: 'done', f: d.fight, n: d.decisions, w: d.winner, t: d.turns, ms: d.ms });
}

export interface TeacherFile {
    readonly decisions: TeacherDecision[];
    readonly done: FightDone[];
}

/** Parse one JSONL document. A decision whose fight has no `done` line is dropped (a cut-off write). */
export function parseTeacherText(text: string): TeacherFile {
    const decisions: TeacherDecision[] = [];
    const done: FightDone[] = [];
    const finished = new Set<number>();
    const rows: TeacherDecision[] = [];
    for (const line of text.split('\n')) {
        if (line.trim() === '') continue;
        let obj: Record<string, unknown>;
        try {
            obj = JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue; // a half-written final line
        }
        if (obj.k === 'done') {
            finished.add(obj.f as number);
            done.push({ fight: obj.f as number, decisions: obj.n as number, winner: obj.w as string, turns: obj.t as number, ms: obj.ms as number });
        } else if (obj.k === 'd') {
            rows.push({
                fight: obj.f as number, turn: obj.t as number, side: obj.s === 'P' ? 'PLAYER' : 'ENEMY',
                chosen: obj.c as number, keys: obj.a as string[], features: obj.x as number[][],
            });
        }
    }
    for (const row of rows) if (finished.has(row.fight)) decisions.push(row);
    return { decisions, done };
}

/** Every `teacher-<n>.jsonl` in `dir`, in file-name order. Empty when the directory does not exist. */
export function readTeacherDir(dir: string): TeacherFile {
    if (!existsSync(dir)) return { decisions: [], done: [] };
    const decisions: TeacherDecision[] = [];
    const done: FightDone[] = [];
    for (const name of readdirSync(dir).filter((f) => /^teacher-\d+\.jsonl$/.test(f)).sort()) {
        const text = readFileSync(join(dir, name), 'utf8');
        assertSameFeatures(text, join(dir, name));
        const parsed = parseTeacherText(text);
        decisions.push(...parsed.decisions);
        done.push(...parsed.done);
    }
    return { decisions, done };
}

/** Sanity check used by the readers: a row is as wide as the feature list. */
export function assertWidth(d: TeacherDecision): void {
    for (const row of d.features) {
        if (row.length !== FEATURE_NAMES.length) {
            throw new Error(`[teacherData] fight ${d.fight}: a feature row has ${row.length} numbers, expected ${FEATURE_NAMES.length}.`);
        }
    }
}

/**
 * Which side of the 80/20 split a fight is on. By FIGHT, never by decision, so the held-out set is
 * fights the fit has not seen any decision of. Hashed rather than `% 5`, because the fight list is a
 * ten-fight cycle and a modulus would put the same KIND of fight in the held-out set every time.
 */
export function isHeldOut(fight: number): boolean {
    let h = (Math.imul(fight + 1, 0x9e3779b1) >>> 0);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return h % 5 === 0;
}
