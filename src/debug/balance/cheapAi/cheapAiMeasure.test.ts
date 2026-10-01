/**
 * TICKET 177d — the measurement's arithmetic, its replay, and the report's layout.
 *
 * Statistics are checked against numbers worked out by hand; the replay against the property that
 * makes it a measurement at all (the teacher, asked again at a replayed state, names its own
 * recorded action); the report against the verdict it must print for a made-up result either way.
 */
import { describe, it, expect } from 'vitest';
import { meanInterval, percentile, summariseTimings, wilson } from './cheapAiStats';
import {
    ARMS, agreementTable, diagnostics, measurementUnits, pairedDifference, replayFights, replayUnit, speedTable,
    strengthMatchups, strengthTable, strengthUnit, verdict, SMOKE_SIZES, DEFAULT_SIZES,
    type ReplayUnit, type StrengthGame, type Tier,
} from './cheapAiMeasure';
import { renderCheapAiReport } from './cheapAiReport';
import { recordFight } from './recordTeacher';
import { teacherFight } from './teacherFights';
import { cheapWeights, cheapWeightsFile } from '../../../engine/ai/cheap/weights';
import { FEATURE_NAMES } from '../../../engine/ai/cheap/features';

describe('177d — statistics', () => {
    it('wilson: 50 of 100 is 40.4% to 59.6%, a sweep of nothing is empty, a half win counts half', () => {
        const i = wilson(50, 100);
        expect(i.estimate).toBe(0.5);
        expect(i.lo).toBeCloseTo(0.4038, 3);
        expect(i.hi).toBeCloseTo(0.5962, 3);
        expect(wilson(0, 0).n).toBe(0);
        expect(wilson(1.5, 3).estimate).toBe(0.5);
        expect(wilson(0, 10).lo).toBe(0);
        expect(wilson(10, 10).hi).toBeCloseTo(1, 12);
    });

    it('meanInterval: [1,2,3] is 2 with a half-width of 1.96 / sqrt(3)', () => {
        const i = meanInterval([1, 2, 3]);
        expect(i.estimate).toBe(2);
        expect(i.hi - i.estimate).toBeCloseTo(1.959964 / Math.sqrt(3), 5);
        expect(meanInterval([4]).lo).toBe(4);
    });

    it('percentile is nearest-rank, and the timing summary is mean and p95', () => {
        const hundred = Array.from({ length: 100 }, (_, k) => k + 1);
        expect(percentile(hundred, 0.95)).toBe(95);
        expect(percentile([], 0.95)).toBe(0);
        const t = summariseTimings(hundred);
        expect(t.mean).toBe(50.5);
        expect(t.p95).toBe(95);
    });
});

const game = (arm: Tier, cls: StrengthGame['cls'], seed: string, side: 'PLAYER' | 'ENEMY', score: number): StrengthGame => (
    { arm, cls, matchup: `${cls}:0`, seed, side, score, turns: 3 }
);

describe('177d — strength and the verdict', () => {
    // Four games per arm in 1v1 and in 3v3. cheap wins 1 of 4 / 2 of 4; lite wins 2 of 4 / 2 of 4.
    const games: StrengthGame[] = [];
    const pattern: Record<Tier, Record<'1v1' | '3v3', number[]>> = {
        cheap: { '1v1': [1, 0, 0, 0], '3v3': [1, 1, 0, 0] },
        lite: { '1v1': [1, 1, 0, 0], '3v3': [1, 1, 0, 0] },
        greedy: { '1v1': [0, 0, 0, 0], '3v3': [0, 0, 0, 1] },
        full: { '1v1': [1, 0, 1, 0], '3v3': [0.5, 0.5, 0.5, 0.5] },
    };
    for (const arm of ARMS) {
        for (const cls of ['1v1', '3v3'] as const) {
            pattern[arm][cls].forEach((score, k) => games.push(game(arm, cls, `s${k}`, k % 2 === 0 ? 'PLAYER' : 'ENEMY', score)));
        }
    }

    it('win rate per class and class-averaged', () => {
        const rows = strengthTable(games);
        const rate = (arm: Tier, cls: string) => rows.find((r) => r.arm === arm && r.cls === cls)!.rate.estimate;
        expect(rate('cheap', '1v1')).toBe(0.25);
        expect(rate('cheap', '3v3')).toBe(0.5);
        expect(rate('cheap', 'all')).toBeCloseTo(0.375, 10);
        expect(rate('lite', 'all')).toBe(0.5);
        expect(rows.some((r) => r.cls === '2v2')).toBe(false); // no 2v2 games, no 2v2 row
    });

    it('pairs cheap with lite on the same games', () => {
        const diff = pairedDifference(games, 'cheap', 'lite');
        const all = diff.find((d) => d.cls === 'all')!;
        expect(diff.find((d) => d.cls === '1v1')!.diff.estimate).toBe(-0.25);
        expect(diff.find((d) => d.cls === '3v3')!.diff.estimate).toBe(0);
        expect(all.diff.estimate).toBeCloseTo(-0.125, 10);
    });

    const unit = (cls: '1v1' | '3v3', ms: number[]): ReplayUnit => ({
        fight: 1, cls,
        decisions: [{ cls, teacherEnds: false, agree: [1, 1, 0, 1], ms, cheapEnds: false }],
    });

    it('the verdict needs both: at least lite\'s win rate AND 10x faster at 1v1 and 3v3', () => {
        const strength = strengthTable(games);
        // cheap 0.375 < lite 0.5 -> strength missed, whatever the speed.
        const fast = speedTable([unit('1v1', [1, 20, 10, 40]), unit('3v3', [10, 400, 200, 800])]);
        const missed = verdict(strength, fast);
        expect(missed.strengthMet).toBe(false);
        expect(missed.speedMet).toBe(true);
        expect(missed.met).toBe(false);
        expect(missed.line).toContain('C2 BAR MISSED');
        expect(missed.speedup['1v1']).toBe(20);
        expect(missed.speedup['3v3']).toBe(40);

        // Strong enough, but only 5x faster at 1v1: still missed.
        const strongGames = games.map((g) => (g.arm === 'cheap' ? { ...g, score: 1 } : g));
        const slow1v1 = speedTable([unit('1v1', [4, 20, 10, 40]), unit('3v3', [10, 400, 200, 800])]);
        const v = verdict(strengthTable(strongGames), slow1v1);
        expect(v.strengthMet).toBe(true);
        expect(v.speedMet).toBe(false);
        expect(v.met).toBe(false);

        const ok = verdict(strengthTable(strongGames), fast);
        expect(ok.met).toBe(true);
        expect(ok.line).toContain('C2 BAR MET');
    });

    it('agreement and diagnostics read the replay units', () => {
        const units: ReplayUnit[] = [{
            fight: 1, cls: '1v1',
            decisions: [
                { cls: '1v1', teacherEnds: false, agree: [0, 1, 1, 1], ms: [1, 2, 3, 4], cheapEnds: true, gap: FEATURE_NAMES.map((_, k) => (k === 0 ? 2 : 0)) },
                { cls: '1v1', teacherEnds: false, agree: [1, 1, 1, 1], ms: [1, 2, 3, 4], cheapEnds: false },
            ],
        }];
        const a = agreementTable(units);
        expect(a.find((r) => r.tier === 'cheap' && r.cls === 'all')!.rate.estimate).toBe(0.5);
        expect(a.find((r) => r.tier === 'full' && r.cls === 'all')!.rate.estimate).toBe(1);
        const d = diagnostics(units);
        expect(d.disagreements).toBe(1);
        expect(d.cheapEndsTeacherPlays).toBe(1);
        expect(d.gaps[0].feature).toBe(FEATURE_NAMES[0]);
    });
});

describe('177d — the units', () => {
    it('the default sizing names every ordered EA pair once, and 2v2 and 3v3 matchups of both kinds', () => {
        const defs = strengthMatchups(DEFAULT_SIZES);
        expect(defs.filter((d) => d.cls === '1v1')).toHaveLength(132);
        expect(defs.filter((d) => d.cls === '2v2')).toHaveLength(DEFAULT_SIZES.matchups2v2);
        expect(defs.filter((d) => d.cls === '3v3')).toHaveLength(DEFAULT_SIZES.matchups3v3);
        expect(new Set(defs.map((d) => teacherFight(d.fight).name)).size).toBe(defs.length);
        expect(new Set(defs.filter((d) => d.cls === '3v3').map((d) => teacherFight(d.fight).kind)).size).toBe(2);
    });

    it('replays only held-out fights, a fixed number per class, in fight order', () => {
        const finished = Array.from({ length: 400 }, (_, k) => k);
        const picked = replayFights(finished, { ...DEFAULT_SIZES, replay: { '1v1': 5, '2v2': 2, '3v3': 1 } });
        expect(picked).toEqual([...picked].sort((a, b) => a - b));
        const counts = { '1v1': 0, '2v2': 0, '3v3': 0 };
        for (const f of picked) counts[teacherFight(f).kind.slice(0, 3) as '1v1'] += 1;
        expect(counts).toEqual({ '1v1': 5, '2v2': 2, '3v3': 1 });
        expect(measurementUnits(finished, SMOKE_SIZES).filter((u) => u.kind === 'replay').length).toBe(2);
    });

    it('a strength unit plays every arm on both sides and scores in {0, 0.5, 1}', () => {
        const def = strengthMatchups(SMOKE_SIZES).find((d) => d.cls === '1v1')!;
        const games = strengthUnit(def);
        expect(games).toHaveLength(ARMS.length * 2 * def.seeds);
        for (const arm of ARMS) expect(games.filter((g) => g.arm === arm)).toHaveLength(2);
        for (const g of games) expect([0, 0.5, 1]).toContain(g.score);
    });

    it('a replay unit is faithful: the full AI names the recorded action at EVERY replayed state', () => {
        const spec = teacherFight(0);
        const recorded = recordFight(spec);
        const unit = replayUnit(0, recorded.decisions);
        expect(unit.decisions).toHaveLength(recorded.decisions.length);
        const fullIndex = ARMS.indexOf('full');
        for (const d of unit.decisions) {
            expect(d.agree[fullIndex]).toBe(1);
            for (const t of d.ms) expect(t).toBeGreaterThanOrEqual(0);
        }
        // Where cheap disagreed, a feature gap was recorded for it.
        for (const d of unit.decisions) if (d.agree[0] === 0) expect(d.gap === undefined || d.gap.length === FEATURE_NAMES.length).toBe(true);
    });
});

describe('177d — the report', () => {
    const games: StrengthGame[] = [];
    for (const arm of ARMS) for (const cls of ['1v1', '2v2', '3v3'] as const) {
        for (let k = 0; k < 4; k += 1) games.push(game(arm, cls, `s${k}`, k % 2 === 0 ? 'PLAYER' : 'ENEMY', arm === 'cheap' ? (k === 0 ? 1 : 0) : arm === 'full' ? (k % 2) : (k < 2 ? 1 : 0)));
    }
    const replay: ReplayUnit[] = (['1v1', '2v2', '3v3'] as const).map((cls) => ({
        fight: 1, cls,
        decisions: [
            { cls, teacherEnds: false, agree: [0, 1, 1, 1], ms: [1, 100, 50, 200], cheapEnds: true, gap: FEATURE_NAMES.map((_, k) => (k === 3 ? 1 : 0)) },
            { cls, teacherEnds: true, agree: [1, 1, 1, 1], ms: [1, 100, 50, 200], cheapEnds: true },
        ],
    }));

    const text = renderCheapAiReport({
        games, replay, weights: cheapWeights(), weightsSource: cheapWeightsFile().source,
        sizes: DEFAULT_SIZES, teacherFights: 123, generatedBy: 'test',
    });

    it('opens with the verdict line, shows the four tables and the weights, and ends in numbered decisions', () => {
        expect(text.split('\n')[2]).toMatch(/^\*\*C2 BAR (MET|MISSED):/);
        for (const heading of ['## 1. Agreement', '## 2. Strength', '## 3. Speed', '## 4. Verdict', '## 5. The weights']) {
            expect(text).toContain(heading);
        }
        expect(text).toContain('Cheap minus lite');
        expect(text).toContain('123 fights');
        expect(text).toMatch(/## Decisions and next steps\n\n1\. /);
        expect(text.endsWith('\n')).toBe(true);
    });

    it('a miss lists a next feature; a hit does not', () => {
        expect(text).toContain('C2 BAR MISSED');
        expect(text).toContain('## 6. If it missed');
        const winning = games.map((g) => (g.arm === 'cheap' ? { ...g, score: 1 } : g));
        const hit = renderCheapAiReport({
            games: winning, replay, weights: cheapWeights(), weightsSource: 'x', sizes: DEFAULT_SIZES, teacherFights: 1, generatedBy: 'test',
        });
        expect(hit).toContain('C2 BAR MET');
        expect(hit).not.toContain('## 6. If it missed');
    });

    it('is plain LF text', () => {
        expect(text.includes('\r')).toBe(false);
    });
});
