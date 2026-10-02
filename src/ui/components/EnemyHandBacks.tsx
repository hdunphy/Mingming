/**
 * THE ENEMY'S HAND, AS CARD BACKS — ticket 183b (D6: in). While the enemy-hand panel is closed, its
 * tab shows one small element-coloured back per card the enemy holds, so the SHAPE of the hand
 * reads at a glance: four cards, two of them blue. It says nothing a closed tab did not already
 * say by its count; it only draws the count.
 *
 * Eight is the most it draws, because the tab is only so tall; the number on the tab is still the
 * whole count. A card the enemy will draw after a reshuffle has no known element yet, so its back
 * is Neutral.
 */
import React from 'react';

import { elementVars } from '../theme/kit/elementGlyphs';

/** The most backs the tab draws. */
export const ENEMY_BACKS_MAX = 8;

export function EnemyHandBacks({ elements }: { readonly elements: ReadonlyArray<string> }): React.ReactElement | null {
    if (elements.length === 0) return null;
    return (
        <span className="ehp-backs" data-testid="enemy-hand-backs" aria-hidden="true">
            {elements.slice(0, ENEMY_BACKS_MAX).map((element, i) => (
                <i key={i} className="ehp-back" style={elementVars(element)} />
            ))}
        </span>
    );
}
