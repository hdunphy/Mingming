/**
 * THE DRAW AND DISCARD PILES' FACES — ticket 183d.
 *
 * The draw pile is three navy card backs, fanned a few pixels apart, with the count in a yellow
 * slanted plate on its corner. The discard is one dashed slot (it is a place, not a stock) with its
 * count in a white plate. The count is the number the player reads; the stack is the glance.
 *
 * Both render INSIDE the pile viewer's toggle button, so a click opens the list exactly as before.
 * `.pile-stack` and `.pile-count` keep their names for the tests and the viewers that wrap them.
 */
import React from 'react';

import './console.css';

export interface PileBacksProps {
    readonly kind: 'draw' | 'discard';
    readonly count: number;
}

export const PileBacks: React.FC<PileBacksProps> = ({ kind, count }) => (
    <span className={`pile-stack pile-stack-${kind}`}>
        {kind === 'draw'
            ? [0, 1, 2].map((depth) => (
                <span key={depth} className={`pile-card pile-card-${depth}`} aria-hidden="true" />
            ))
            : <span className="pile-slot" aria-hidden="true" />}
        <span className="pile-count k-slant k-display">{count}</span>
    </span>
);
