/**
 * TICKET 202h — what the driver's result says about HOW it ended, beside what it cost.
 *
 * `readUsage` keeps tokens, cost and turns. This keeps the rest a morning reader needs to tell an
 * API failure from a finished run: the result's `subtype` (`success`, `error_max_turns`,
 * `error_during_execution`, ...), whether it was an error, and the first 300 characters of its text
 * when it was. Anything missing is left out.
 */
import { findResult } from './resultRecord.mjs';

export function readOutcome(stdout) {
    const record = findResult(stdout);
    if (!record) return {};
    const isError = record.is_error === true;
    return {
        ...(typeof record.subtype === 'string' ? { subtype: record.subtype } : {}),
        ...(typeof record.is_error === 'boolean' ? { isError } : {}),
        ...(isError && typeof record.result === 'string' ? { errorText: record.result.slice(0, 300) } : {}),
    };
}
