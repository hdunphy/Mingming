/**
 * Console formatting for the balance suite.
 *
 * A vitest failure message says which threshold broke; these lines say what the whole
 * batch looked like, which is the part that turns a red test into a balance decision.
 * Deliberately plain text - the machine-readable `balance_report.json` is
 * `docs/wayfinder/debug-toolkit/tickets/21-balance-auditor-report.md`'s job, not this one.
 */

import type { BatchResult, PairedBatchResult } from './runBatch';

/**
 * Run `fn` with the engine's `console.log` chatter suppressed.
 *
 * `checkDefeat` and `addExperience` log on every kill, so a 3,200-battle suite emits
 * hundreds of thousands of lines and buries the numbers the suite exists to print.
 * `warn` and `error` are left alone: those are signals, not noise.
 */
export function quietly<T>(fn: () => T): T {
    const realLog = console.log;
    console.log = () => {};
    try {
        return fn();
    } finally {
        console.log = realLog;
    }
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/** One line per batch: outcome split, the redline metrics, and the stall indicators. */
export function summarizeBatch(label: string, batch: BatchResult): string {
    return (
        `${label.padEnd(30)} ` +
        `n=${String(batch.iterations).padStart(4)} ` +
        `W/L/D=${batch.playerWins}/${batch.enemyWins}/${batch.draws} ` +
        `decisiveWin=${pct(batch.decisiveWinRate).padStart(6)} ` +
        `avgTurns=${batch.averageTurns.toFixed(1).padStart(5)} ` +
        `deadCards=${pct(batch.deadCardRatio).padStart(6)} ` +
        `ftk=${batch.ftkCount} ` +
        `stalled=${batch.truncatedCount}`
    );
}

/** As `summarizeBatch`, plus the two numbers only a both-orientations run can produce. */
export function summarizePaired(label: string, paired: PairedBatchResult): string {
    const stalemate = paired.pooled.decisive === 0 ? '  [NO DECIDED GAMES]' : '';
    return (
        summarizeBatch(label, paired.pooled) +
        ` firstMoverEdge=${(paired.firstMoverEdge >= 0 ? '+' : '') + pct(paired.firstMoverEdge)}` +
        ` sideBias=${pct(paired.sideBias)}` +
        stalemate
    );
}
