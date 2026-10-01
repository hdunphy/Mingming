/**
 * TICKET 177d — MEASURE THE CHEAP AI AGAINST THE FULL ONE, AND AGAINST `lite` AND `greedy`.
 *
 * Three questions, one unit of work each, every unit cached on disk when a cache directory is given
 * so a long measurement can be stopped, resumed and split across two processes:
 *
 *  1. AGREEMENT (`replayUnit`). Take fights the teacher recorded and the fit never saw, replay each
 *     from its index by applying the teacher's own choices, and at every state ask each tier what it
 *     would play. How often does it name the teacher's action? `full` must name it every time (the
 *     teacher IS `full`), which doubles as proof the replay is faithful.
 *  2. SPEED (the same units). The same call, timed, on the same states, so the tiers are compared
 *     on identical positions. Mean and 95th percentile milliseconds per decision, per fight size.
 *  3. STRENGTH (`strengthUnit`). A tier plays the PLAYER side against `full` on the ENEMY side, over
 *     the 177c matchups on fresh seeds, both sides moving first (the paired harness's two
 *     orientations), the same games for every tier. A win is a point, a draw half a point.
 *
 * WHAT THE BAR IS. Fixed here, before any number exists (ticket 177 C2): the cheap AI qualifies when
 * its win rate against `full` is at least `lite`'s win rate against `full` on the same games, AND it
 * is at least 10 times faster per decision than `lite`. "Its win rate" is the average of the three
 * fight-size classes' win rates (1v1, 2v2, 3v3), each class counting equally, because the games
 * are mostly 1v1 and a pooled number would be a 1v1 number. "10 times faster" has to hold at 1v1
 * AND at 3v3, mean milliseconds per decision. The report prints every number the verdict compares.
 * It never tunes toward the bar.
 */

import { getBestAction } from '../../../engine/ai/TacticalAI';
import { battleReducer } from '../../../engine/battleReducer';
import { featuresForLegalActions } from '../../../engine/ai/cheap/cheapPolicy';
import { FEATURE_NAMES } from '../../../engine/ai/cheap/features';
import type { AiTier } from '../../../engine/ai/TacticalAI';
import type { IBattleState } from '../../../engine/types';
import { buildScenarioState } from '../../scenarios/buildScenarioState';
import { cached } from '../walkCache';
import { applyStatJitter, DEFAULT_MAX_TURNS, runOne } from '../runBatch';
import { actionFromKey, actionKey, isHeldOut, type TeacherDecision } from './teacherData';
import { teacherFight, type FightKind } from './teacherFights';
import { meanInterval, summariseTimings, wilson, type Interval, type TimingSummary } from './cheapAiStats';

export type Tier = Extract<AiTier, 'cheap' | 'lite' | 'greedy' | 'full'>;
export type SizeClass = '1v1' | '2v2' | '3v3';

/** The four arms, in the order the report prints them. `full` against `full` is the baseline. */
export const ARMS: ReadonlyArray<Tier> = ['cheap', 'lite', 'greedy', 'full'];
export const SIZE_CLASSES: ReadonlyArray<SizeClass> = ['1v1', '2v2', '3v3'];

const classOf = (kind: FightKind): SizeClass => kind.slice(0, 3) as SizeClass;

// ───────────────────────────── strength ─────────────────────────────

export interface MatchupDef {
    readonly id: string;
    readonly cls: SizeClass;
    /** The `teacherFight` index whose setup this matchup borrows; the seeds are new. */
    readonly fight: number;
    readonly seeds: number;
}

export interface MeasureSizes {
    /** 1v1: how many seeds per matchup (every one of the 132 ordered EA pairs is a matchup). */
    readonly seeds1v1: number;
    readonly matchups2v2: number;
    readonly seeds2v2: number;
    readonly matchups3v3: number;
    readonly seeds3v3: number;
    /** Held-out fights replayed for agreement and speed, per size class. */
    readonly replay: Readonly<Record<SizeClass, number>>;
}

export const DEFAULT_SIZES: MeasureSizes = {
    seeds1v1: 4,
    matchups2v2: 32,
    seeds2v2: 2,
    matchups3v3: 12,
    seeds3v3: 1,
    replay: { '1v1': 40, '2v2': 12, '3v3': 8 },
};

/** A small sizing for tests: a handful of the cheap fights. */
export const SMOKE_SIZES: MeasureSizes = {
    seeds1v1: 1, matchups2v2: 1, seeds2v2: 1, matchups3v3: 0, seeds3v3: 1,
    replay: { '1v1': 2, '2v2': 0, '3v3': 0 },
};

export function strengthMatchups(sizes: MeasureSizes, only1v1Limit = Infinity): MatchupDef[] {
    const defs: MatchupDef[] = [];
    const names = new Set<string>();
    // 1v1: the ordered EA pairs, in the order the teacher list walks them. 132 of them.
    for (let i = 0; names.size < 132 && i < 4000 && defs.length < only1v1Limit; i += 1) {
        const spec = teacherFight(i);
        if (spec.kind !== '1v1-ea' || names.has(spec.name)) continue;
        names.add(spec.name);
        defs.push({ id: `1v1:${i}`, cls: '1v1', fight: i, seeds: sizes.seeds1v1 });
    }
    const take = (kinds: ReadonlyArray<FightKind>, cls: SizeClass, count: number, seeds: number): void => {
        const per = Math.ceil(count / kinds.length);
        for (const kind of kinds) {
            let found = 0;
            for (let i = 0; found < per && i < 4000; i += 1) {
                if (teacherFight(i).kind !== kind) continue;
                found += 1;
                if (defs.filter((d) => d.cls === cls).length < count) {
                    defs.push({ id: `${cls}:${i}`, cls, fight: i, seeds });
                }
            }
        }
    };
    take(['2v2-ea', '2v2-boss'], '2v2', sizes.matchups2v2, sizes.seeds2v2);
    take(['3v3-ea', '3v3-boss'], '3v3', sizes.matchups3v3, sizes.seeds3v3);
    return defs;
}

/** One game: who played the PLAYER side, from the arm's own point of view. */
export interface StrengthGame {
    readonly arm: Tier;
    readonly cls: SizeClass;
    readonly matchup: string;
    readonly seed: string;
    readonly side: 'PLAYER' | 'ENEMY';
    /** 1 the arm won, 0.5 drew (or ran out of turns), 0 it lost. */
    readonly score: number;
    readonly turns: number;
}

/** Every arm, every seed, both orientations, for one matchup. */
export function strengthUnit(def: MatchupDef): StrengthGame[] {
    const spec = teacherFight(def.fight);
    const games: StrengthGame[] = [];
    for (let k = 0; k < def.seeds; k += 1) {
        const seed = `meas177:${def.id}:${k}`;
        for (const side of ['PLAYER', 'ENEMY'] as const) {
            for (const arm of ARMS) {
                const result = runOne(
                    { ...spec.setup, seed }, seed, DEFAULT_MAX_TURNS, side, false,
                    'full', undefined, undefined, undefined, undefined, arm,
                );
                const score = result.winner === 'PLAYER' ? 1 : result.winner === 'DRAW' ? 0.5 : 0;
                games.push({ arm, cls: def.cls, matchup: def.id, seed, side, score: result.truncated ? 0.5 : score, turns: result.turns });
            }
        }
    }
    return games;
}

// ───────────────────────────── agreement and speed ─────────────────────────────

export interface ReplayDecision {
    readonly cls: SizeClass;
    readonly teacherEnds: boolean;
    /** Per tier, in `ARMS` order: 1 if it named the teacher's action, else 0. */
    readonly agree: ReadonlyArray<number>;
    /** Per tier, in `ARMS` order: milliseconds the decision took. */
    readonly ms: ReadonlyArray<number>;
    /** Whether the cheap tier chose to end the turn. */
    readonly cheapEnds: boolean;
    /** When cheap disagreed: teacher's feature row minus cheap's. Otherwise absent. */
    readonly gap?: ReadonlyArray<number>;
}

export interface ReplayUnit {
    readonly fight: number;
    readonly cls: SizeClass;
    readonly decisions: ReadonlyArray<ReplayDecision>;
}

/**
 * Replay one recorded fight: apply the teacher's choices in order, and at each state ask every tier.
 * `decisions` are that fight's recorded decisions (keys and the chosen index are all this reads).
 */
export function replayUnit(fight: number, decisions: ReadonlyArray<Pick<TeacherDecision, 'keys' | 'chosen' | 'side' | 'turn'>>): ReplayUnit {
    const spec = teacherFight(fight);
    const cls = classOf(spec.kind);
    let state: IBattleState = buildScenarioState(
        { ...applyStatJitter(spec.setup, spec.seed), seed: spec.seed }, spec.startingSide,
    );
    const out: ReplayDecision[] = [];
    let warmed = false;

    for (const d of decisions) {
        const teacherKey = d.keys[d.chosen];
        const agree: number[] = [];
        const ms: number[] = [];
        let cheapKey = 'END_TURN';
        for (const tier of ARMS) {
            const asked: IBattleState = { ...state, playerAiTier: tier, enemyAiTier: tier };
            // One untimed call per tier on the first state, so JIT warm-up is not billed to a decision.
            if (!warmed) getBestAction(asked);
            const started = performance.now();
            const action = getBestAction(asked);
            ms.push(performance.now() - started);
            const key = actionKey(action) ?? 'END_TURN';
            agree.push(key === teacherKey ? 1 : 0);
            if (tier === 'cheap') cheapKey = key;
        }
        warmed = true;

        let gap: number[] | undefined;
        if (cheapKey !== teacherKey) {
            const rows = featuresForLegalActions(state, d.side);
            const keys = rows.map((r) => actionKey(r.action));
            const t = keys.indexOf(teacherKey);
            const c = keys.indexOf(cheapKey);
            if (t >= 0 && c >= 0) gap = FEATURE_NAMES.map((name) => rows[t].features[name] - rows[c].features[name]);
        }
        out.push({
            cls, teacherEnds: teacherKey === 'END_TURN', agree, ms,
            cheapEnds: cheapKey === 'END_TURN', ...(gap ? { gap } : {}),
        });

        const next = battleReducer(state, actionFromKey(teacherKey));
        if (next === state) break; // a replay that stops being faithful says so through `full`'s agreement
        state = next;
    }
    return { fight, cls, decisions: out };
}

/** The held-out fights to replay: the first `replay[class]` per class, in fight order. */
export function replayFights(
    finished: ReadonlyArray<number>,
    sizes: MeasureSizes,
): number[] {
    const taken: Record<SizeClass, number> = { '1v1': 0, '2v2': 0, '3v3': 0 };
    const picked: number[] = [];
    for (const fight of [...finished].sort((a, b) => a - b)) {
        if (!isHeldOut(fight)) continue;
        const cls = classOf(teacherFight(fight).kind);
        if (taken[cls] >= sizes.replay[cls]) continue;
        taken[cls] += 1;
        picked.push(fight);
    }
    return picked;
}

// ───────────────────────────── the units, and putting them together ─────────────────────────────

export type Unit =
    | { readonly kind: 'strength'; readonly id: string; readonly def: MatchupDef }
    | { readonly kind: 'replay'; readonly id: string; readonly fight: number };

export function measurementUnits(finished: ReadonlyArray<number>, sizes: MeasureSizes = DEFAULT_SIZES): Unit[] {
    const units: Unit[] = [];
    for (const def of strengthMatchups(sizes)) units.push({ kind: 'strength', id: `strength-${def.id}`, def });
    for (const fight of replayFights(finished, sizes)) units.push({ kind: 'replay', id: `replay-${fight}`, fight });
    return units;
}

export interface UnitResults {
    readonly strength: StrengthGame[][];
    readonly replay: ReplayUnit[];
}

/** Compute one unit, or read it from the cache. */
export function runUnit(
    unit: Unit,
    decisionsOf: (fight: number) => ReadonlyArray<TeacherDecision>,
    cacheDir?: string,
): StrengthGame[] | ReplayUnit {
    return cached(cacheDir, [unit.kind, unit.id], () => (
        unit.kind === 'strength' ? strengthUnit(unit.def) : replayUnit(unit.fight, decisionsOf(unit.fight))
    ));
}

// ───────────────────────────── aggregation ─────────────────────────────

export interface StrengthRow {
    readonly arm: Tier;
    readonly cls: SizeClass | 'all';
    readonly games: number;
    readonly rate: Interval;
}

/** Win rate per (arm, class), plus the class-averaged "all" row the verdict reads. */
export function strengthTable(games: ReadonlyArray<StrengthGame>): StrengthRow[] {
    const rows: StrengthRow[] = [];
    for (const arm of ARMS) {
        const perClass = SIZE_CLASSES.map((cls) => {
            const mine = games.filter((g) => g.arm === arm && g.cls === cls);
            return { cls, mine, interval: wilson(mine.reduce((a, g) => a + g.score, 0), mine.length) };
        }).filter((c) => c.mine.length > 0);
        for (const c of perClass) rows.push({ arm, cls: c.cls, games: c.mine.length, rate: c.interval });
        if (perClass.length > 0) {
            // The class-averaged rate and a conservative interval: each class's half-width, combined
            // as an average of independent estimates.
            const k = perClass.length;
            const estimate = perClass.reduce((a, c) => a + c.interval.estimate, 0) / k;
            const half = Math.sqrt(perClass.reduce((a, c) => a + ((c.interval.hi - c.interval.lo) / 2) ** 2, 0)) / k;
            rows.push({
                arm, cls: 'all', games: perClass.reduce((a, c) => a + c.mine.length, 0),
                rate: { estimate, lo: Math.max(0, estimate - half), hi: Math.min(1, estimate + half), n: perClass.reduce((a, c) => a + c.mine.length, 0) },
            });
        }
    }
    return rows;
}

/**
 * `a`'s score minus `b`'s on the SAME games (same matchup, seed and orientation), per class. The
 * interval is on the per-game differences, which is what pairing buys: the dice cancel.
 */
export function pairedDifference(games: ReadonlyArray<StrengthGame>, a: Tier, b: Tier): Array<{ cls: SizeClass | 'all'; diff: Interval }> {
    const key = (g: StrengthGame): string => `${g.matchup}|${g.seed}|${g.side}`;
    const byB = new Map(games.filter((g) => g.arm === b).map((g) => [key(g), g.score]));
    const out: Array<{ cls: SizeClass | 'all'; diff: Interval }> = [];
    const perClass: Interval[] = [];
    for (const cls of SIZE_CLASSES) {
        const diffs = games.filter((g) => g.arm === a && g.cls === cls && byB.has(key(g))).map((g) => g.score - (byB.get(key(g)) as number));
        if (diffs.length === 0) continue;
        const interval = meanInterval(diffs);
        perClass.push(interval);
        out.push({ cls, diff: interval });
    }
    if (perClass.length > 0) {
        const k = perClass.length;
        const estimate = perClass.reduce((s, i) => s + i.estimate, 0) / k;
        const half = Math.sqrt(perClass.reduce((s, i) => s + ((i.hi - i.lo) / 2) ** 2, 0)) / k;
        out.push({ cls: 'all', diff: { estimate, lo: estimate - half, hi: estimate + half, n: perClass.reduce((s, i) => s + i.n, 0) } });
    }
    return out;
}

export interface AgreementRow {
    readonly tier: Tier;
    readonly cls: SizeClass | 'all';
    readonly decisions: number;
    readonly rate: Interval;
}

export function agreementTable(units: ReadonlyArray<ReplayUnit>): AgreementRow[] {
    const rows: AgreementRow[] = [];
    ARMS.forEach((tier, t) => {
        for (const cls of [...SIZE_CLASSES, 'all' as const]) {
            const ds = units.filter((u) => cls === 'all' || u.cls === cls).flatMap((u) => u.decisions);
            if (ds.length === 0) continue;
            rows.push({ tier, cls, decisions: ds.length, rate: wilson(ds.reduce((a, d) => a + d.agree[t], 0), ds.length) });
        }
    });
    return rows;
}

export interface SpeedRow {
    readonly tier: Tier;
    readonly cls: SizeClass;
    readonly timing: TimingSummary;
}

export function speedTable(units: ReadonlyArray<ReplayUnit>): SpeedRow[] {
    const rows: SpeedRow[] = [];
    ARMS.forEach((tier, t) => {
        for (const cls of SIZE_CLASSES) {
            const ms = units.filter((u) => u.cls === cls).flatMap((u) => u.decisions.map((d) => d.ms[t]));
            if (ms.length > 0) rows.push({ tier, cls, timing: summariseTimings(ms) });
        }
    });
    return rows;
}

export interface Verdict {
    readonly met: boolean;
    readonly strengthMet: boolean;
    readonly speedMet: boolean;
    readonly cheapRate: number;
    readonly liteRate: number;
    /** lite's mean ms / cheap's mean ms, per class that has timings. */
    readonly speedup: Partial<Record<SizeClass, number>>;
    readonly line: string;
}

export function verdict(strength: ReadonlyArray<StrengthRow>, speed: ReadonlyArray<SpeedRow>): Verdict {
    const rate = (arm: Tier): number => strength.find((r) => r.arm === arm && r.cls === 'all')?.rate.estimate ?? 0;
    const cheapRate = rate('cheap');
    const liteRate = rate('lite');
    const speedup: Partial<Record<SizeClass, number>> = {};
    for (const cls of ['1v1', '3v3'] as const) {
        const c = speed.find((r) => r.tier === 'cheap' && r.cls === cls)?.timing.mean;
        const l = speed.find((r) => r.tier === 'lite' && r.cls === cls)?.timing.mean;
        if (c !== undefined && l !== undefined && c > 0) speedup[cls] = l / c;
    }
    const strengthMet = cheapRate >= liteRate;
    const speedMet = (['1v1', '3v3'] as const).every((cls) => (speedup[cls] ?? 0) >= 10);
    const met = strengthMet && speedMet;
    const x = (n: number | undefined): string => (n === undefined ? 'n/a' : `${n.toFixed(1)}x`);
    const line = `${met ? 'C2 BAR MET' : 'C2 BAR MISSED'}: cheap beats full ${(100 * cheapRate).toFixed(1)}% of the time against `
        + `lite's ${(100 * liteRate).toFixed(1)}% (class-averaged, same games: ${strengthMet ? 'at least lite' : 'below lite'}); `
        + `cheap is ${x(speedup['1v1'])} faster than lite at 1v1 and ${x(speedup['3v3'])} at 3v3 (needs 10x at both: ${speedMet ? 'met' : 'missed'}).`;
    return { met, strengthMet, speedMet, cheapRate, liteRate, speedup, line };
}

/**
 * Where the cheap AI's disagreements come from: how often the two sides of an end-turn disagreement
 * occur, and which features the teacher's choice had more of than cheap's. `lift` is the mean gap
 * in a feature divided by the feature's overall spread of gaps' magnitude, so features on different
 * scales can be read side by side.
 */
export interface Diagnostics {
    readonly disagreements: number;
    readonly cheapEndsTeacherPlays: number;
    readonly cheapPlaysTeacherEnds: number;
    readonly bothPlayDifferently: number;
    readonly gaps: Array<{ feature: string; meanGap: number; lift: number }>;
}

export function diagnostics(units: ReadonlyArray<ReplayUnit>): Diagnostics {
    const ds = units.flatMap((u) => u.decisions).filter((d) => d.agree[0] === 0);
    const withGap = ds.filter((d) => d.gap !== undefined);
    const mean = FEATURE_NAMES.map((_, k) => (withGap.length === 0 ? 0 : withGap.reduce((a, d) => a + (d.gap as number[])[k], 0) / withGap.length));
    const spread = FEATURE_NAMES.map((_, k) => (withGap.length === 0 ? 1 : Math.max(1e-9, withGap.reduce((a, d) => a + Math.abs((d.gap as number[])[k]), 0) / withGap.length)));
    return {
        disagreements: ds.length,
        cheapEndsTeacherPlays: ds.filter((d) => d.cheapEnds && !d.teacherEnds).length,
        cheapPlaysTeacherEnds: ds.filter((d) => !d.cheapEnds && d.teacherEnds).length,
        bothPlayDifferently: ds.filter((d) => !d.cheapEnds && !d.teacherEnds).length,
        gaps: FEATURE_NAMES.map((feature, k) => ({ feature, meanGap: mean[k], lift: mean[k] / spread[k] }))
            .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift)),
    };
}
