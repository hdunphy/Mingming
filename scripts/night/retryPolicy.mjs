/**
 * TICKET 202h — which finished sessions the night plays once more, at the end.
 *
 * A stalled session (no move for the stall limit) and one whose driver failed before its time was
 * up are retried once: the session file holds every move so far, so the retry resumes, it does not
 * restart. A session that ran into the wall-clock limit is not retried: that limit is deliberate.
 * A retried session is never retried again.
 */
export function shouldRetry(record) {
    if (!record || record.skipped || record.dryRun || record.firstAttempt) return false;
    if (record.stalled) return true;
    return record.exitCode !== 0 && !record.timedOut;
}
