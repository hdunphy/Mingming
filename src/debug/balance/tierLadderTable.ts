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
