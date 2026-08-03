import React from 'react';
import { createPortal } from 'react-dom';
import { ElementalMatrix, STAB_BONUS } from '../../engine/combatUtils';
import type { Element } from '../../engine/types';
import { getElementAccent } from '../utils/contrastText';

/** Trim a multiplier for display: 2 → "2", 0.5 → "0.5", 0.375 → "0.375". */
export const formatMultiplier = (n: number): string => (Math.round(n * 1000) / 1000).toString();

export interface MatchupGroup {
    mult: number;
    targets: string[];
}

/**
 * Runtime-derived matchup summary for one element, grouped by multiplier so
 * the tooltip never falls out of sync with the engine's ElementalMatrix.
 */
export function getElementMatchups(element: string): { strong: MatchupGroup[]; weak: MatchupGroup[] } {
    const row = ElementalMatrix[element as Element] ?? {};
    const byMult = new Map<number, string[]>();
    for (const [target, mult] of Object.entries(row)) {
        if (typeof mult !== 'number' || mult === 1) continue;
        if (!byMult.has(mult)) byMult.set(mult, []);
        byMult.get(mult)!.push(target);
    }
    const groups = [...byMult.entries()].map(([mult, targets]) => ({ mult, targets }));
    return {
        strong: groups.filter(g => g.mult > 1).sort((a, b) => b.mult - a.mult),
        weak: groups.filter(g => g.mult < 1).sort((a, b) => a.mult - b.mult)
    };
}

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
    const wrapRef = React.useRef<HTMLSpanElement>(null);

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
            {hovered && createPortal(
                <div
                    className="os-tooltip-portal"
                    style={wrapRef.current ? (() => {
                        const rect = wrapRef.current.getBoundingClientRect();
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
                    })() : {}}
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
