/**
 * TICKET 177c — RECORD WHAT THE FULL AI CHOOSES.
 *
 * Both sides play on `full`. At every decision this writes down the legal actions, each action's
 * feature vector (177b), and which action `getBestAction` returned. That pairing — "among these,
 * the teacher took that one" — is the whole training set for `fitWeights.ts`.
 *
 * It is a re-implementation of `runBatch.runOne`'s loop and not a call to it, because `runOne`
 * calls `getBestAction` internally and a recorder has to stand between the state and the choice.
 * It keeps `runOne`'s rules so a recorded fight is the fight `runOne` would have played: the same
 * state build (`applyStatJitter`, then `buildScenarioState`), the same turn cap, the same
 * 250-action cap, the same "the reducer refused the AI's choice, so END_TURN" fallback.
 *
 * RESUMABLE AND SHARDABLE. A fight is a function of its index (`teacherFight`), a shard takes the
 * indices `shardOf(index, shards) === shard`, writes `results/cheap-ai/teacher-<shard>.jsonl`, and on start
 * skips the fights its file already finished. Kill it any time; run it again to carry on.
 *
 * `results/cheap-ai/` is generated data and is not committed (the folder keeps a self-ignoring
 * `.gitignore`).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { battleReducer, type BattleAction } from '../../../engine/battleReducer';
import { getBestAction } from '../../../engine/ai/TacticalAI';
import { featuresForLegalActions } from '../../../engine/ai/cheap/cheapPolicy';
import { FEATURE_NAMES } from '../../../engine/ai/cheap/features';
import type { IBattleState } from '../../../engine/types';
import { buildScenarioState } from '../../scenarios/buildScenarioState';
import { applyStatJitter, DEFAULT_MAX_TURNS } from '../runBatch';
import { shardOf, teacherFight, type TeacherFightSpec } from './teacherFights';
import {
    actionKey, assertSameFeatures, decisionLine, doneLine, metaLine, parseTeacherText,
    type FightDone, type TeacherDecision,
} from './teacherData';

/** `runBatch.MAX_ACTIONS_PER_TURN`, which it does not export. */
const MAX_ACTIONS_PER_TURN = 250;

export interface RecordedFight {
    readonly decisions: TeacherDecision[];
    readonly done: FightDone;
}

const anyAlive = (party: IBattleState['playerParty']): boolean => party.some((e) => e.currentHp > 0);

/** Play one fight with the full AI on both sides and return every decision in it. */
export function recordFight(spec: TeacherFightSpec): RecordedFight {
    const started = Date.now();
    let state: IBattleState = buildScenarioState(
        { ...applyStatJitter(spec.setup, spec.seed), seed: spec.seed }, spec.startingSide,
    );
    const decisions: TeacherDecision[] = [];
    let actionsThisTurn = 0;
    let turnFingerprint = `${state.turn}:${state.activeSide}`;

    for (;;) {
        const playerAlive = anyAlive(state.playerParty);
        const enemyAlive = anyAlive(state.enemyParty);
        if (!playerAlive || !enemyAlive || state.turn > DEFAULT_MAX_TURNS) break;

        const side = state.activeSide;
        const action: BattleAction = getBestAction(state);
        const chosenKey = actionKey(action);
        if (chosenKey !== null) {
            const rows = featuresForLegalActions(state, side);
            const keys = rows.map((r) => actionKey(r.action) ?? '');
            const chosen = keys.indexOf(chosenKey);
            // A choice the enumeration did not list cannot be learned from. It does not happen on
            // `full`; counting it rather than throwing keeps a recording alive if it ever does.
            if (chosen >= 0) {
                decisions.push({
                    fight: spec.index, turn: state.turn, side, chosen, keys,
                    features: rows.map((r) => FEATURE_NAMES.map((name) => r.features[name])),
                });
            }
        }

        const next = battleReducer(state, action);
        if (next === state) {
            const forced = battleReducer(state, { type: 'END_TURN' });
            if (forced === state) break;
            state = forced;
        } else {
            state = next;
        }

        const fingerprint = `${state.turn}:${state.activeSide}`;
        if (fingerprint === turnFingerprint) {
            actionsThisTurn += 1;
            if (actionsThisTurn > MAX_ACTIONS_PER_TURN) break;
        } else {
            turnFingerprint = fingerprint;
            actionsThisTurn = 0;
        }
    }

    const winner = !anyAlive(state.playerParty) && !anyAlive(state.enemyParty) ? 'DRAW'
        : !anyAlive(state.playerParty) ? 'ENEMY'
            : !anyAlive(state.enemyParty) ? 'PLAYER' : 'UNDECIDED';
    return {
        decisions,
        done: { fight: spec.index, decisions: decisions.length, winner, turns: state.turn, ms: Date.now() - started },
    };
}

export interface RecordOptions {
    /** Total fights across all shards. Default 2,000. */
    readonly fights: number;
    readonly shard: number;
    readonly shards: number;
    /** Output directory. Default `results/cheap-ai`. */
    readonly outDir: string;
    readonly log?: (line: string) => void;
}

export const DEFAULT_FIGHTS = 2000;
export const DEFAULT_OUT_DIR = 'results/cheap-ai';

/** Fight indices already finished in a shard file, so a restart skips them. */
export function finishedFights(path: string): Set<number> {
    if (!existsSync(path)) return new Set();
    return new Set(parseTeacherText(readFileSync(path, 'utf8')).done.map((d) => d.fight));
}

/** Record this shard's fights, appending a finished fight at a time. Returns how many it recorded. */
export function recordShard(options: RecordOptions): number {
    const log = options.log ?? ((line: string) => console.error(line));
    mkdirSync(options.outDir, { recursive: true });
    // The data is large and regenerable: keep it out of git without touching the repo's .gitignore.
    const ignore = join(options.outDir, '.gitignore');
    if (!existsSync(ignore)) writeFileSync(ignore, '*\n');

    const path = join(options.outDir, `teacher-${options.shard}.jsonl`);
    // A file is only ever appended to by the SAME feature list that started it: its numbers mean
    // nothing under another one. A new file gets the list as its first line.
    if (!existsSync(path)) appendFileSync(path, metaLine() + '\n');
    else assertSameFeatures(readFileSync(path, 'utf8'), path);
    const skip = finishedFights(path);
    const mine: number[] = [];
    for (let i = 0; i < options.fights; i += 1) if (shardOf(i, options.shards) === options.shard && !skip.has(i)) mine.push(i);

    log(`[teacher ${options.shard}/${options.shards}] ${mine.length} fights to record (${skip.size} already in ${path})`);
    const began = Date.now();
    let recorded = 0;
    for (const index of mine) {
        const spec = teacherFight(index);
        const { decisions, done } = recordFight(spec);
        const text = decisions.map(decisionLine).join('\n') + (decisions.length ? '\n' : '') + doneLine(done) + '\n';
        appendFileSync(path, text);
        recorded += 1;
        if (recorded % 10 === 0 || recorded === mine.length) {
            const per = (Date.now() - began) / recorded / 1000;
            log(`[teacher ${options.shard}/${options.shards}] ${recorded}/${mine.length} fights · ${per.toFixed(1)} s each · `
                + `last: #${index} ${spec.name} → ${done.winner} in ${done.turns} turns, ${done.decisions} decisions`);
        }
    }
    return recorded;
}
