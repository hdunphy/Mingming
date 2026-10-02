/**
 * THE READOUT STRIP — ticket 183a. The 22px strip at the foot of a hand card: the TRUE figure big
 * ("142", "+15"), "vs Huldra" small, and chips on the right (SUPER, RESIST, x N HITS, ABS n,
 * LETHAL). Scan the figures along the hand to compare. Built from `HandCardPreviewFace`, the same
 * numbers the old one-line readout printed.
 *
 * **`power` never appears here** (standing law: previews show true damage everywhere). A card that
 * neither damages nor heals has no figure, so this draws nothing; the card shows its 5px element
 * bar instead (183c).
 */
import type { ReactElement, ReactNode } from 'react';

import type { HandCardPreviewFace } from '../../components/HandCardFace';
import { formatMultiplier } from '../../components/elementMatchups';
import './kit.css';
import { elementVars } from './elementGlyphs';

export interface ReadoutStripProps {
    readonly preview: HandCardPreviewFace;
    readonly element: string;
}

export function ReadoutStrip({ preview, element }: ReadoutStripProps): ReactElement | null {
    const damage = preview.damage;
    const healing = preview.healing;
    if (!(damage > 0) && !(healing > 0)) return null;

    return (
        <div className="k-readout k-display" data-testid="readout-strip" style={elementVars(element)}>
            <div className="k-readout-figure">{damage > 0 ? damage : `+${healing}`}</div>
            {preview.measuredOn && (
                <div className="k-readout-vs">{damage > 0 ? 'vs' : 'to'} {preview.measuredOn}</div>
            )}
            <div className="k-readout-chips">
                {preview.effectiveness > 1 && (
                    <Chip kind="is-super">SUPER ×{formatMultiplier(preview.effectiveness)}</Chip>
                )}
                {preview.effectiveness < 1 && (
                    <Chip kind="is-weak">RESIST ×{formatMultiplier(preview.effectiveness)}</Chip>
                )}
                {preview.hitCount > 1 && <Chip kind="is-hits">×{preview.hitCount} HITS</Chip>}
                {/* 167i: whole numbers on screen. Bark Shield absorbs a share of max HP. */}
                {preview.absorbed > 0 && <Chip kind="is-abs">ABS {Math.round(preview.absorbed)}</Chip>}
                {preview.lethal && <Chip kind="is-lethal">LETHAL</Chip>}
            </div>
        </div>
    );
}

function Chip({ kind, children }: { kind: string; children: ReactNode }): ReactElement {
    return <div className={`k-slant k-readout-chip ${kind}`}>{children}</div>;
}
