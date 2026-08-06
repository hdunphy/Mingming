/**
 * The Balance Auditor - `docs/balance_testing.md` section 4, designed by
 * `docs/wayfinder/debug-toolkit/tickets/08-batch-sim-auditor-design.md` sections 4-5.
 *
 * Produces `docs/balance/balance_report.json`: every card over its section 1.3 energy
 * budget, and every matchup breaching section 2's win-rate / turn-count / OS-gap limits.
 *
 * WHY THE PATH IS FIXED AND THE FILE IS COMMITTED
 * ----------------------------------------------
 * The sims are seeded and `buildScenarioState` makes creation reproducible, so this file is
 * *stable*: change a card, rerun `npm run balance`, and `git diff docs/balance/` is the
 * answer to "what did that do". That property is the whole point, and it only exists at a
 * fixed, checked-in path - a timestamped filename gives you two files to compare by hand.
 *
 * Which is also why nothing here records a timestamp, a hostname, a duration or a run id.
 * Any of those would change on every run and turn the diff - the one thing the report is
 * for - into noise. The only volatile-looking field is `registryHash`, and it is volatile
 * *exactly when the game data changed*, which is the signal, not the noise.
 *
 * HOW THE NUMBERS GET HERE
 * ------------------------
 * The section 2 half cannot be recomputed cheaply: it is ~135 seconds of battles that the
 * three `*.balance.ts` suites already run. Re-running them inside a fourth suite would
 * double the runtime *and* produce a second set of numbers that could disagree with the
 * assertions - the exact "two tools disagreeing reads as a bug" failure section 5 warns
 * about. So the suites publish what they measured and the auditor collects it.
 *
 * Vitest isolates each test file in its own worker, so "publish" is a JSON fragment on
 * disk under `node_modules/.cache/` (already gitignored, and cleared at the start of every
 * run so a suite that did not run cannot leave a stale fragment behind). `globalSetup`
 * clears; `teardown` merges, audits the card registry, and writes. Teardown runs whether
 * the suites passed or failed, which matters: a red run is precisely the run whose report
 * you want.
 *
 * The section 1 half - the card budget - is pure static analysis over the registry, needs
 * no simulation, and is computed here in milliseconds at write time.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import type { ProgramData } from '../../engine/types';
import { computeRegistryHash } from '../scenarios/registryHash';
import { budgetBandFor, calculatePowerscale } from './powerscale';
import type { BatchResult, PairedBatchResult } from './runBatch';

/** Bump when the JSON shape changes, so an old report is never diffed against a new one. */
export const BALANCE_REPORT_SCHEMA_VERSION = 1;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const REPORT_DIR = resolve(REPO_ROOT, 'docs', 'balance');
export const REPORT_JSON_PATH = join(REPORT_DIR, 'balance_report.json');
/** One row per redline - the "what is broken" spreadsheet. */
export const REDLINES_CSV_PATH = join(REPORT_DIR, 'balance_redlines.csv');
/** One row per simulated matchup with every metric - the "sort by X" spreadsheet. */
export const MATCHUPS_CSV_PATH = join(REPORT_DIR, 'balance_matchups.csv');

/**
 * Where suites drop their fragments between the worker and the merge. Under
 * `node_modules/` so `.gitignore` already covers it and no build artifact leaks into the
 * repo next to the report it produced.
 */
const FRAGMENT_DIR = resolve(REPO_ROOT, 'node_modules', '.cache', 'mingming-balance');

/**
 * Section 2 and 3 redlines, in one place.
 *
 * The three suites import these rather than declaring their own copies: a threshold that
 * differs between the assertion and the report would mean a red test with no matching
 * redline, or worse, a green test with one.
 */
export const MATCHUP_THRESHOLDS = {
    /** Section 2.1: how far a mirror's pooled decisive win rate may sit from 50%. */
    mirrorTolerance: 0.10,
    /** Section 2.1 restated: turn order must be worth the same to both sides. */
    mirrorSideBias: 0.20,
    /** Section 2.2: "If >70%, the archetype is overtuned." */
    overtunedWinRate: 0.70,
    /** Section 2.2: "If turns > 30, the archetype is too slow/stalling (unfun)." */
    stallTurnLimit: 30,
    /** Section 2.3: "outperforms the other by >15%". */
    osMaxGap: 0.15,
    /** Fewest decided games that can support a section 2.3 claim at all. */
    osMinDecidedGames: 20,
} as const;

export type SuiteId = 'mirror' | 'archetype-gauntlet' | 'os-variance';

/** Every suite the auditor expects to hear from, in report order. */
export const EXPECTED_SUITES: ReadonlyArray<SuiteId> = ['mirror', 'archetype-gauntlet', 'os-variance'];

/**
 * What a record is, which decides which redlines apply to it.
 *
 * `gauntlet-matchup` deliberately carries no win-rate or turn-count redline: section 2.2
 * states both about the *archetype*, and a per-matchup cap would flag intentional
 * rock-paper-scissors as a bug. They are asserted on `gauntlet-overall` instead.
 */
export type MatchupRole = 'mirror' | 'gauntlet-matchup' | 'gauntlet-overall' | 'os-variance';

export type RedlineKind =
    | 'CARD_OVER_BUDGET'
    | 'MIRROR_WIN_RATE'
    | 'MIRROR_SIDE_BIAS'
    | 'ARCHETYPE_WIN_RATE'
    | 'TURN_COUNT'
    | 'OS_GAP'
    | 'FTK';

export interface Redline {
    kind: RedlineKind;
    /** The `docs/balance_testing.md` section that sets this limit. */
    section: string;
    /** Card id, matchup id, or archetype id - whatever the redline is *about*. */
    subject: string;
    /** Which measured value breached. */
    metric: string;
    value: number;
    threshold: number;
    /** Which side of `threshold` is the breach. */
    comparison: 'above' | 'below';
    /** One line a human can act on without opening the sim. */
    detail: string;
}

export interface MatchupReport {
    /** Stable across runs - the JSON is sorted by it. */
    id: string;
    suite: SuiteId;
    role: MatchupRole;
    label: string;
    player: string;
    playerOS: string;
    enemy: string;
    enemyOS: string;
    /** Total runs pooled into this record (both turn orders, where applicable). */
    iterations: number;
    playerWins: number;
    enemyWins: number;
    draws: number;
    decisive: number;
    /** Player wins over *decided* games - the number section 2's redlines read against. */
    decisiveWinRate: number;
    /** Player wins over all runs, draws counting against. Reported, never redlined. */
    winRate: number;
    averageTurns: number;
    /** Section 2.2's trap-card metric. Reported without a threshold - the doc sets none. */
    deadCardRatio: number;
    enemyDeadCardRatio: number;
    ftkCount: number;
    truncatedCount: number;
    /** Only meaningful for a both-orientations run; `null` for a single aggregate. */
    firstMoverEdge: number | null;
    sideBias: number | null;
    /**
     * Too few decided games to make a section 2.3 claim. Such a record is reported with no
     * OS-gap redline: the stalling that caused it is redlined by the Mirror Test, which is
     * the accurate description of what is wrong.
     */
    inconclusive: boolean;
    redlines: Redline[];
}

export interface CardBudgetEntry {
    id: string;
    name: string;
    cost: number;
    score: number;
    perEnergy: number;
    /** Section 1.3's upper bound for this cost. */
    budget: number;
    overBudgetBy: number;
    /**
     * Action types on this card that `calculatePowerscale` couldn't honestly price (see
     * `powerscale.ts`'s `manualReview`) - non-empty means `score` is a floor, not the whole
     * picture. A redline with entries here is still a real redline (the priced components
     * alone already cleared the budget), just possibly worse than `overBudgetBy` shows.
     */
    manualReview: string[];
}

export interface BalanceReport {
    schemaVersion: number;
    /** What defines every threshold in this file. */
    spec: string;
    /** How to regenerate it. */
    command: string;
    /**
     * `docs/wayfinder/debug-toolkit/tickets/02-scenario-schema.md`'s registry drift stamp.
     * It changes when and only when the game data changed, so a report whose numbers moved
     * without this moving means the *harness* moved.
     */
    registryHash: string;
    summary: {
        redlines: number;
        cardRedlines: number;
        matchupRedlines: number;
        cardsAudited: number;
        matchupsAudited: number;
        /**
         * Which suites contributed. A filtered run (`vitest -t ...`) still overwrites the
         * report, so this is how a partial report announces itself in the diff rather than
         * silently looking like a clean bill of health.
         */
        suitesReported: SuiteId[];
        suitesMissing: SuiteId[];
    };
    cardBudget: {
        /** Section 1.3's table, echoed so the report is readable without the source. */
        thresholds: Array<{ cost: string; maxScore: number }>;
        redlines: CardBudgetEntry[];
    };
    matchups: MatchupReport[];
    /** Every redline from both halves, flattened and sorted. The "what is broken" list. */
    redlines: Redline[];
}

/* -------------------------------------------------------------------------- */
/* Determinism helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Round to `dp` decimals, normalising `-0` to `0`.
 *
 * Rounding is not cosmetic here. Un-rounded floats put a 17-digit tail in the committed
 * file, so an irrelevant change deep in the mantissa shows up as a diff line and the
 * report stops being scannable. 4 decimals on a rate is 0.01 of a percentage point, far
 * finer than any threshold in the spec.
 */
function round(value: number, dp: number): number {
    const factor = Math.pow(10, dp);
    const rounded = Math.round(value * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
}

const rate = (value: number): number => round(value, 4);

/**
 * Code-unit string ordering, deliberately not `localeCompare`.
 *
 * `localeCompare` depends on the ICU data the running Node was built with, and this file is
 * committed: two developers on different Node builds could otherwise reorder the whole
 * report without changing a single number. Every id sorted here is ASCII, so a plain
 * comparison is both stable everywhere and the order a reader expects.
 */
function byString(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/* -------------------------------------------------------------------------- */
/* Section 1: the static card-budget audit                                    */
/* -------------------------------------------------------------------------- */

function budgetRedline(entry: CardBudgetEntry): Redline {
    return {
        kind: 'CARD_OVER_BUDGET',
        section: '1.3',
        subject: entry.id,
        metric: 'score',
        value: entry.score,
        threshold: entry.budget,
        comparison: 'above',
        detail:
            `${entry.name} (${entry.id}) costs ${entry.cost} energy and scores ${entry.score}, ` +
            `${round(entry.overBudgetBy, 1)} over the ${entry.budget} budget for that cost.` +
            (entry.manualReview.length > 0
                ? ` (score excludes unscored ${entry.manualReview.join('/')} action(s) - actual value is at least this.)`
                : ''),
    };
}

/**
 * Score every card in the inflated registry against its section 1.3 band.
 *
 * Over budget only. Section 1.3 states ranges, but a card *under* its target is a card
 * nobody plays rather than a card that breaks the game, the Studio's amber threshold does
 * not match the doc's lower bound anyway (see `powerscale.ts`), and inventing a redline
 * this repo never agreed to is how a report loses its authority.
 */
export function auditCardBudget(): { entries: CardBudgetEntry[]; cardsAudited: number } {
    const registry = getInflatedProgramRegistry();
    const ids = Object.keys(registry).sort();

    const entries: CardBudgetEntry[] = [];
    for (const id of ids) {
        const card = registry[id] as ProgramData;
        const band = budgetBandFor(card.baseCost);
        const { score, perEnergy, manualReview } = calculatePowerscale(card);
        if (score > band.over) {
            entries.push({
                id,
                name: card.name,
                cost: card.baseCost,
                score,
                perEnergy,
                budget: band.over,
                overBudgetBy: round(score - band.over, 1),
                manualReview,
            });
        }
    }

    // Worst offender first, then by id so equal scores never reorder between runs.
    entries.sort((a, b) => b.overBudgetBy - a.overBudgetBy || byString(a.id, b.id));

    return { entries, cardsAudited: ids.length };
}

/* -------------------------------------------------------------------------- */
/* Section 2/3: matchup records published by the suites                       */
/* -------------------------------------------------------------------------- */

export interface MatchupInput {
    suite: SuiteId;
    role: MatchupRole;
    id: string;
    label: string;
    player: string;
    playerOS: string;
    enemy: string;
    enemyOS: string;
    pooled: BatchResult;
    firstMoverEdge?: number;
    sideBias?: number;
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

function evaluateRedlines(input: MatchupInput, inconclusive: boolean): Redline[] {
    const { role, id, pooled } = input;
    const out: Redline[] = [];
    const T = MATCHUP_THRESHOLDS;

    if (role === 'mirror' && pooled.decisive > 0) {
        const gap = Math.abs(pooled.decisiveWinRate - 0.5);
        if (gap > T.mirrorTolerance) {
            out.push({
                kind: 'MIRROR_WIN_RATE',
                section: '2.1',
                subject: id,
                metric: 'decisiveWinRate',
                value: rate(pooled.decisiveWinRate),
                threshold: T.mirrorTolerance,
                comparison: 'above',
                detail:
                    `Identical decks split the ${pooled.decisive} decided games ` +
                    `${pct(pooled.decisiveWinRate)}/${pct(1 - pooled.decisiveWinRate)}. ` +
                    'A mirror that is not ~50/50 means the harness, not the deck, is being measured.',
            });
        }
        if (input.sideBias !== undefined && input.sideBias > T.mirrorSideBias) {
            out.push({
                kind: 'MIRROR_SIDE_BIAS',
                section: '2.1',
                subject: id,
                metric: 'sideBias',
                value: rate(input.sideBias),
                threshold: T.mirrorSideBias,
                comparison: 'above',
                detail:
                    `Moving first is worth ${pct(input.sideBias)} more to one side than the other ` +
                    'in a mirror. Turn order is a property of the game, not of a side.',
            });
        }
    }

    if ((role === 'mirror' || role === 'gauntlet-overall') && pooled.averageTurns > T.stallTurnLimit) {
        out.push({
            kind: 'TURN_COUNT',
            section: '2.2',
            subject: id,
            metric: 'averageTurns',
            value: round(pooled.averageTurns, 2),
            threshold: T.stallTurnLimit,
            comparison: 'above',
            detail:
                `Averages ${pooled.averageTurns.toFixed(1)} turns with ` +
                `${pooled.draws}/${pooled.iterations} draws. Section 2.2 calls anything over ` +
                `${T.stallTurnLimit} turns too slow to be fun; these do not finish at all.`,
        });
    }

    if (role === 'gauntlet-overall' && pooled.decisiveWinRate > T.overtunedWinRate) {
        out.push({
            kind: 'ARCHETYPE_WIN_RATE',
            section: '2.2',
            subject: id,
            metric: 'decisiveWinRate',
            value: rate(pooled.decisiveWinRate),
            threshold: T.overtunedWinRate,
            comparison: 'above',
            detail:
                `Wins ${pct(pooled.decisiveWinRate)} of ${pooled.decisive} decided games across ` +
                'the registry. Section 2.2 calls that overtuned.',
        });
    }

    if (role === 'os-variance' && !inconclusive) {
        const gap = Math.abs(pooled.decisiveWinRate - 0.5);
        if (gap > T.osMaxGap) {
            const stronger = pooled.decisiveWinRate > 0.5 ? input.playerOS : input.enemyOS;
            const share = Math.max(pooled.decisiveWinRate, 1 - pooled.decisiveWinRate);
            out.push({
                kind: 'OS_GAP',
                section: '2.3',
                subject: id,
                metric: 'osGap',
                value: rate(gap),
                threshold: T.osMaxGap,
                comparison: 'above',
                detail:
                    `${stronger} wins ${pct(share)} of the ${pooled.decisive} decided games ` +
                    `between ${input.playerOS} and ${input.enemyOS} on an otherwise identical ` +
                    `${input.player}. The weaker variant needs a buff or a lower cost.`,
            });
        }
    }

    // Section 3's zero-interaction win. Flagged wherever it appears - a deck that can kill
    // before the opponent acts is a redline in a mirror and in a gauntlet alike.
    //
    // Except on `gauntlet-overall`, which pools the very runs the individual matchups
    // already reported: counting it there would list every first-turn kill twice and
    // inflate `summary.redlines` without naming a new problem.
    if (pooled.ftkCount > 0 && role !== 'gauntlet-overall') {
        out.push({
            kind: 'FTK',
            section: '3',
            subject: id,
            metric: 'ftkCount',
            value: pooled.ftkCount,
            threshold: 0,
            comparison: 'above',
            detail:
                `${pooled.ftkCount}/${pooled.iterations} runs were won on turn 1 by the side that ` +
                'moved first, so the loser never played a card.',
        });
    }

    return out;
}

/** Freeze a batch (or a pooled pair) into the shape the report stores. */
export function toMatchupReport(input: MatchupInput): MatchupReport {
    const { pooled } = input;
    const inconclusive =
        input.role === 'os-variance' && pooled.decisive < MATCHUP_THRESHOLDS.osMinDecidedGames;

    return {
        id: input.id,
        suite: input.suite,
        role: input.role,
        label: input.label,
        player: input.player,
        playerOS: input.playerOS,
        enemy: input.enemy,
        enemyOS: input.enemyOS,
        iterations: pooled.iterations,
        playerWins: pooled.playerWins,
        enemyWins: pooled.enemyWins,
        draws: pooled.draws,
        decisive: pooled.decisive,
        decisiveWinRate: rate(pooled.decisiveWinRate),
        winRate: rate(pooled.winRate),
        averageTurns: round(pooled.averageTurns, 2),
        deadCardRatio: rate(pooled.deadCardRatio),
        enemyDeadCardRatio: rate(pooled.enemyDeadCardRatio),
        ftkCount: pooled.ftkCount,
        truncatedCount: pooled.truncatedCount,
        firstMoverEdge: input.firstMoverEdge === undefined ? null : rate(input.firstMoverEdge),
        sideBias: input.sideBias === undefined ? null : rate(input.sideBias),
        inconclusive,
        redlines: evaluateRedlines(input, inconclusive),
    };
}

/** Convenience for the common case: a `runPairedBatch` result. */
export function pairedInput(
    base: Omit<MatchupInput, 'pooled' | 'firstMoverEdge' | 'sideBias'>,
    paired: PairedBatchResult,
): MatchupInput {
    return {
        ...base,
        pooled: paired.pooled,
        firstMoverEdge: paired.firstMoverEdge,
        sideBias: paired.sideBias,
    };
}

/* -------------------------------------------------------------------------- */
/* Fragment exchange between the suite workers and the merge                   */
/* -------------------------------------------------------------------------- */

const pending: MatchupReport[] = [];

/**
 * Record one matchup for the report. Call it as soon as the batch is aggregated and
 * *before* asserting on it - an assertion throws, and a breach that never reached the
 * report is a breach the diff cannot show.
 */
export function recordMatchup(input: MatchupInput): MatchupReport {
    const report = toMatchupReport(input);
    pending.push(report);
    return report;
}

/**
 * Flush everything this worker recorded, grouped by suite, and clear the buffer.
 *
 * Call from an `afterAll` so it still runs when the suite went red. A suite that recorded
 * nothing writes nothing, and the merge then lists it under `suitesMissing`.
 */
let fragmentSeq = 0;

export function publishFragments(): void {
    if (pending.length === 0) return;

    const bySuite = new Map<SuiteId, MatchupReport[]>();
    for (const report of pending) {
        const bucket = bySuite.get(report.suite) ?? [];
        bucket.push(report);
        bySuite.set(report.suite, bucket);
    }
    pending.length = 0;

    mkdirSync(FRAGMENT_DIR, { recursive: true });
    for (const [suite, reports] of bySuite) {
        reports.sort((a, b) => byString(a.id, b.id));
        // Ticket 17: a suite may now be SHARDED across several worker files, so the
        // fragment name must be unique per worker (pid) and per publish (seq) - the
        // merge sorts globally, so naming never reaches the report bytes.
        writeFileSync(
            join(FRAGMENT_DIR, `${suite}.${process.pid}-${fragmentSeq++}.json`),
            JSON.stringify(reports),
            'utf8',
        );
    }
}

/** Drop every fragment from a previous run. Called by `globalSetup` before anything runs. */
export function clearFragments(): void {
    rmSync(FRAGMENT_DIR, { recursive: true, force: true });
    mkdirSync(FRAGMENT_DIR, { recursive: true });
}

function readFragments(): MatchupReport[] {
    if (!existsSync(FRAGMENT_DIR)) return [];
    const out: MatchupReport[] = [];
    for (const file of readdirSync(FRAGMENT_DIR).sort()) {
        if (!file.endsWith('.json')) continue;
        out.push(...(JSON.parse(readFileSync(join(FRAGMENT_DIR, file), 'utf8')) as MatchupReport[]));
    }
    return out;
}

/* -------------------------------------------------------------------------- */
/* Assembly and output                                                        */
/* -------------------------------------------------------------------------- */

/** Sort order for the flattened redline list: by spec section, then subject, then kind. */
function compareRedlines(a: Redline, b: Redline): number {
    return (
        byString(a.section, b.section) ||
        byString(a.subject, b.subject) ||
        byString(a.kind, b.kind)
    );
}

export function assembleReport(matchups: ReadonlyArray<MatchupReport>): BalanceReport {
    const { entries: cardEntries, cardsAudited } = auditCardBudget();
    const sortedMatchups = [...matchups].sort((a, b) => byString(a.id, b.id));

    const cardRedlines = cardEntries.map(budgetRedline);
    const matchupRedlines = sortedMatchups.flatMap(m => m.redlines);
    const reported = EXPECTED_SUITES.filter(suite => sortedMatchups.some(m => m.suite === suite));

    return {
        schemaVersion: BALANCE_REPORT_SCHEMA_VERSION,
        spec: 'docs/balance_testing.md',
        command: 'npm run balance',
        registryHash: computeRegistryHash(),
        summary: {
            redlines: cardRedlines.length + matchupRedlines.length,
            cardRedlines: cardRedlines.length,
            matchupRedlines: matchupRedlines.length,
            cardsAudited,
            matchupsAudited: sortedMatchups.length,
            suitesReported: [...reported],
            suitesMissing: EXPECTED_SUITES.filter(suite => !reported.includes(suite)),
        },
        cardBudget: {
            thresholds: [
                { cost: '0', maxScore: budgetBandFor(0).over },
                { cost: '1', maxScore: budgetBandFor(1).over },
                { cost: '2', maxScore: budgetBandFor(2).over },
                { cost: '3+', maxScore: budgetBandFor(3).over },
            ],
            redlines: cardEntries,
        },
        matchups: sortedMatchups,
        redlines: [...cardRedlines, ...matchupRedlines].sort(compareRedlines),
    };
}

function csvCell(value: string | number | boolean | null): string {
    const text = value === null ? '' : String(value);
    return /["\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null>>): string {
    return [headers.join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\n') + '\n';
}

export function redlinesCsv(report: BalanceReport): string {
    return toCsv(
        ['section', 'kind', 'subject', 'metric', 'value', 'threshold', 'comparison', 'detail'],
        report.redlines.map(r => [r.section, r.kind, r.subject, r.metric, r.value, r.threshold, r.comparison, r.detail]),
    );
}

export function matchupsCsv(report: BalanceReport): string {
    return toCsv(
        [
            'id', 'suite', 'role', 'player', 'playerOS', 'enemy', 'enemyOS',
            'iterations', 'playerWins', 'enemyWins', 'draws', 'decisive',
            'decisiveWinRate', 'winRate', 'averageTurns', 'deadCardRatio', 'enemyDeadCardRatio',
            'ftkCount', 'truncatedCount', 'firstMoverEdge', 'sideBias', 'inconclusive', 'redlines',
        ],
        report.matchups.map(m => [
            m.id, m.suite, m.role, m.player, m.playerOS, m.enemy, m.enemyOS,
            m.iterations, m.playerWins, m.enemyWins, m.draws, m.decisive,
            m.decisiveWinRate, m.winRate, m.averageTurns, m.deadCardRatio, m.enemyDeadCardRatio,
            m.ftkCount, m.truncatedCount, m.firstMoverEdge, m.sideBias, m.inconclusive,
            m.redlines.map(r => r.kind).join(' '),
        ]),
    );
}

/**
 * Merge the fragments, audit the registry, and overwrite the committed report.
 *
 * Always writes, even when suites are missing - section 4 says "overwritten each run", and
 * a report that silently declines to update is worse than one that says what it covers.
 * `summary.suitesMissing` is how a partial run announces itself in the diff.
 */
export function writeBalanceReport(options?: { commitToDocs?: boolean }): BalanceReport {
    const report = assembleReport(readFragments());

    // Ticket 17: a scoped run (BALANCE_ONLY=...) is a tuning tool, not a source of
    // truth - it must never overwrite the committed report with partial coverage.
    if (options?.commitToDocs === false) return report;

    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
    writeFileSync(REDLINES_CSV_PATH, redlinesCsv(report), 'utf8');
    writeFileSync(MATCHUPS_CSV_PATH, matchupsCsv(report), 'utf8');

    return report;
}

/** The line `npm run balance` prints once the report is on disk. */
export function summarizeReport(report: BalanceReport): string {
    const missing =
        report.summary.suitesMissing.length > 0
            ? `\n  WARNING: partial report - no results from ${report.summary.suitesMissing.join(', ')}.`
            : '';
    return (
        `\n[balance-report] docs/balance/balance_report.json` +
        `\n  ${report.summary.redlines} redline(s): ` +
        `${report.summary.cardRedlines} card budget (section 1.3), ` +
        `${report.summary.matchupRedlines} matchup (sections 2-3)` +
        `\n  ${report.summary.cardsAudited} cards audited, ` +
        `${report.summary.matchupsAudited} matchups recorded, registry ${report.registryHash}` +
        missing
    );
}
