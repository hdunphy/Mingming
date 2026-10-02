/**
 * THE STATUS TOOLTIP — one implementation, two chips (ticket 183a).
 *
 * The status badge (`StatusBadges.tsx`) and the kit's `StatusChip` both open the same glossary
 * panel on hover. The panel used to live inside the badge; it moved here, unchanged, so the new
 * chip reads the same words and sits in the same place rather than drawing a second tooltip that
 * could drift from the first. Rendered through a portal so a parent's `overflow` never clips it.
 */
import React from 'react';
import { createPortal } from 'react-dom';

import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';
import type { StatusType } from '../../engine/types';
import type { AnchoredRect } from '../hooks/useAnchoredRect';
import { displayStacks } from './displayStacks';

export const StatusTooltipPortal: React.FC<{
    type: StatusType;
    stacks: number;
    rect: AnchoredRect;
}> = ({ type, stacks, rect }) => {
    const info = statusGlossary[type];
    if (!info) return null;
    const color = STATUS_COLORS[type] ?? '#ccc';
    const isRightSide = rect.left > window.innerWidth / 2;
    return createPortal(
        <div
            className="os-tooltip-portal"
            style={{
                position: 'fixed' as const,
                left: isRightSide ? 'auto' : rect.right + 12,
                right: isRightSide ? (window.innerWidth - rect.left) + 12 : 'auto',
                top: rect.top,
                transform: 'translateY(-30%)',
                borderColor: color,
                boxShadow: `0 0 20px ${color}55`,
            }}
        >
            <div className="tooltip-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                <span className="tooltip-os-name" style={{ color }}>{info.name.toUpperCase()}</span>
                <span style={{ color, opacity: 0.85, fontSize: '0.7rem', fontWeight: 700 }}>×{displayStacks(stacks)}</span>
            </div>
            <div className="tooltip-divider" />
            <div className="tooltip-body">{info.description}</div>
            <div className="tooltip-footer">STATUS READOUT</div>
        </div>,
        document.body,
    );
};
