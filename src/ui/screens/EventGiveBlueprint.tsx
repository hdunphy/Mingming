/**
 * TICKET 168e — pick the blueprint an event takes (the Driver Shrine's offering): any species the
 * ranch holds at least one of. Nothing is spent here; `applyChoice` spends it after the Driver is
 * granted.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { playSfx } from '../audio/AudioEngine';
import type { BlueprintPickResult } from '../events/outcomePicks';

export interface EventGiveBlueprintProps {
    readonly blueprints: Readonly<Record<string, number>>;
    readonly onTake: (pick: BlueprintPickResult) => void;
    readonly onBack: () => void;
}

export default function EventGiveBlueprint({ blueprints, onTake, onBack }: EventGiveBlueprintProps): ReactNode {
    const [selected, setSelected] = useState<string | null>(null);
    const held = Object.entries(blueprints).filter(([, count]) => count >= 1);
    return (
        <>
            <p className="ev-text">Choose the trace to give up.</p>
            <div className="ev-choices">
                {held.map(([speciesId, count]) => (
                    <button
                        key={speciesId}
                        type="button"
                        className={`rs-btn ev-choice ${selected === speciesId ? 'picked' : ''}`}
                        aria-pressed={selected === speciesId}
                        onClick={() => { playSfx('uiClick'); setSelected(speciesId); }}
                    >
                        <span className="ev-label">{MingmingRegistry[speciesId]?.name ?? speciesId}</span>
                        <span className="ev-detail">You hold {count}.</span>
                    </button>
                ))}
            </div>
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={selected === null} onClick={() => selected !== null && onTake({ speciesId: selected })}>
                    CONFIRM
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
