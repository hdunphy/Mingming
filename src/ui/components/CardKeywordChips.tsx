import React from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredRect } from '../hooks/useAnchoredRect';
import type { ProgramData } from '../../engine/types';
// Ticket 55: the keyword table and its two derivations moved to `cardKeywords.ts`, so this file
// exports only components.
import { KEYWORD_INFO, getAppliedStatuses, getCardKeywords } from './cardKeywords';
import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';

/** Small neon chip with a portal tooltip (never clipped by parent overflow). */
const Chip: React.FC<{ label: string; color: string; title: string; description: string }> = ({
    label, color, title, description
}) => {
    const [hovered, setHovered] = React.useState(false);
    // Ticket 55: measured after layout rather than read during render — see `useAnchoredRect`.
    const { ref: chipRef, rect } = useAnchoredRect<HTMLSpanElement>(hovered);

    return (
        <span
            ref={chipRef}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 5px',
                borderRadius: '4px',
                border: `1px solid ${color}`,
                background: 'rgba(0, 0, 0, 0.6)',
                color,
                fontSize: '0.6rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
                cursor: 'help'
            }}
        >
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
                            boxShadow: `0 0 20px ${color}55`,
                            width: '220px',
                            zIndex: 10001
                        };
                    })()}
                >
                    <div className="os-tooltip-header" style={{ color, borderBottomColor: `${color}55` }}>
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
const CardKeywordChips: React.FC<{ data: ProgramData }> = ({ data }) => {
    const keywords = getCardKeywords(data);
    const statuses = getAppliedStatuses(data);
    if (keywords.length === 0 && statuses.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
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
                    label={`${statusGlossary[s].icon ?? ''} ${statusGlossary[s].name}`.trim().toUpperCase()}
                    color={STATUS_COLORS[s]}
                    title={statusGlossary[s].name}
                    description={statusGlossary[s].description}
                />
            ))}
        </div>
    );
};

export default CardKeywordChips;
