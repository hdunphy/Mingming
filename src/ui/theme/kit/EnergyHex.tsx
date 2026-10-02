/**
 * ENERGY, AS A NUMBER IN A YELLOW HEXAGON — ticket 183a. Henry (2026-10-01): energy is "one of the
 * most important symbols" and the old pips did not read, so it is ONE symbol everywhere: the card
 * header, the plaque, the console. `n` is what it costs or what is left; `max` adds the `/max` of
 * a plaque's `2/2`.
 */
import type { ReactElement } from 'react';

import './kit.css';

export interface EnergyHexProps {
    readonly n: number;
    readonly max?: number;
    /** Height in px: 22 on cards, 20 on plaques. The width follows from the hexagon's shape. */
    readonly size?: number;
}

export function EnergyHex({ n, max, size = 22 }: EnergyHexProps): ReactElement {
    const label = max === undefined ? `Energy ${n}` : `Energy ${n}/${max}`;
    return (
        <div
            className="k-hex k-energy k-display"
            role="img"
            aria-label={label}
            title={label}
            style={{
                width: Math.round(size * 1.15),
                height: size,
                fontSize: Math.round(size * 0.62),
            }}
        >
            {n}
            {max !== undefined && <span className="k-energy-max">/{max}</span>}
        </div>
    );
}
