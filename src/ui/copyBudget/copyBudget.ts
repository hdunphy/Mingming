/**
 * TICKET 182a — the copy budget, as a measurement.
 *
 * A screen opens with at most one sentence of copy. This module measures a rendered screen against
 * that rule so the test (`copyBudget.test.tsx`) can say exactly which screen broke it and how.
 *
 * What counts: every `<p>` in the markup. What does not: anything marked `sr-only` (read by a screen
 * reader, never seen), and `title=` hover text (an attribute, not a paragraph).
 */

/** The longest a paragraph may be, in characters. */
export const MAX_PARAGRAPH_CHARS = 140;
/** The most paragraphs a screen may open with. */
export const MAX_PARAGRAPHS = 1;

export interface CopyReport {
    readonly paragraphs: ReadonlyArray<string>;
}

/** Every visible `<p>` in a rendered screen, as trimmed text. */
export function readCopy(markup: string): CopyReport {
    const host = document.createElement('div');
    host.innerHTML = markup;
    host.querySelectorAll('.sr-only').forEach((node) => node.remove());
    const paragraphs = [...host.querySelectorAll('p')]
        .map((p) => (p.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 0);
    return { paragraphs };
}

/** Why a screen is over budget, or null when it is inside it. */
export function budgetProblem(report: CopyReport): string | null {
    if (report.paragraphs.length > MAX_PARAGRAPHS) {
        return `${report.paragraphs.length} paragraphs (max ${MAX_PARAGRAPHS}): ${report.paragraphs.map((p) => JSON.stringify(p.slice(0, 50))).join(', ')}`;
    }
    const long = report.paragraphs.find((p) => p.length > MAX_PARAGRAPH_CHARS);
    if (long) return `a paragraph of ${long.length} characters (max ${MAX_PARAGRAPH_CHARS}): ${JSON.stringify(long.slice(0, 60))}...`;
    return null;
}
