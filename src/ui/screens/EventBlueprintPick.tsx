/**
 * TICKET 168d — the blueprint pick (Wild Tracks): three species, take one.
 *
 * Nothing is dispatched here. The event screen applies the pick (`applyBlueprintPick`) once the
 * player presses TAKE, so backing out costs nothing.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { playSfx } from '../audio/AudioEngine';
import type { BlueprintPickResult } from '../events/outcomePicks';

export interface EventBlueprintPickProps {
    readonly species: ReadonlyArray<string>;
    readonly onTake: (pick: BlueprintPickResult) => void;
    readonly onBack: () => void;
}

export default function EventBlueprintPick({ species, onTake, onBack }: EventBlueprintPickProps): ReactNode {
    const [selected, setSelected] = useState<string | null>(null);
    return (
        <>
            <p className="ev-text">Pick one trace. It goes to the ranch at once.</p>
            <div className="ev-choices">
                {species.map((id) => (
                    <button
                        key={id}
                        type="button"
                        className={`rs-btn ev-choice ${selected === id ? 'picked' : ''}`}
                        aria-pressed={selected === id}
                        onClick={() => { playSfx('uiClick'); setSelected(id); }}
                    >
                        <span className="ev-label">{MingmingRegistry[id]?.name ?? id}</span>
                        <span className="ev-detail">{MingmingRegistry[id]?.primaryElement ?? ''}</span>
                    </button>
                ))}
            </div>
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={selected === null} onClick={() => selected !== null && onTake({ speciesId: selected })}>
                    TAKE TRACE
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
