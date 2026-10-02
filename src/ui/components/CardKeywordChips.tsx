import React from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredRect } from '../hooks/useAnchoredRect';
import type { ProgramData, StatusType } from '../../engine/types';
// Ticket 55: the keyword table and its two derivations moved to `cardKeywords.ts`, so this file
// exports only components.
import { KEYWORD_INFO, appliedStacks, getAppliedStatuses, getCardKeywords } from './cardKeywords';
import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';
import { StatusIcon } from '../theme/kit/StatusIcon';

/** Small slanted chip with a portal tooltip (never clipped by parent overflow). */
const Chip: React.FC<{ label: string; color: string; title: string; description: string; icon?: React.ReactNode }> = ({
    label, color, title, description, icon
}) => {
    const [hovered, setHovered] = React.useState(false);
    // Ticket 55: measured after layout rather than read during render — see `useAnchoredRect`.
    const { ref: chipRef, rect } = useAnchoredRect<HTMLSpanElement>(hovered);

    return (
        <span
            ref={chipRef}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="k-slant rs-kwchip"
            style={{ color }}
        >
            {icon}
            {label}
            {hovered && rect !== null && createPortal(
                <div
                    className="os-tooltip-portal"
                    style={(() => {
                        const isRightSide = rect.left > window.innerWidth / 2;
                        const isTopHalf = rect.top < window.innerHeight / 2;
                        return {
                            position: 'fixed' as const,
                            left: isRightSide ? 'auto' : rect.left,
                            right: isRightSide ? window.innerWidth - rect.right : 'auto',
                            top: isTopHalf ? rect.bottom + 8 : 'auto',
                            bottom: isTopHalf ? 'auto' : (window.innerHeight - rect.top) + 8,
                            borderColor: color,
                            width: '220px',
                            zIndex: 10001
                        };
                    })()}
                >
                    <div className="os-tooltip-header" style={{ color }}>
                        {title}
                    </div>
                    <div className="os-tooltip-desc">{description}</div>
                </div>,
                document.body
            )}
        </span>
    );
};

/**
 * Compact chip row for a card: keyword chips (EXHAUST / TOKEN / DAEMON)
 * plus one colored chip per status the card applies, each with a hover
 * tooltip drawn from the status glossary.
 */
/**
 * `2 BURN`, or just `BURN` for a single stack.
 *
 * Summed across actions rather than taken from the first: a card that applies one Weakened twice
 * applies two, and reading only the first action would print the smaller, wrong number on exactly
 * the cards where the count matters most.
 */
function chipLabel(data: ProgramData, status: StatusType): string {
    const stacks = appliedStacks(data, status);

    const name = statusGlossary[status].name.toUpperCase();
    return stacks > 1 ? `${stacks} ${name}` : name;
}

const CardKeywordChips: React.FC<{ data: ProgramData }> = ({ data }) => {
    const keywords = getCardKeywords(data);
    const statuses = getAppliedStatuses(data);
    if (keywords.length === 0 && statuses.length === 0) return null;

    return (
        // `rs-chips` so the hand can cap this to one row (155e's budget) without the shop losing
        // its wrap — the shop's tiles sit in a grid that grows and can afford two rows.
        <div className="rs-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
            {keywords.map(k => (
                <Chip
                    key={k}
                    label={KEYWORD_INFO[k].label}
                    color={KEYWORD_INFO[k].color}
                    title={KEYWORD_INFO[k].label}
                    description={KEYWORD_INFO[k].description}
                />
            ))}
            {statuses.map(s => (
                <Chip
                    key={s}
                    /*
                     * TICKET 155e — the chip carries the STACKS.
                     *
                     * `HandCardFace` used to print its own `→ 2 BURN` row beside this one, off the
                     * same actions; Henry's second screenshot shows both at once. The duplicate is
                     * gone, and the number moved here, because a chip that says BURN when the card
                     * applies two of them was always telling half the story — in the shop as well
                     * as in the fight.
                     */
                    label={chipLabel(data, s)}
                    icon={<StatusIcon status={s} size={10} />}
                    color={STATUS_COLORS[s]}
                    title={statusGlossary[s].name}
                    description={statusGlossary[s].description}
                />
            ))}
        </div>
    );
};

export default CardKeywordChips;
