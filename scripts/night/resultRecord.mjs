/**
 * TICKET 202h — find the driver's `result` record in whatever it printed.
 *
 * The driver used to print one JSON document (`--output-format json`). From 202h it streams one
 * JSON object per line (`stream-json`), so a session leaves a transcript, and the `result` record
 * is the last line. This accepts all three shapes: a single document, an array, or JSON lines.
 */
const pick = (records) => records.find((r) => r && r.type === 'result') ?? records[records.length - 1];

export function findResult(stdout) {
    if (typeof stdout !== 'string' || stdout.trim() === '') return undefined;
    try {
        const parsed = JSON.parse(stdout);
        const record = Array.isArray(parsed) ? pick(parsed) : parsed;
        return record && typeof record === 'object' ? record : undefined;
    } catch { /* not one document: try JSON lines */ }
    const lines = [];
    for (const line of stdout.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try { lines.push(JSON.parse(line)); } catch { /* a stray line is skipped */ }
    }
    const results = lines.filter((r) => r && r.type === 'result');
    return results.length > 0 ? results[results.length - 1] : undefined;
}
