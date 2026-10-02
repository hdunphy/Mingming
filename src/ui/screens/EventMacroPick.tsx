/**
 * TICKET 168d — the macro pick (Macro Crate): three macros, take one.
 *
 * The reward screen's own `MacroRewardPick` does the choosing, including the full-rack case (pick
 * the slot to replace), so the two screens cannot drift. What is different here is that the pick is
 * not optional, so TAKE stays disabled until a macro is chosen and, on a full rack, a slot too.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { playSfx } from '../audio/AudioEngine';
import { MacroRewardPick } from '../components/MacroRewardPick';
import type { MacroPickResult } from '../events/outcomePicks';

export interface EventMacroPickProps {
    readonly choices: ReadonlyArray<string>;
    readonly rack: ReadonlyArray<string | null>;
    readonly onTake: (pick: MacroPickResult) => void;
    readonly onBack: () => void;
}

export default function EventMacroPick({ choices, rack, onTake, onBack }: EventMacroPickProps): ReactNode {
    const [value, setValue] = useState<MacroPickResult | null>(null);
    const rackFull = !rack.some((slot) => slot === null);
    const ready = value !== null && (!rackFull || value.replaceSlot !== undefined);
    return (
        <>
            <p className="ev-text">Pick one draught.</p>
            <MacroRewardPick choices={choices} rack={rack} value={value} onChange={setValue} />
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={!ready} onClick={() => value !== null && onTake(value)}>
                    TAKE DRAUGHT
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
