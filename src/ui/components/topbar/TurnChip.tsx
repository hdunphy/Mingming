/**
 * THE TURN CHIP — ticket 183b. "TURN" small over the number, in a slant panel at the bar's left.
 * The number is the one the deck's per-turn plans are read against, so it is the big thing.
 */
import React from 'react';

import { SlantPanel } from '../../theme/kit/SlantPanel';

export function TurnChip({ turn }: { readonly turn: number }): React.ReactElement {
    return (
        <SlantPanel cut={8} className="battle-topbar-turn">
            <div className="battle-topbar-turn-body k-display">
                <span className="battle-topbar-turn-label">TURN </span>
                <b>{turn}</b>
            </div>
        </SlantPanel>
    );
}
