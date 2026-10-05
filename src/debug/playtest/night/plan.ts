/**
 * TICKET 180f — WHICH SESSIONS A NIGHT PLAYS.
 *
 * A night is N sessions, one after another (A5: ten by default). Seeds are `pt<seed date>:<i>` (the seed date is the date unless 193k's `--seed-date` says otherwise), the
 * starters rotate through the twelve Early Access starters and the gyms through the three on offer
 * (or, with 195k's `gymFor`, each starter plays the gym its element beats), so a night covers as much
 * of the game as N allows. Modes follow A2: `run` for most, plus one
 * `card` run a night aimed at surprises (and `turn` runs when asked for). Pure, so the nightly
 * script can ask for the plan and a test can read it.
 */
import type { PlaytestMode } from '../types';

export interface NightEntry {
    /** 1-based position in the night. */
    readonly index: number;
    /** The session's name, and its folder under `results/playtest/<date>/`. */
    readonly session: string;
    readonly seed: string;
    readonly starter: string;
    readonly gym: number;
    readonly mode: PlaytestMode;
    readonly tier: number;
}

export interface NightOptions {
    readonly runs?: number;
    /** How many of the last sessions are played in `card` mode. Default 1 (none when there is only one session). */
    readonly cardRuns?: number;
    /** How many sessions, just before the card ones, are played in `turn` mode. Default 0. */
    readonly turnRuns?: number;
    readonly tier?: number;
    /**
     * TICKET 193k: the date the seeds are named after (default: the night's own date). A night on a new
     * date with an old seed date plays the same worlds again, in a results folder of its own.
     */
    readonly seedDate?: string;
    /**
     * TICKET 195k: which gym a session plays, as an index into that seed's own offer. The plan knows nothing
     * about elements, so the caller passes the real one (`night/gymFor.ts`); without it the gyms just rotate.
     */
    readonly gymFor?: (seed: string, starter: string) => number;
}

export const DEFAULT_NIGHT_RUNS = 10;
const GYMS_ON_OFFER = 3;

export function planNight(date: string, starters: ReadonlyArray<string>, options: NightOptions = {}): NightEntry[] {
    const runs = options.runs ?? DEFAULT_NIGHT_RUNS;
    if (!Number.isInteger(runs) || runs < 1) throw new Error('a night needs at least one run');
    if (starters.length === 0) throw new Error('no starters to rotate through');
    const card = Math.min(options.cardRuns ?? (runs > 1 ? 1 : 0), runs);
    const turn = Math.min(options.turnRuns ?? 0, runs - card);
    return Array.from({ length: runs }, (_, i) => {
        const index = i + 1;
        const mode: PlaytestMode = i >= runs - card ? 'card' : i >= runs - card - turn ? 'turn' : 'run';
        const seed = `pt${options.seedDate ?? date}:${index}`;
        const starter = starters[i % starters.length];
        return {
            index,
            session: `r${String(index).padStart(2, '0')}`,
            seed,
            starter,
            gym: options.gymFor ? options.gymFor(seed, starter) : i % GYMS_ON_OFFER,
            mode,
            tier: options.tier ?? 0,
        };
    });
}
