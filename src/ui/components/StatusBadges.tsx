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
import { useAnchoredRect } from '../hooks/useAnchoredRect';
import { displayStacks } from './displayStacks';
import { StatusTooltipPortal } from './StatusTooltip';

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
    const color = STATUS_COLORS[type] ?? '#ccc';
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
            <span className="hud-status-icon">{info?.icon ?? '✦'}</span>
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
const StatusOverflowBadge: React.FC<{ hidden: ReadonlyArray<{ type: StatusType; stacks: number }> }> = ({ hidden }) => {
    const [showTooltip, setShowTooltip] = React.useState(false);
    const { ref: badgeRef, rect } = useAnchoredRect<HTMLDivElement>(showTooltip);

    return (
        <div
            ref={badgeRef}
            className="hud-status-badge hud-status-more"
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
                        <div key={se.type} style={{ color: STATUS_COLORS[se.type] ?? '#ccc' }}>
                            {statusGlossary[se.type]?.icon ?? '\u2726'} {se.type}
                            {se.stacks > 1 ? ` \u00d7${Math.round(se.stacks * 10) / 10}` : ''}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

/**
 * The badges a surface shows, deepest pile first, and the ones it hides.
 *
 * Sorted by STACKS rather than by application order. That matters only past the budget — but that
 * is exactly where it matters: `Dazed x7`, the number a player is deciding a `slander` on, must not
 * be the one that fell off the end. Ties keep their original order (`Array.sort` is stable), so a
 * board of 1-stack statuses does not shuffle itself every turn.
 */
/* Not exported: `react-refresh/only-export-components` allows a constant beside a component but
   not a function, and the only caller is the row below — the same shape `combatLogModel` took
   when this rule bit there. */
function visibleStatuses<T extends { stacks: number }>(
    all: ReadonlyArray<T>,
    budget: number,
    chipCostsSlot: boolean,
): { shown: T[]; hidden: T[] } {
    const ranked = [...all].sort((a, b) => b.stacks - a.stacks);
    if (ranked.length <= budget) return { shown: ranked, hidden: [] };
    // WHETHER THE CHIP COSTS A SLOT IS PER SURFACE, because it is a width question and the two
    // surfaces are different widths. On the HUD card's 195px row six badges are 185px and fit, but
    // six plus an 18px chip are 203px and do not — so it drops to five. The plaque's four are 118px
    // of its 152px, which leaves room for the chip beside them. Passing this rather than assuming
    // it is what stops one surface's arithmetic quietly governing the other.
    const room = chipCostsSlot ? budget - 1 : budget;
    return { shown: ranked.slice(0, room), hidden: ranked.slice(room) };
}

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