/**
 * THE RULES TEXT — ticket 183c. The card's description in body type. Two kinds of range are
 * picked out: a clause that is TRUE right now in the fight (`lit`, Henry 2026-09-25: "if dazed draw
 * one card ... should highlight") and, on an upgrade, the numbers that moved (163b). Both read as
 * the selection yellow behind ink text; yellow text on a white card would not be readable.
 */
import type { ReactElement } from 'react';

import type { TextRange } from '../../utils/conditionalClauses';
import { describeUpgrade } from '../runShell';
import { paintSegments } from '../litSegments';

export interface CardRulesProps {
    readonly description: string;
    /** When the face knows which card it is, an upgraded card's moved numbers are picked out. */
    readonly dataId?: string;
    readonly lit?: ReadonlyArray<TextRange>;
}

export function CardRules({ description, dataId, lit }: CardRulesProps): ReactElement {
    const segments = dataId === undefined
        ? [{ text: description, changed: false }]
        : describeUpgrade(dataId);
    const painted = paintSegments(segments, lit ?? []);
    return (
        <span className="rs-desc">
            {painted.map((seg, i) => {
                /*
                 * Unchanged, unlit text is the RAW STRING, not a wrapped span: a card with no
                 * upgrade and nothing lit renders byte-for-byte what `{description}` would, which
                 * is what keeps a highlight on ninety-eight cards from being a DOM change for all.
                 * Index keys: the segments are a pure function of one immutable string and the lit
                 * ranges, so the list cannot reorder and there is no identity to preserve.
                 */
                if (!seg.changed && !seg.lit) return seg.text;
                const cls = [seg.changed ? 'rs-upn' : '', seg.lit ? 'rs-lit' : ''].filter(Boolean).join(' ');
                return <span key={i} className={cls}>{seg.text}</span>;
            })}
        </span>
    );
}
