/**
 * STATUS BADGES — the emoji chip, its tooltip, and the `+k` that stands in for the rest.
 *
 * # WHY THIS IS ITS OWN FILE (ticket 145b)
 *
 * These lived inside `MingmingUnit` while the HUD card was the only place a status could be read.
 * 145b moves them onto the stage plaque, and a plaque and a HUD card showing the same status
 * differently is worse than either — a player learns one vocabulary, not two. So there is one
 * implementation with one tooltip, and the two surfaces differ only in how many chips they have
 * room for.
 *
 * The BUDGET is per surface and is arithmetic, not taste. The HUD card's row is 195px and fits six;
 * the plaque is 168px wide with 8px of side padding, so 152px of content fits four chips (4x28 +
 * 3x2 = 118) and still has room for the 18px overflow chip beside them (138). Ticket 145 §2b asks
 * for exactly that: "one row, overflow chip after the fourth".
 *
 * The overflow is a CHIP, not a clip, on both surfaces: a hidden status still decides whether a
 * card is safe to play, so the `+k` names every one of them and its stacks on hover.
 */
import React from 'react';
import { createPortal } from 'react-dom';

import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';
import type { StatusType } from '../../engine/types';
import { JS_COLOR } from '../theme/jsColors';
import { StatusIcon } from '../theme/kit/StatusIcon';
import { useAnchoredRect } from '../hooks/useAnchoredRect';
import { displayStacks } from './displayStacks';
import { StatusTooltipPortal } from './StatusTooltip';
import { visibleStatuses } from './statusRanking';

/** The HUD card's row is 195px wide. See `.hud-status-badges` in index.css for the fit. */
export const HUD_STATUS_BUDGET = 6;
/** The stage plaque is 168px wide. §2b: "one row, overflow chip after the fourth". */
export const PLAQUE_STATUS_BUDGET = 4;
/**
 * Status badge with a hover tooltip explaining the mechanic.
 * Rendered through a portal (same pattern as the OS/intent tooltips)
 * so parent overflow never clips it.
 */
const StatusBadge: React.FC<{ type: StatusType; stacks: number }> = ({ type, stacks }) => {
    const [showTooltip, setShowTooltip] = React.useState(false);
    // Ticket 55: measured after layout rather than read during render — see `useAnchoredRect`.
    const { ref: badgeRef, rect } = useAnchoredRect<HTMLDivElement>(showTooltip);
    const info = statusGlossary[type];
    const color = STATUS_COLORS[type] ?? JS_COLOR.textDim;
    // BarkShield stacks are a %maxHp float that decays 20% a turn - round for display only.
    const shownStacks = displayStacks(stacks);

    return (
        <div
            ref={badgeRef}
            className="hud-status-badge"
            style={{ borderColor: color, color }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className="hud-status-icon"><StatusIcon status={type} size={14} /></span>
            {stacks > 1 && <span className="hud-status-stacks">×{shownStacks}</span>}

            {showTooltip && info && rect !== null && (
                <StatusTooltipPortal type={type} stacks={stacks} rect={rect} />
            )}
        </div>
    );
};

/**
 * The `+k` chip that stands in for every status past `STATUS_BADGE_BUDGET`. Same portal-tooltip
 * pattern as `StatusBadge` so the list it carries is never clipped by the row that made it
 * necessary.
 */
export const StatusOverflowBadge: React.FC<{
    hidden: ReadonlyArray<{ type: StatusType; stacks: number }>;
    /** The chip row of the stage plaque (183b) draws this in the kit's chip shape. */
    className?: string;
}> = ({ hidden, className = 'hud-status-badge hud-status-more' }) => {
    const [showTooltip, setShowTooltip] = React.useState(false);
    const { ref: badgeRef, rect } = useAnchoredRect<HTMLDivElement>(showTooltip);

    return (
        <div
            ref={badgeRef}
            className={className}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className="hud-status-stacks">+{hidden.length}</span>

            {showTooltip && rect !== null && createPortal(
                <div
                    className="os-tooltip-portal"
                    style={(() => {
                        const isRightSide = rect.left > window.innerWidth / 2;
                        return {
                            position: 'fixed' as const,
                            left: isRightSide ? 'auto' : rect.right + 12,
                            right: isRightSide ? (window.innerWidth - rect.left) + 12 : 'auto',
                            top: rect.top,
                            transform: 'translateY(-30%)',
                            borderColor: 'rgba(148, 163, 184, 0.55)',
                        };
                    })()}
                >
                    <div className="tooltip-title">ALSO ACTIVE</div>
                    {hidden.map(se => (
                        <div key={se.type} style={{ color: STATUS_COLORS[se.type] ?? JS_COLOR.textDim }}>
                            <StatusIcon status={se.type} size={12} /> {se.type}
                            {se.stacks > 1 ? ` \u00d7${Math.round(se.stacks * 10) / 10}` : ''}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

/** One row of badges with its overflow chip. Both surfaces render exactly this. */
export const StatusBadgeRow: React.FC<{
    statuses: ReadonlyArray<{ id?: string; type: StatusType; stacks: number }>;
    budget: number;
    /** True where the row is too tight to hold the budget AND a chip — see `visibleStatuses`. */
    chipCostsSlot?: boolean;
    className?: string;
}> = ({ statuses, budget, chipCostsSlot = false, className }) => {
    if (statuses.length === 0) return null;
    const { shown, hidden } = visibleStatuses(statuses, budget, chipCostsSlot);
    return (
        <div className={className ?? 'hud-status-badges'}>
            {shown.map((se, i) => (
                <StatusBadge key={se.id || `${se.type}-${i}`} type={se.type} stacks={se.stacks} />
            ))}
            {hidden.length > 0 && <StatusOverflowBadge hidden={hidden} />}
        </div>
    );
};