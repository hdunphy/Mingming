/**
 * TICKET 202c — PLAYING A SESSION'S MOVES INTO A WORLD, ACROSS THE BOUNDARY BETWEEN ITS TWO RUNS.
 *
 * A session's moves are one list. When the session has a second run, `run2.atMove` is where run 1 ended: the
 * moves before it are played into run 1's world, then run 2 is opened from run 1's end state (`beginSecondRun`)
 * and the rest are played into that. A session with no second run goes through here unchanged: the same moves
 * into the same world, the same "is another move chained to this one" look-ahead.
 *
 * Which world a count of moves lands in, when the count is exactly the boundary: the whole session (the screen
 * `state` shows) is in run 2, because run 2 has begun; a shorter look at the first `atMove` moves (`replay --to`)
 * is run 1 as it ended, so a finding in run 1's last move can still be reproduced.
 */
import { beginSecondRun } from './secondRun';
import type { LoggedMove, SecondRun, SessionFile, World } from './types';
import { applyMove, createWorld } from './world';

/**
 * Play `moves[from..upTo)` into `world`. `moves` is the look-ahead list (a chained move is "more" of the call
 * before it); `total` is how many moves the whole session has. Returns the world to carry on with, which is a
 * new one when run 2 was opened on the way.
 */
export function playMoves(world: World, run2: SecondRun | undefined, moves: ReadonlyArray<LoggedMove>, from: number, upTo: number, total: number): World {
    let current = world;
    for (let i = from; i < upTo; i += 1) {
        if (run2 !== undefined && i === run2.atMove && current.runNumber === 1) current = beginSecondRun(current, run2);
        applyMove(current, moves[i], moves[i + 1]?.chained === true);
    }
    if (run2 !== undefined && current.runNumber === 1 && upTo === total && upTo >= run2.atMove) current = beginSecondRun(current, run2);
    return current;
}

/** The world after the session's first `upTo` moves (all of them by default), rebuilt from move 0. */
export function replaySession(session: SessionFile, upTo: number = session.moves.length): World {
    return playMoves(createWorld(session), session.run2, session.moves.slice(0, upTo), 0, upTo, session.moves.length);
}
