/**
 * TICKET 180f — WHICH SESSIONS A NIGHT PLAYS.
 *
 * A night is N sessions, one after another (A5: ten by default). Seeds are `pt<date>:<i>`, the
 * starters rotate through the twelve Early Access starters and the gyms through the three on offer,
 * so a night covers as much of the game as N allows. Modes follow A2: `run` for most, plus one
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
        return {
            index,
            session: `r${String(index).padStart(2, '0')}`,
            seed: `pt${date}:${index}`,
            starter: starters[i % starters.length],
            gym: i % GYMS_ON_OFFER,
            mode,
            tier: options.tier ?? 0,
        };
    });
}
