/**
 * Overlay "lit" ranges on a description's upgrade segments — one pure function, so `CardFace` can
 * paint an upgraded number (163b) and a true conditional (2026-09-25) in the same sentence without
 * either feature knowing about the other.
 *
 * The segments concatenate to the description (that is `describeUpgrade`'s contract), so a range
 * into the description is a range into their concatenation, and each segment is cut at the range
 * boundaries that fall inside it.
 */

import type { DescriptionSegment } from './runShell';
import type { TextRange } from '../utils/conditionalClauses';

export interface PaintedSegment extends DescriptionSegment {
    readonly lit: boolean;
}

export function paintSegments(
    segments: ReadonlyArray<DescriptionSegment>,
    lit: ReadonlyArray<TextRange>,
): PaintedSegment[] {
    if (lit.length === 0) return segments.map((s) => ({ ...s, lit: false }));
    const isLit = (at: number) => lit.some((r) => at >= r.start && at < r.end);
    const cuts = new Set<number>(lit.flatMap((r) => [r.start, r.end]));

    const out: PaintedSegment[] = [];
    let offset = 0;
    for (const seg of segments) {
        const end = offset + seg.text.length;
        const inside = [...cuts].filter((c) => c > offset && c < end).sort((a, b) => a - b);
        let from = offset;
        for (const cut of [...inside, end]) {
            if (cut > from) {
                out.push({ text: seg.text.slice(from - offset, cut - offset), changed: seg.changed, lit: isLit(from) });
            }
            from = cut;
        }
        offset = end;
    }
    return out;
}
