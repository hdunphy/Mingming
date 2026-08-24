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

import { RUN_LOG_RUNS, readRunLogs, serializeRunLogs } from '../../engine/run/runLog';

/** How many runs are on file. Drives the button's label and its disabled state. */
export function storedRunLogCount(): number {
    return readRunLogs().length;
}

export { RUN_LOG_RUNS };

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
    // `2026-08-24T0312` — sortable, filename-safe, and precise enough to tell two exports in one
    // session apart without pretending the log is timestamped to the second.
    const stamp = `${now.toISOString().slice(0, 10)}T${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `mingming-run-log-${stamp}.json`;

    const blob = new Blob([serializeRunLogs(now.getTime())], { type: 'application/json;charset=utf-8;' });
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

    return fileName;
}
