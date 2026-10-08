/**
 * TICKET 202h — the stall watchdog: has the session moved lately?
 *
 * On 2026-10-07 four sessions in a row (r26-r29) sat for up to 27 minutes without a move and then
 * ran into the 35-minute limit. The playtest tool was not the cause (their saved screens replay in
 * about 11 s); the time went into the driver's model calls. A session that has made no move for
 * `stallMinutes` is ended and marked stalled, so the night can retry it instead of waiting it out.
 *
 * One job: watch the mtime of the session file (the tool rewrites it on every move) and call
 * `onStall` once when it has not changed for `stallMinutes`. The clock, the stat and the timer are
 * injected so a test can drive it without waiting.
 */
import fs from 'node:fs';

const statMtime = (file) => {
    try { return fs.statSync(file).mtimeMs; } catch { return undefined; }
};

export function createStallWatch({
    sessionFile,
    stallMinutes,
    onStall,
    now = Date.now,
    mtimeOf = statMtime,
    every = (fn, ms) => setInterval(fn, ms),
    stop = (handle) => clearInterval(handle),
    pollMs = 30_000,
}) {
    if (!(stallMinutes > 0)) return { check: () => false, close: () => {} };
    let lastSeen = mtimeOf(sessionFile);
    let lastMove = now();
    let fired = false;
    const check = () => {
        if (fired) return true;
        const mtime = mtimeOf(sessionFile);
        if (mtime !== lastSeen) { lastSeen = mtime; lastMove = now(); return false; }
        if (now() - lastMove < stallMinutes * 60_000) return false;
        fired = true;
        onStall();
        return true;
    };
    const handle = every(check, pollMs);
    return { check, close: () => stop(handle) };
}
