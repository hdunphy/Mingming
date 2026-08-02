import React from 'react';
import { createPortal } from 'react-dom';
import type { ProgramData, StatusType } from '../../engine/types';
import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';

/** Card keyword mechanics, explained in player-facing language. */
export const KEYWORD_INFO = {
    EXHAUST: {
        label: 'EXHAUST',
        color: '#ff9944',
        description: 'Removed to the exhaust pile after playing — not shuffled back this battle.'
    },
    TOKEN: {
        label: 'TOKEN',
        color: '#8888ff',
        description: 'Temporary card generated in battle; disappears afterward.'
    },
    DAEMON: {
        label: 'DAEMON',
        color: '#00d2ff',
        description: 'Installs on the unit for the rest of the battle; its effect stays active.'
    }
} as const;

export type CardKeyword = keyof typeof KEYWORD_INFO;

export function getCardKeywords(data: ProgramData): CardKeyword[] {
    const keywords: CardKeyword[] = [];
    if (data.category === 'Daemon') keywords.push('DAEMON');
    if (data.exhaust) keywords.push('EXHAUST');
    if (data.isToken) keywords.push('TOKEN');
    return keywords;
}

/** Unique statuses this card's STATUS / SHIFT_STANCE actions apply, in action order. */
export function getAppliedStatuses(data: ProgramData): StatusType[] {
    const statuses: StatusType[] = [];
    for (const action of data.actions) {
        let status: StatusType | undefined;
        if (action.type === 'STATUS') {
            status = (action as { status?: StatusType }).status;
        } else if (action.type === 'SHIFT_STANCE') {
            // Stance shifts grant a stance status on the card's owner — surface it
            // as a chip so players see the shift at a glance.
            const stance = (action as { stance?: 'Dark' | 'Light' }).stance;
            if (stance) status = stance === 'Dark' ? 'DarkStance' : 'LightStance';
        }
        if (status && statusGlossary[status] && !statuses.includes(status)) {
            statuses.push(status);
        }
    }
    return statuses;
}

/** Small neon chip with a portal tooltip (never clipped by parent overflow). */
const Chip: React.FC<{ label: string; color: string; title: string; description: string }> = ({
    label, color, title, description
}) => {
    const [hovered, setHovered] = React.useState(false);
    const chipRef = React.useRef<HTMLSpanElement>(null);

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
            {hovered && createPortal(
                <div
                    className="os-tooltip-portal"
                    style={chipRef.current ? (() => {
                        const rect = chipRef.current.getBoundingClientRect();
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
                    })() : {}}
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
