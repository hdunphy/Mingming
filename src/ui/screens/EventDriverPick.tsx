/**
 * TICKET 168e — the Driver pick (Driver Shrine): two Drivers the run does not hold, take one.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { describeDriver } from '../../engine/data/driverRegistry';
import { playSfx } from '../audio/AudioEngine';
import type { DriverPickResult } from '../events/outcomePicks';

export interface EventDriverPickProps {
    readonly drivers: ReadonlyArray<string>;
    readonly onTake: (pick: DriverPickResult) => void;
    readonly onBack: () => void;
}

export default function EventDriverPick({ drivers, onTake, onBack }: EventDriverPickProps): ReactNode {
    const [selected, setSelected] = useState<string | null>(null);
    return (
        <>
            <p className="ev-text">Pick one Driver. It stays with you for the rest of the run.</p>
            <div className="ev-choices">
                {drivers.map((id) => {
                    const { name, description } = describeDriver(id);
                    return (
                        <button
                            key={id}
                            type="button"
                            className={`rs-btn ev-choice ${selected === id ? 'picked' : ''}`}
                            aria-pressed={selected === id}
                            onClick={() => { playSfx('uiClick'); setSelected(id); }}
                        >
                            <span className="ev-label">{name}</span>
                            <span className="ev-detail">{description}</span>
                        </button>
                    );
                })}
            </div>
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={selected === null} onClick={() => selected !== null && onTake({ driverId: selected })}>
                    TAKE DRIVER
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
