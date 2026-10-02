/**
 * THE CARD HEADER — ticket 183c. Element mark · name · energy hexagon, on a band in the element's
 * colour with its lower edge cut on a slant. The band is the card's colour, so the element reads at
 * a glance across a fan of five; the mark inside it says which element by symbol.
 *
 * `extras` hangs off the cost (a discount's old price, "cannot pay", Reprogram's answer) because
 * those are facts about the cost, and none is common enough to reserve a row for.
 */
import type { ReactElement, ReactNode } from 'react';

import { ElementMark } from '../../theme/kit/ElementMark';
import { EnergyHex } from '../../theme/kit/EnergyHex';

export interface CardHeaderProps {
    readonly name: string;
    readonly element: string;
    /** Absent on a body that is not a card (a blueprint): no hexagon, nothing to pay. */
    readonly cost?: number;
}

export function CardHeader({ name, element, cost }: CardHeaderProps): ReactElement {
    return (
        <span className="rs-hd">
            <ElementMark element={element} size={18} />
            <span className="rs-cnm">{name}</span>
            {cost !== undefined && <EnergyHex n={cost} size={22} />}
        </span>
    );
}

/** The things that hang off the cost, drawn over the art slot's corner. */
export function CostExtras({ children }: { readonly children: ReactNode }): ReactElement | null {
    if (!children) return null;
    return <span className="rs-extras">{children}</span>;
}
