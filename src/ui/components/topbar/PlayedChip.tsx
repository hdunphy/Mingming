/**
 * THE CARDS-PLAYED CHIP — ticket 90's counter, in the kit's shape (183b). `PLAYED n` is a plain
 * number, not pips: draws mean there is no known maximum, so a pip row would draw a denominator the
 * game does not have. Lit (`is-live`) once something has been played this turn.
 */
import React from 'react';

export function PlayedChip({ played }: { readonly played: number }): React.ReactElement {
    return (
        <span
            className={`k-slant k-display battle-topbar-played ${played > 0 ? 'is-live' : ''}`}
            style={{ ['--k-cut' as string]: '5px' }}
            title="Cards you have played this turn — what stampede, momentum crash and the other per-card scalers multiply by."
        >
            PLAYED <b>{played}</b>
        </span>
    );
}
