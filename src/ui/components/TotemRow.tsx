/**
 * THE TOTEMS ROW — ticket 194p.
 *
 * Henry: *"We should see the Totems somewhere as well, probably loadout."* The run's Totems as a row of
 * named tags, each with its rule as its tooltip, the way the ranch's Vault lists them. Totems belong to
 * the run, not to one body, so this is drawn once on a screen and never on each member. A run with none
 * draws nothing.
 */
import type { ReactNode } from 'react';

import { driverText } from '../labels/driverText';
import './TotemRow.css';

export interface TotemRowProps {
    readonly drivers: ReadonlyArray<string> | undefined;
    /** An event's penalty that ends after the next fight: listed after the permanent ones. */
    readonly tempDrivers?: ReadonlyArray<{ readonly driverId: string }>;
}

export function TotemRow({ drivers, tempDrivers }: TotemRowProps): ReactNode {
    const permanent = drivers ?? [];
    const temporary = tempDrivers ?? [];
    if (permanent.length === 0 && temporary.length === 0) return null;
    return (
        <div className="totem-row" role="group" aria-label="Totems">
            <span className="totem-row-label">TOTEMS</span>
            {permanent.map((id) => {
                const { name, description } = driverText(id);
                return <span key={id} className="totem-tag" title={description}>{name}</span>;
            })}
            {temporary.map(({ driverId }) => {
                const { name, description } = driverText(driverId);
                return <span key={`temp:${driverId}`} className="totem-tag temp" title={description}>{name} · next fight</span>;
            })}
        </div>
    );
}
