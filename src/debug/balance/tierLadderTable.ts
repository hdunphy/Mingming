/**
 * TICKET 169j — the pure half of the tier ladder check: fold walks into a row, format rows as a
 * table, and decide whether the ladder ever gets easier. No walking here, so it is unit-tested in
 * the gate and the slow half (`tierLadder.balance.ts`) only has to feed it.
 *
 * A row is one configuration (a tier, or a tier with one modifier) over a set of walks. The columns
 * are the ticket's: mean fights won per run, wild win %, elite win %, the share of runs that reach
 * the gym, the gym clear %, and — for the modifier report — mean scrap unspent at the end.
 *
 * "Wild" is both `wild` and `rival` fights: a rival is a wild in every way but its species (ticket
 * 142a). "Elite" is `elite` only. A fight in the gym gauntlet has kind `gym`; a run REACHES the gym
 * if it played one, and CLEARS it if it won the run.
 */

import type { WalkResult } from './runWalker';

/** What a row needs from one walk, so a walk can be reduced once and the rest kept as plain JSON. */
export interface RunDigest {
    readonly fights: ReadonlyArray<{ readonly kind: string; readonly won: boolean }>;
    readonly outcome: 'victory' | 'defeat';
    readonly scrapAtEnd: number;
}

export interface LadderRow {
    readonly label: string;
    readonly runs: number;
    readonly meanFightsWon: number;
    /** Percent of wild and rival fights won, or null when none were played. */
    readonly wildWinPct: number | null;
    readonly eliteWinPct: number | null;
    readonly gymReachPct: number;
    readonly gymClearPct: number;
    readonly meanScrapUnspent: number;
}

export function digest(result: WalkResult): RunDigest {
    return {
        fights: result.fights.map((f) => ({ kind: f.kind, won: f.won })),
        outcome: result.outcome,
        scrapAtEnd: result.scrapAtEnd,
    };
}

const mean = (values: ReadonlyArray<number>): number =>
    values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

function winPct(runs: ReadonlyArray<RunDigest>, kinds: ReadonlyArray<string>): number | null {
    const played = runs.flatMap((r) => r.fights).filter((f) => kinds.includes(f.kind));
    return played.length === 0 ? null : (100 * played.filter((f) => f.won).length) / played.length;
}

export function ladderRow(label: string, runs: ReadonlyArray<RunDigest>): LadderRow {
    return {
        label,
        runs: runs.length,
        meanFightsWon: mean(runs.map((r) => r.fights.filter((f) => f.won).length)),
        wildWinPct: winPct(runs, ['wild', 'rival']),
        eliteWinPct: winPct(runs, ['elite']),
        gymReachPct: runs.length === 0 ? 0 : (100 * runs.filter((r) => r.fights.some((f) => f.kind === 'gym')).length) / runs.length,
        gymClearPct: runs.length === 0 ? 0 : (100 * runs.filter((r) => r.outcome === 'victory').length) / runs.length,
        meanScrapUnspent: mean(runs.map((r) => r.scrapAtEnd)),
    };
}

const pct = (value: number | null): string => (value === null ? '-' : `${value.toFixed(1)}%`);

/** A markdown table. The scrap column is for the modifier report only. */
export function formatLadder(rows: ReadonlyArray<LadderRow>, options: { scrap?: boolean } = {}): string {
    const head = ['Configuration', 'Runs', 'Fights won', 'Wild win', 'Elite win', 'Reach gym', 'Clear gym', ...(options.scrap ? ['Scrap unspent'] : [])];
    const lines = rows.map((row) => [
        row.label, String(row.runs), row.meanFightsWon.toFixed(2), pct(row.wildWinPct), pct(row.eliteWinPct),
        pct(row.gymReachPct), pct(row.gymClearPct), ...(options.scrap ? [row.meanScrapUnspent.toFixed(1)] : []),
    ]);
    const render = (cells: ReadonlyArray<string>): string => `| ${cells.join(' | ')} |`;
    return [render(head), render(head.map(() => '---')), ...lines.map(render)].join('\n');
}

/**
 * The ladder check: mean fights won never rises from one row to the next. Returns the first pair
 * that breaks it, so a failure can print the numbers instead of a bare false.
 */
export function firstEasierStep(rows: ReadonlyArray<LadderRow>): { from: LadderRow; to: LadderRow } | null {
    for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].meanFightsWon > rows[i - 1].meanFightsWon) return { from: rows[i - 1], to: rows[i] };
    }
    return null;
}

// ---------------------------------------------------------------------------------------------
// TICKET 170b — the gauntlet-only table
// ---------------------------------------------------------------------------------------------
//
// The whole-run ladder above says how far a walk gets. This one says how a party that already
// STANDS at the gym gate does against the three gauntlet fights at each tier, from one shared
// snapshot per seed (`ghostWalk.ts`), so the deck, party and purse are identical across tiers and
// only the tier differs. Pure, so the arithmetic is unit-tested with a stubbed gauntlet.

/** What a row needs from one gauntlet. `playGauntlet`'s result already has both fields. */
export interface GauntletDigest {
    /** Gauntlet fights won, 0 to 3. */
    readonly fightsWon: number;
    /** All three won. */
    readonly cleared: boolean;
}

export interface GauntletRow {
    readonly label: string;
    /** Parties that stood at the gate. */
    readonly parties: number;
    readonly clearPct: number;
    readonly meanFightsWon: number;
}

/** A tier with no parties is a row of zeros, not a NaN. */
export function gauntletRow(label: string, results: ReadonlyArray<GauntletDigest>): GauntletRow {
    return {
        label,
        parties: results.length,
        clearPct: results.length === 0 ? 0 : (100 * results.filter((r) => r.cleared).length) / results.length,
        meanFightsWon: mean(results.map((r) => r.fightsWon)),
    };
}

/**
 * One row per tier 0..`maxTier`: every tier plays every snapshot. `play` is `playGauntlet` in the
 * balance run and a stub in the unit tests.
 */
export function gauntletRows<S>(
    snapshots: ReadonlyArray<S>, play: (snapshot: S, tier: number) => GauntletDigest, maxTier: number,
): GauntletRow[] {
    const rows: GauntletRow[] = [];
    for (let tier = 0; tier <= maxTier; tier += 1) {
        rows.push(gauntletRow(`Tier ${tier}`, snapshots.map((snapshot) => play(snapshot, tier))));
    }
    return rows;
}

/** A markdown table. */
export function formatGauntlet(rows: ReadonlyArray<GauntletRow>): string {
    const head = ['Configuration', 'Parties', 'Clear gauntlet', 'Gauntlet fights won (0-3)'];
    const lines = rows.map((row) => [row.label, String(row.parties), `${row.clearPct.toFixed(1)}%`, row.meanFightsWon.toFixed(2)]);
    const render = (cells: ReadonlyArray<string>): string => `| ${cells.join(' | ')} |`;
    return [render(head), render(head.map(() => '---')), ...lines.map(render)].join('\n');
}

/**
 * The gauntlet ladder's check. Returns what is wrong, in words with the numbers in them, or null.
 *
 * 1. Gauntlet fights won never rises from one tier to the next.
 * 2. The top tier is not a wall: a top tier that wins no gauntlet fight at all in any party cannot
 *    be told apart from a gauntlet that is broken (a snapshot that does not load loses too), and the
 *    first check would pass it because zero never rises.
 * 3. There are parties to measure.
 *
 * Nothing here tunes anything. A failure is a finding for Henry, with the table.
 */
export function gauntletLadderProblem(rows: ReadonlyArray<GauntletRow>): string | null {
    if (rows.length === 0 || rows.every((row) => row.parties === 0)) {
        return 'No party reached the gym gate, so the gauntlet ladder measured nothing.';
    }
    for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].meanFightsWon > rows[i - 1].meanFightsWon) {
            return `${rows[i].label} is EASIER than ${rows[i - 1].label} in the gauntlet: ${rows[i].meanFightsWon.toFixed(2)} fights won against ${rows[i - 1].meanFightsWon.toFixed(2)}. Do not tune; report the table.`;
        }
    }
    const top = rows[rows.length - 1];
    if (top.parties > 0 && top.meanFightsWon === 0) {
        return `${top.label} won no gauntlet fight in ${top.parties} parties (0.00 fights won). Either the tier is a wall or the gauntlet is broken; the numbers cannot say which. Do not tune; report the table.`;
    }
    return null;
}

/** Where a snapshot's deck came from: the walks the gauntlet table stands on. */
export interface SnapshotOrigin {
    readonly ghostFights: number;
    readonly realFightsWon: number;
}

export interface ProvenanceRow {
    readonly parties: number;
    readonly meanRealFightsWon: number;
    readonly meanGhostFights: number;
    /** Percent of parties that reached the gate without a single ghost fight (a real walk would have got there too). */
    readonly noGhostPct: number;
}

export function provenanceRow(origins: ReadonlyArray<SnapshotOrigin>): ProvenanceRow {
    return {
        parties: origins.length,
        meanRealFightsWon: mean(origins.map((o) => o.realFightsWon)),
        meanGhostFights: mean(origins.map((o) => o.ghostFights)),
        noGhostPct: origins.length === 0 ? 0 : (100 * origins.filter((o) => o.ghostFights === 0).length) / origins.length,
    };
}

export function formatProvenance(row: ProvenanceRow): string {
    return `${row.parties} parties at the gate; each won ${row.meanRealFightsWon.toFixed(2)} fights for real and was carried through ${row.meanGhostFights.toFixed(2)} lost ones on average; ${row.noGhostPct.toFixed(1)}% needed no carrying at all.`;
}
