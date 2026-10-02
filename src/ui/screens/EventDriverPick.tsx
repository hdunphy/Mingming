/**
 * TICKET 168e — the Driver pick (Driver Shrine): two Drivers the run does not hold, take one.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { playSfx } from '../audio/AudioEngine';
import type { DriverPickResult } from '../events/outcomePicks';
import { plain } from '../labels/labels';
import { driverText } from '../labels/driverText';

export interface EventDriverPickProps {
    readonly drivers: ReadonlyArray<string>;
    readonly onTake: (pick: DriverPickResult) => void;
    readonly onBack: () => void;
}

export default function EventDriverPick({ drivers, onTake, onBack }: EventDriverPickProps): ReactNode {
    const [selected, setSelected] = useState<string | null>(null);
    return (
        <>
            <p className="ev-text">Pick one Totem. It stays with you for the rest of the run.</p>
            <div className="ev-choices">
                {drivers.map((id) => {
                    const { name, description } = driverText(id);
                    return (
                        <button
                            key={id}
                            type="button"
                            className={`rs-btn ev-choice ${selected === id ? 'picked' : ''}`}
                            aria-pressed={selected === id}
                            onClick={() => { playSfx('uiClick'); setSelected(id); }}
                        >
                            <span className="ev-label">{name}</span>
                            <span className="ev-detail">{plain(description)}</span>
                        </button>
                    );
                })}
            </div>
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={selected === null} onClick={() => selected !== null && onTake({ driverId: selected })}>
                    TAKE TOTEM
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
