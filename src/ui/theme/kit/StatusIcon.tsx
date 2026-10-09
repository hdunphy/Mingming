/**
 * ONE STATUS ICON - ticket 183b. A flat glyph in `currentColor` for a status, so the chip decides
 * its colour and the same icon works on a navy chip, a white card and a tooltip. Drawn from Tabler
 * (ticket 200d) at stroke 2, the weight that reads at 12px.
 */
import React from 'react';

import type { StatusType } from '../../../engine/types';
import { outlineLayers } from '../glyphLayers';
import { TablerGlyph } from '../TablerGlyph';
import './kit.css';
import { STATUS_ICON_NAMES, STATUS_STROKE } from './statusIconPaths';

export interface StatusIconProps {
    readonly status: StatusType;
    /** Side in px. */
    readonly size?: number;
}

export function StatusIcon({ status, size = 12 }: StatusIconProps): React.ReactElement {
    const name = STATUS_ICON_NAMES[status];
    return (
        <TablerGlyph
            layers={name === undefined ? [] : outlineLayers(name)}
            size={size}
            strokeWidth={STATUS_STROKE}
            className="k-status-icon"
            data-status-icon={status}
        />
    );
}
