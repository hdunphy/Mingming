import React from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredRect } from '../hooks/useAnchoredRect';
import { STAB_BONUS } from '../../engine/combatUtils';
import { getElementAccent } from '../utils/contrastText';
// Ticket 55: the matchup derivations moved to `elementMatchups.ts` so this file exports only a
// component. Four other files already imported them from here.
import { formatMultiplier, getElementMatchups } from './elementMatchups';

/**
 * Hover wrapper for an element badge/icon: shows a portal tooltip (same
 * pattern as CardKeywordChips / StatusBadge) explaining the element's
 * strong/weak matchups and the ×1.5 STAB rule — all derived at runtime
 * from the engine's ElementalMatrix.
 */
export const ElementMatchupHover: React.FC<{
    element: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
}> = ({ element, children, style }) => {
    const [hovered, setHovered] = React.useState(false);
    // Ticket 55: measured after layout rather than read during render — see `useAnchoredRect`.
    const { ref: wrapRef, rect } = useAnchoredRect<HTMLSpanElement>(hovered);

    const accent = getElementAccent(element);
    const { strong, weak } = getElementMatchups(element);
    const isNeutral = strong.length === 0 && weak.length === 0;

    return (
        <span
            ref={wrapRef}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', ...style }}
        >
            {children}
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
                            borderColor: accent,
                            boxShadow: `0 0 20px ${accent}55`,
                            width: '230px',
                            zIndex: 10001
                        };
                    })()}
                >
                    <div className="os-tooltip-header" style={{ color: accent, borderBottomColor: `${accent}55` }}>
                        {element.toUpperCase()} · ELEMENT
                    </div>
                    <div className="os-tooltip-desc">
                        {isNeutral ? (
                            <div>Neutral — no matchups, no STAB.</div>
                        ) : (
                            <>
                                {strong.map(g => (
                                    <div key={`s${g.mult}`} style={{ color: '#4dff88' }}>
                                        Strong vs {g.targets.join(', ')} (×{formatMultiplier(g.mult)})
                                    </div>
                                ))}
                                {weak.map(g => (
                                    <div key={`w${g.mult}`} style={{ color: '#c98080' }}>
                                        Weak vs {g.targets.join(', ')} (×{formatMultiplier(g.mult)})
                                    </div>
                                ))}
                                <div style={{ marginTop: '6px', color: accent }}>
                                    Matches a {element}-type unit: ×{formatMultiplier(STAB_BONUS)} STAB
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </span>
    );
};

export default ElementMatchupHover;
