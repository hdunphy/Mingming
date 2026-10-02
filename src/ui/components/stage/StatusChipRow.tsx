/**
 * THE PLAQUE'S STATUS CHIPS — ticket 183b. Icon plus count on a small slanted plate, deepest pile
 * first, up to six of them (three to a line), with a `+k` chip standing in for every status past
 * that. Bark Shield is never in
 * this row: it is the brown band on the HP bar.
 */
import React from 'react';

import type { StatusType } from '../../../engine/types';
import { StatusChip } from '../../theme/kit/StatusChip';
import { StatusOverflowBadge } from '../StatusBadges';
import { visibleStatuses } from '../statusRanking';

/** How many chips the row spends before it folds the rest into `+k`. */
export const PLAQUE_CHIP_BUDGET = 6;

export interface StatusChipRowProps {
    readonly statuses: ReadonlyArray<{ id?: string; type: StatusType; stacks: number }>;
    readonly budget?: number;
}

export function StatusChipRow({ statuses, budget = PLAQUE_CHIP_BUDGET }: StatusChipRowProps): React.ReactElement | null {
    const rest = statuses.filter((status) => status.type !== 'BarkShield');
    if (rest.length === 0) return null;
    // Six chips, wrapped onto a second line beside the energy hexagon (Henry, 2026-10-02: "all
    // statuses visible up to 6"). The `+k` chip costs a slot, so a seventh shows five and `+2`.
    const { shown, hidden } = visibleStatuses(rest, budget, true);
    return (
        <div className="stage-plaque-statuses" data-testid="plaque-statuses">
            {shown.map((status, i) => (
                <StatusChip key={status.id || `${status.type}-${i}`} status={status.type} count={status.stacks} />
            ))}
            {hidden.length > 0 && (
                <StatusOverflowBadge hidden={hidden} className="k-slant k-chip k-display" />
            )}
        </div>
    );
}
