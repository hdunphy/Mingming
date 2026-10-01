/**
 * TICKET 177c — the fit finds a rule it is shown, and finds the same one twice.
 */
import { describe, it, expect } from 'vitest';
import { FEATURE_NAMES } from '../../../engine/ai/cheap/features';
import { DEFAULT_FIT_OPTIONS, fitSoftmax, top1Agreement, type FitDecision } from '../../../engine/ai/cheap/fitting';
import { fitReport, splitDecisions } from './fitWeights';
import {
    actionFromKey, assertSameFeatures, decisionLine, doneLine, isHeldOut, metaLine, parseTeacherText, type TeacherDecision,
} from './teacherData';
import { CYCLE_LENGTH, shardOf, teacherFight } from './teacherFights';
import { cheapWeights } from '../../../engine/ai/cheap/weights';

/** A tiny seeded generator, so the synthetic data is the same on every run. */
function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

const KILLS = FEATURE_NAMES.indexOf('enemyKills');

/**
 * Six actions per decision. Every feature is noise in [0, 1), except `enemyKills`, which is 1 on
 * exactly one action and 0 on the others: the teacher always picks that one.
 */
function syntheticDecisions(count: number, seed: number, fightOffset = 0): TeacherDecision[] {
    const next = lcg(seed);
    const out: TeacherDecision[] = [];
    for (let i = 0; i < count; i += 1) {
        const kill = Math.floor(next() * 6);
        const features = Array.from({ length: 6 }, (_, j) => (
            FEATURE_NAMES.map((_name, k) => (k === KILLS ? (j === kill ? 1 : 0) : next()))
        ));
        out.push({
            fight: fightOffset + i, turn: 1, side: 'PLAYER', chosen: kill,
            keys: features.map((_, j) => `k${j}`), features,
        });
    }
    return out;
}

describe('177c — fitSoftmax', () => {
    it('gives enemyKills the largest weight and ≥95% held-out agreement when the teacher always takes the kill', () => {
        const all = syntheticDecisions(1500, 7);
        const { train, heldOut } = splitDecisions(all);
        expect(train.length).toBeGreaterThan(heldOut.length);
        expect(heldOut.length).toBeGreaterThan(100);

        const fit = fitSoftmax(train.map((d) => ({ features: d.features, chosen: d.chosen })));
        const biggest = FEATURE_NAMES[fit.weights.reduce((best, w, k) => (Math.abs(w) > Math.abs(fit.weights[best]) ? k : best), 0)];
        expect(biggest).toBe('enemyKills');
        expect(top1Agreement(heldOut.map((d) => ({ features: d.features, chosen: d.chosen })), fit.weights)).toBeGreaterThanOrEqual(0.95);
    });

    it('is deterministic: the same data and options give bit-identical weights', () => {
        const data: FitDecision[] = syntheticDecisions(400, 11).map((d) => ({ features: d.features, chosen: d.chosen }));
        const a = fitSoftmax(data);
        const b = fitSoftmax(data);
        expect(b.weights).toEqual(a.weights);
        expect(b.trainLoss).toBe(a.trainLoss);
    });

    it('reports a lower training loss than the all-zero weights', () => {
        const data: FitDecision[] = syntheticDecisions(300, 3).map((d) => ({ features: d.features, chosen: d.chosen }));
        const fit = fitSoftmax(data, { ...DEFAULT_FIT_OPTIONS, iterations: 200 });
        expect(fit.trainLoss).toBeLessThan(Math.log(6));
    });

    it('fitReport splits by fight and compares against the baselines', () => {
        const report = fitReport(syntheticDecisions(1200, 5), cheapWeights());
        expect(report.decisions.heldOut).toBeGreaterThan(0);
        expect(report.agreement.heldOutTop1).toBeGreaterThanOrEqual(0.95);
        expect(report.agreement.handSetHeldOutTop1).toBeLessThan(report.agreement.heldOutTop1);
    });
});

describe('177c — the recording format and the fight list', () => {
    it('a decision survives a round trip through its JSONL line; a fight with no done line is dropped', () => {
        const d: TeacherDecision = {
            fight: 3, turn: 2, side: 'ENEMY', chosen: 1, keys: ['p1>e1:h0', 'END_TURN'],
            features: [FEATURE_NAMES.map((_, k) => k / 10), FEATURE_NAMES.map(() => 0)],
        };
        const text = [
            decisionLine(d),
            doneLine({ fight: 3, decisions: 1, winner: 'PLAYER', turns: 4, ms: 5 }),
            decisionLine({ ...d, fight: 4 }),          // no done line for fight 4
            '{"k":"d","f":5',                           // a cut-off write
        ].join('\n');
        const parsed = parseTeacherText(text);
        expect(parsed.decisions).toEqual([d]);
        expect(parsed.done).toHaveLength(1);
    });

    it('action keys round-trip', () => {
        expect(actionFromKey('END_TURN')).toEqual({ type: 'END_TURN' });
        expect(actionFromKey('p1>e2:card_17')).toEqual(
            { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e2', programId: 'card_17' } },
        );
    });

    it('the held-out split is by fight and takes about a fifth of them, whatever the cycle', () => {
        const held = Array.from({ length: 2000 }, (_, i) => isHeldOut(i)).filter(Boolean).length;
        expect(held).toBeGreaterThan(300);
        expect(held).toBeLessThan(500);
        // Every kind of fight in the ten-fight cycle appears on both sides of the split.
        for (let slot = 0; slot < 10; slot += 1) {
            const inSlot = Array.from({ length: 200 }, (_, r) => isHeldOut(r * 10 + slot));
            expect(inSlot.some(Boolean), `slot ${slot} has held-out fights`).toBe(true);
            expect(inSlot.some((h) => !h), `slot ${slot} has training fights`).toBe(true);
        }
    });

    it('the fight list covers every ordered EA pair and is a pure function of the index', () => {
        const names = new Set<string>();
        for (let i = 0; i < 400; i += 1) {
            const spec = teacherFight(i);
            expect(teacherFight(i).name).toBe(spec.name);
            if (spec.kind === '1v1-ea') names.add(spec.name);
        }
        expect(names.size).toBe(132);
    });

    it('every kind of fight turns up in the first ten', () => {
        const kinds = new Set(Array.from({ length: 10 }, (_, i) => teacherFight(i).kind));
        expect([...kinds].sort()).toEqual(['1v1-boss', '1v1-ea', '2v2-boss', '2v2-ea', '3v3-boss', '3v3-ea']);
    });

    it('shards partition the fights, and each shard gets every kind of fight', () => {
        for (const shards of [2, 3]) {
            const seen = new Map<number, number>();
            for (let i = 0; i < 400; i += 1) seen.set(shardOf(i, shards), (seen.get(shardOf(i, shards)) ?? 0) + 1);
            expect([...seen.keys()].sort()).toEqual(Array.from({ length: shards }, (_, k) => k));
            for (let shard = 0; shard < shards; shard += 1) {
                const kinds = new Set<string>();
                for (let i = 0; i < CYCLE_LENGTH * 6; i += 1) if (shardOf(i, shards) === shard) kinds.add(teacherFight(i).kind);
                expect(kinds.size, `shard ${shard} of ${shards}`).toBe(6);
            }
        }
    });

    it('a file recorded with another feature list is refused', () => {
        expect(() => assertSameFeatures(metaLine() + '\n', 'ok.jsonl')).not.toThrow();
        expect(() => assertSameFeatures('{"k":"meta","features":["a"]}\n', 'old.jsonl')).toThrow(/different feature list/);
        expect(() => assertSameFeatures('', 'empty.jsonl')).toThrow(/different feature list/);
    });
});
