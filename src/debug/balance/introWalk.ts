/**
 * TICKET 182c — THE INTRO WALK: does the one-fight leader land at the target?
 *
 * The existing walker (`walkRun`) with its `intro` switch on, over three starters and N seeds. Two
 * arms, because they answer two different questions:
 *
 *  - **plain**: a fight lost on the way ends the walk. The honest "how many players clear the intro".
 *  - **ghost**: a lost wild fight is carried on as a win (170a's rule), so every seed reaches the
 *    leader with a party and deck close to what a player who survived would hold. This isolates the
 *    leader fight itself, which is the number the ticket's 75% target is about.
 *
 * The leader is the last fight of a walk that reaches it (`kind === 'gym'`). Turns are the fights'
 * own turn counts, summed, so a report can say how long the intro runs at 20 s a turn (the ticket's
 * 15-20 minute budget).
 *
 * Nothing here changes a game rule; it only reads.
 */
import { walkRun, type WalkResult } from './runWalker';

export const INTRO_STARTERS_V1: ReadonlyArray<string> = ['kraken_v1', 'fenrir_v1', 'ratatoskr_v1'];

export interface IntroWalkRow {
    readonly seed: string;
    readonly starter: string;
    readonly reachedLeader: boolean;
    readonly leaderWon: boolean;
    readonly cleared: boolean;
    readonly fights: number;
    readonly turns: number;
    readonly recruited: string | null;
    /** The leader fight's own turn count (0 when it was not reached). */
    readonly leaderTurns: number;
    /** The longest single fight of the walk, in turns. */
    readonly maxFightTurns: number;
}

export function rowOf(starter: string, result: WalkResult): IntroWalkRow {
    const leader = result.fights.find((f) => f.kind === 'gym');
    return {
        seed: result.seed,
        starter,
        reachedLeader: leader !== undefined,
        leaderWon: leader?.won === true,
        cleared: result.outcome === 'victory',
        fights: result.fights.length,
        turns: result.fights.reduce((n, f) => n + f.turns, 0),
        // The event's free recruit is not in `result.recruits` (that lists workshop choices); its log row is.
        recruited: (result.log.events.find((e) => e.kind === 'RECRUITED') as { definitionId?: string } | undefined)?.definitionId ?? null,
        leaderTurns: leader?.turns ?? 0,
        maxFightTurns: result.fights.reduce((n, f) => Math.max(n, f.turns), 0),
    };
}

export function walkIntro(starter: string, seeds: number, label = 'intro', ghost = false, from = 0): IntroWalkRow[] {
    const rows: IntroWalkRow[] = [];
    for (let i = from; i < from + seeds; i += 1) {
        const result = walkRun({
            seed: `${label}:${starter}:${i}`, starter, gymIndex: 0, intro: true, ...(ghost ? { ghost: true } : {}),
        });
        rows.push(rowOf(starter, result));
    }
    return rows;
}

export interface IntroSummary {
    readonly starter: string;
    readonly runs: number;
    readonly reachedLeader: number;
    readonly leaderWins: number;
    readonly cleared: number;
    /** Leader wins as a share of the runs that reached it. */
    readonly leaderWinRate: number;
    readonly clearRate: number;
    readonly meanFights: number;
    readonly meanTurns: number;
    /** Mean turns per fight, over every fight played, and the longest single fight. */
    readonly turnsPerFight: number;
    readonly maxFightTurns: number;
    readonly recruits: Readonly<Record<string, number>>;
}

export function summariseIntro(starter: string, rows: ReadonlyArray<IntroWalkRow>): IntroSummary {
    const reached = rows.filter((r) => r.reachedLeader);
    const recruits: Record<string, number> = {};
    for (const r of rows) if (r.recruited) recruits[r.recruited] = (recruits[r.recruited] ?? 0) + 1;
    const mean = (n: number): number => (rows.length === 0 ? 0 : n / rows.length);
    return {
        starter,
        runs: rows.length,
        reachedLeader: reached.length,
        leaderWins: reached.filter((r) => r.leaderWon).length,
        cleared: rows.filter((r) => r.cleared).length,
        leaderWinRate: reached.length === 0 ? 0 : reached.filter((r) => r.leaderWon).length / reached.length,
        clearRate: mean(rows.filter((r) => r.cleared).length),
        meanFights: mean(rows.reduce((n, r) => n + r.fights, 0)),
        meanTurns: mean(rows.reduce((n, r) => n + r.turns, 0)),
        turnsPerFight: rows.reduce((n, r) => n + r.fights, 0) === 0
            ? 0 : rows.reduce((n, r) => n + r.turns, 0) / rows.reduce((n, r) => n + r.fights, 0),
        maxFightTurns: rows.reduce((n, r) => Math.max(n, r.maxFightTurns), 0),
        recruits,
    };
}

/** Minutes the intro takes at `secondsPerTurn`, from a summary's mean turns (the ticket uses 20). */
export function minutesAt(summary: IntroSummary, secondsPerTurn = 20): number {
    return (summary.meanTurns * secondsPerTurn) / 60;
}
