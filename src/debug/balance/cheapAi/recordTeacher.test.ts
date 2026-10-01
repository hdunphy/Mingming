/**
 * TICKET 177c — the recorder writes down what the full AI does, and a recording can be replayed.
 *
 * Only 1v1 fights here (a tenth of a second each): the 3v3 ones cost the full AI minutes, and the
 * recorder's logic does not change with the size of the fight.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { battleReducer } from '../../../engine/battleReducer';
import { getBestAction } from '../../../engine/ai/TacticalAI';
import { featuresForLegalActions } from '../../../engine/ai/cheap/cheapPolicy';
import { FEATURE_NAMES } from '../../../engine/ai/cheap/features';
import { buildScenarioState } from '../../scenarios/buildScenarioState';
import { applyStatJitter } from '../runBatch';
import { recordFight, recordShard } from './recordTeacher';
import { actionFromKey, actionKey, parseTeacherText, readTeacherDir } from './teacherData';
import { teacherFight } from './teacherFights';

describe('177c — recordFight', () => {
    const spec = teacherFight(0);
    const recorded = recordFight(spec);

    it('records every decision with a feature row per legal action and the full AI\'s choice', () => {
        expect(spec.kind).toBe('1v1-ea');
        expect(recorded.decisions.length).toBeGreaterThan(3);
        for (const d of recorded.decisions) {
            expect(d.keys.length).toBe(d.features.length);
            expect(d.keys[d.keys.length - 1]).toBe('END_TURN');
            expect(d.chosen).toBeGreaterThanOrEqual(0);
            expect(d.chosen).toBeLessThan(d.keys.length);
            for (const row of d.features) expect(row).toHaveLength(FEATURE_NAMES.length);
        }
        expect(recorded.done.decisions).toBe(recorded.decisions.length);
        expect(['PLAYER', 'ENEMY', 'DRAW']).toContain(recorded.done.winner);
    });

    it('can be replayed from its index: each recorded choice is what getBestAction returns at that state', () => {
        let state = buildScenarioState({ ...applyStatJitter(spec.setup, spec.seed), seed: spec.seed }, spec.startingSide);
        for (const d of recorded.decisions) {
            expect(state.activeSide).toBe(d.side);
            expect(state.turn).toBe(d.turn);
            const rows = featuresForLegalActions(state, d.side);
            expect(rows.map((r) => actionKey(r.action))).toEqual(d.keys);
            // The teacher's choice, asked again at the replayed state, is the recorded one.
            const teacher = getBestAction(state);
            expect(teacher).toEqual(actionFromKey(d.keys[d.chosen]));
            state = battleReducer(state, teacher);
        }
    });
});

describe('177c — recordShard', () => {
    it('writes a meta line and finished fights, and a second run records nothing it already has', () => {
        const dir = mkdtempSync(join(tmpdir(), 'teacher177-'));
        try {
            const first = recordShard({ fights: 3, shard: 0, shards: 1, outDir: dir, log: () => {} });
            expect(first).toBe(3);
            const text = readFileSync(join(dir, 'teacher-0.jsonl'), 'utf8');
            expect(text.split('\n')[0]).toContain('"k":"meta"');
            const parsed = parseTeacherText(text);
            expect(parsed.done.map((d) => d.fight)).toEqual([0, 1, 2]);
            expect(parsed.decisions.length).toBe(parsed.done.reduce((a, d) => a + d.decisions, 0));

            // Resumed: nothing left to do. Extended: only the new fight.
            expect(recordShard({ fights: 3, shard: 0, shards: 1, outDir: dir, log: () => {} })).toBe(0);
            expect(recordShard({ fights: 4, shard: 0, shards: 1, outDir: dir, log: () => {} })).toBe(1);
            expect(readTeacherDir(dir).done.map((d) => d.fight)).toEqual([0, 1, 2, 3]);

            // The data folder keeps itself out of git.
            expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('*\n');
        } finally {
            rmSync(dir, { recursive: true, force: true });
            expect(existsSync(dir)).toBe(false);
        }
    });
});
