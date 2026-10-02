/**
 * ONE STATUS ICON — ticket 183b. A flat glyph in `currentColor` for a status, so the chip decides
 * its colour and the same icon works on a navy chip, a white card and a tooltip.
 */
import React from 'react';

import type { StatusType } from '../../../engine/types';
import './kit.css';
import { STATUS_ICON_PATHS } from './statusIconPaths';

export interface StatusIconProps {
    readonly status: StatusType;
    /** Side in px. */
    readonly size?: number;
}

export function StatusIcon({ status, size = 12 }: StatusIconProps): React.ReactElement {
    const path = STATUS_ICON_PATHS[status];
    return (
        <svg
            className="k-status-icon"
            data-status-icon={status}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            {path !== undefined && <path d={path} />}
        </svg>
    );
}
