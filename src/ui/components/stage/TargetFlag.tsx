/**
 * THE TARGET FEEDBACK — ticket 183b. While a card is lit, the hovered target shows a yellow cursor
 * and the words "Super effective" or "Not very effective" (words, not colour); a unit the card
 * cannot land on says "Can't target", with the reason in its hover title.
 *
 * Yellow is the one selection colour, so the cursor is yellow and nothing else here is.
 */
import React from 'react';

import type { TargetVerdict } from '../../utils/targeting';

export interface TargetFlagProps {
    readonly verdict: TargetVerdict;
    /** Set only for the hover target: what the held card would do to it. */
    readonly effectiveness: number | null;
}

export function TargetFlag({ verdict, effectiveness }: TargetFlagProps): React.ReactElement | null {
    if (!verdict.ok) {
        return (
            <div className="stage-target-flag is-illegal k-slant k-display" title={verdict.reason ?? undefined}>
                Can&apos;t target
            </div>
        );
    }
    // A legal target says nothing until the pointer is on it.
    if (effectiveness === null) return null;
    const words = effectiveness > 1 ? 'Super effective' : effectiveness < 1 ? 'Not very effective' : null;
    return (
        <div className="stage-target-flag is-legal" data-testid="target-cursor">
            <div className="stage-target-cursor" />
            {words !== null && (
                <div className={`stage-target-words k-slant k-display ${effectiveness > 1 ? 'is-super' : 'is-weak'}`}>
                    {words}
                </div>
            )}
        </div>
    );
}
