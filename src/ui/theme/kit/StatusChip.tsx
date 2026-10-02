/**
 * THE STATUS CHIP — ticket 183a. Icon, then `x N` when there is more than one stack, on a small
 * slanted plate. Hover opens the same glossary panel as the old status badge (`StatusTooltip`), so
 * the words are one implementation. The plaque (183b) lays these in its status row.
 */
import React from 'react';

import type { StatusType } from '../../../engine/types';
import { displayStacks } from '../../components/displayStacks';
import { StatusTooltipPortal } from '../../components/StatusTooltip';
import { useAnchoredRect } from '../../hooks/useAnchoredRect';
import './kit.css';
import { StatusIcon } from './StatusIcon';

export interface StatusChipProps {
    readonly status: StatusType;
    readonly count: number;
}

export function StatusChip({ status, count }: StatusChipProps): React.ReactElement {
    const [hovered, setHovered] = React.useState(false);
    const { ref, rect } = useAnchoredRect<HTMLDivElement>(hovered);
    const shown = displayStacks(count);

    return (
        <div
            ref={ref}
            className="k-slant k-chip k-display"
            data-status={status}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <StatusIcon status={status} />
            {count > 1 && <span>×{shown}</span>}
            {hovered && rect !== null && <StatusTooltipPortal type={status} stacks={count} rect={rect} />}
        </div>
    );
}
