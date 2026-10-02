/**
 * THE END TURN BUTTON — ticket 183d. A 200 x 50 yellow slanted button in display type, directly
 * under the discard (§2c). The 171h nudge keeps its behaviour: pressed with Energy still
 * spendable it flashes, and the playable cards take a ring; the second press ends the turn. The
 * flash is a ring of white hard shadows, because a yellow ring around a yellow button is nothing.
 */
import React from 'react';

import './console.css';

export interface EndTurnButtonProps {
    readonly disabled: boolean;
    readonly onPress: () => void;
    /** How many cards could still be played, when the nudge is live. */
    readonly nudgeCount: number | null;
}

export const EndTurnButton: React.FC<EndTurnButtonProps> = ({ disabled, onPress, nudgeCount }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onPress}
        className={`end-turn-button k-slant k-display ${nudgeCount !== null ? 'nudge' : ''}`}
        title={nudgeCount !== null
            ? `${nudgeCount} card${nudgeCount === 1 ? '' : 's'} can still be played — press again to end the turn`
            : undefined}
    >
        End turn
    </button>
);
