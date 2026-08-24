/**
 * Getting the run log OFF the machine — ticket 59, deliverable 3.
 *
 * The log is worth exactly as much as the tester's ability to hand it over. Everything found in the
 * 2026-08-24 playtest was reconstructed from one sentence of recollection each and then confirmed
 * by reading constants; that works for one tester who owns the repo and for nobody else. So the
 * transcript has to become a file, in one click, from a screen the player can already reach.
 *
 * Deliberately a plain download and nothing more. Uploading is ticket 53's (opt-in telemetry,
 * post-launch); this writes a file the tester chooses to attach to a message, which is the only
 * shape that needs no privacy policy and no network.
 *
 * The Blob-plus-synthetic-anchor mechanism is `debug/snapshotIO.triggerDownload`'s, and this does
 * NOT import it: `src/debug` is DEV-only and behind a build gate that `scripts/assert-no-debug.mjs`
 * enforces, so a production module importing it would drag the whole toolkit into `dist/` and fail
 * the build. Twelve duplicated lines is the correct price for that boundary.
 */

import {
    RUN_LOG_RUNS,
    findRunLog,
    readRunLogs,
    serializeOneRunLog,
    serializeRunLogs,
} from '../../engine/run/runLog';

/** How many runs are on file. Drives the button's label and its disabled state. */
export function storedRunLogCount(): number {
    return readRunLogs().length;
}

export { RUN_LOG_RUNS };

/** `2026-08-24T0312` — sortable, filename-safe, and enough to tell two files in a session apart. */
function stampOf(now: Date): string {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${now.toISOString().slice(0, 10)}T${hh}${mm}`;
}

/**
 * Blob, anchor, click, revoke.
 *
 * Extracted when auto-save arrived and gained a second caller, and it is the whole reason the
 * duplication of `debug/snapshotIO.triggerDownload` is now paying for itself twice rather than
 * once. Still not imported from there: `src/debug` is behind the build gate.
 */
function downloadJson(fileName: string, contents: string): void {
    const blob = new Blob([contents], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoked, for `snapshotIO`'s reason: a leaked object URL pins its Blob for the page's life.
    URL.revokeObjectURL(url);
}

/**
 * Write every stored transcript to a file and return the name it was saved as.
 *
 * Returns null when there is nothing to write, so the caller never claims a save that did not
 * happen. The clock is read HERE rather than in the engine, exactly as `runTelemetry` takes its
 * `endedAt` injected — a module that reads `Date.now()` cannot be tested deterministically.
 */
export function exportRunLogs(): string | null {
    const logs = readRunLogs();
    if (logs.length === 0) return null;

    const now = new Date();
    const fileName = `mingming-run-log-${stampOf(now)}.json`;
    downloadJson(fileName, serializeRunLogs(now.getTime()));
    return fileName;
}

/**
 * AUTO-SAVE — write ONE finished run to a file, unprompted.
 *
 * Henry: *"Having to export at the right time doesn't work. I often forget."* Correct diagnosis:
 * an export a tester has to remember is an export that does not happen, and the data was already
 * being recorded perfectly and then thrown away three runs later.
 *
 * # WHY A DOWNLOAD AND NOT A PATH
 *
 * A browser page cannot write to a chosen folder on its own. The two things that could:
 *
 *  - **The File System Access API** (`showDirectoryPicker`) — the tester picks a folder once and
 *    the handle is stored, after which writes are silent. It is **Chrome/Edge 86+ only; Firefox and
 *    Safari do not implement it**, and Chrome's own documentation says permission *"is not always
 *    persisted between sessions"* and re-requesting it **needs a user gesture**. So the failure mode
 *    is a tester who turned it on, played three runs, and silently saved nothing — which is the
 *    exact failure this is meant to remove, relocated rather than fixed.
 *  - **The desktop build** ([ticket 42](../../../docs/wayfinder/steam-release/tickets/42-desktop-packaging.md)),
 *    where there is a real writable path and none of this applies. That is the right long-term
 *    home, and 59's resolution flags it.
 *
 * A download needs no API that some testers lack and no permission that can lapse. The folder is
 * the one every tester already knows, and the instruction is one sentence: *turn this on, play,
 * send me everything in Downloads called `mingming-run-*.json`*. Chromium asks once per site to
 * allow multiple downloads; the settings copy says so, because a tester who dismisses that prompt
 * needs to know what they just switched off.
 *
 * # ONE FILE PER RUN
 *
 * Not one growing file: a browser download cannot append. Per-run files also survive the store's
 * three-run window — the whole point, since a five-run session currently loses its first two — and
 * the envelope is identical to the bulk export's, so a pile of them reads with one parser.
 *
 * Returns the file name, or null when there is no such log. The CALLER owns idempotency (see
 * `RunSummary`): this function will happily write the same run twice if asked.
 */
export function autoSaveRunLog(runKey: string, outcome: string): string | null {
    const log = findRunLog(runKey);
    if (!log) return null;

    const now = new Date();
    /*
     * The outcome is passed IN rather than read off the log's own `RUN_ENDED` row.
     *
     * The caller (`RunSummary`) holds `run.outcome` authoritatively; the log's copy can be absent
     * — a capped transcript drops rows, and the last row of a long run is the likeliest casualty.
     * Reading it from there would name that file `-unfinished-` for a run that was won, which is a
     * lie in the one place a reader looks before opening anything.
     */
    // The seed is in the name so a file identifies its run without being opened, and sanitised
    // because a seed is an arbitrary string and a slash in a download name is a silent failure.
    const seed = log.seed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'run';
    const suffix = outcome.replace(/[^a-z]/gi, '') || 'ended';
    const fileName = `mingming-run-${stampOf(now)}-${suffix}-${seed}.json`;

    downloadJson(fileName, serializeOneRunLog(log, now.getTime()));
    return fileName;
}
