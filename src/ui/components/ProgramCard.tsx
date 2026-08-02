import React from 'react';
import { createPortal } from 'react-dom';
import type { ProgramData } from '../../engine/types';
import CardKeywordChips from './CardKeywordChips';
import ElementMatchupHover from './ElementMatchupTooltip';
import { getElementTextColor, getElementBadgeBg, badgeTextShadow, getElementAccent } from '../utils/contrastText';

/** A party member whose element matches this card (×1.5 STAB when they play it). */
export interface StabMatch {
    /** Display name of the matching party member. */
    name: string;
    /** The matching element (colors the dot). */
    element: string;
}

interface Props {
    data: ProgramData;
    count?: number;
    isSelected?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    showBadge?: string;
    className?: string;
    /** Optional: shows an explicit + button on hover (e.g. add a copy to the deck). */
    onAdd?: () => void;
    /** Optional: shows an explicit − button on hover (e.g. remove a copy from the deck). */
    onRemove?: () => void;
    addDisabled?: boolean;
    removeDisabled?: boolean;
    /** Optional: party members whose element matches this card — shown as tiny ×1.5 STAB dots. */
    stabMatches?: StabMatch[];
}

export const getElementIcon = (el: string) => {
    const map: Record<string, string> = {
        Fire: '🔥', Water: '💧', Nature: '🌿', Earth: '⛰️',
        Air: '💨', Ice: '❄️', Light: '✨', Dark: '🌑', None: '∅'
    };
    return map[el] ?? '◈';
};

export const getCategoryIcon = (cat: string) => {
    const map: Record<string, string> = {
        Attack: '⚔️', Skill: '⚙️', Daemon: '👾',
        Heal: '💚', Status: '🧪', Special: '🌟'
    };
    return map[cat] ?? '◈';
};

export const getElementColor = (el: string) => {
    const map: Record<string, string> = {
        Fire: 'var(--fire)', Water: 'var(--water)', Nature: 'var(--nature)',
        Earth: 'var(--earth)', Air: 'var(--air)', Ice: 'var(--ice)',
        Light: 'var(--light)', Dark: 'var(--dark)'
    };
    return map[el] ?? '#888';
};

const ProgramCard: React.FC<Props> = ({ data, count, isSelected, onClick, onContextMenu, showBadge, className = '', onAdd, onRemove, addDisabled, removeDisabled, stabMatches }) => {
    const [tooltipPos, setTooltipPos] = React.useState<{ top: number; left: number } | null>(null);
    const isHovered = tooltipPos !== null;
    const hasHoverActions = Boolean(onAdd || onRemove);

    const hoverBtnStyle = (disabled: boolean | undefined, color: string): React.CSSProperties => ({
        width: '26px',
        height: '26px',
        borderRadius: '6px',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.15)' : color}`,
        background: disabled ? 'rgba(20,20,30,0.85)' : 'rgba(10,10,18,0.92)',
        color: disabled ? '#555' : color,
        fontSize: '1rem',
        lineHeight: 1,
        fontWeight: 'bold',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0
    });

    const handleMouseEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({ top: rect.top, left: rect.right + 10 });
    };

    return (
        <div
            className={`program-card-container ${className} ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setTooltipPos(null)}
            style={{
                position: 'relative',
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${getElementColor(data.element)}44`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: '140px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                    background: getElementBadgeBg(data.element),
                    color: getElementTextColor(data.element),
                    textShadow: badgeTextShadow(getElementTextColor(data.element)),
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 800
                }}>
                    {data.baseCost}⚡
                </span>
                {/* Emojis ignore `color`; text glyphs (e.g. None's ∅) pick up the element tint. */}
                <ElementMatchupHover element={data.element}>
                    <span style={{ fontSize: '1.2rem', color: getElementColor(data.element), fontWeight: 700 }}>{getElementIcon(data.element)}</span>
                </ElementMatchupHover>
            </div>

            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f2f5fa', marginBottom: '4px' }}>
                {data.name} {count && count > 1 ? `x${count}` : ''}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px', color: '#aab4c4' }}>
                <span>{getCategoryIcon(data.category)}</span>
                <span>{data.category.toUpperCase()}</span>
                {/* ×1.5 STAB hint: initial dots for party members whose element matches this card */}
                {stabMatches && stabMatches.length > 0 && (
                    <span
                        title={`×1.5 STAB when played by ${stabMatches.map(m => m.name).join(', ')}`}
                        style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'help' }}
                    >
                        <span style={{ fontSize: '0.6rem', fontWeight: 900, color: getElementAccent(data.element) }}>×1.5</span>
                        {stabMatches.map(m => (
                            <span
                                key={m.name}
                                style={{
                                    width: '13px',
                                    height: '13px',
                                    borderRadius: '50%',
                                    background: getElementBadgeBg(m.element),
                                    color: getElementTextColor(m.element),
                                    border: `1px solid ${getElementAccent(m.element)}`,
                                    fontSize: '0.55rem',
                                    fontWeight: 900,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1
                                }}
                            >
                                {m.name.charAt(0).toUpperCase()}
                            </span>
                        ))}
                    </span>
                )}
            </div>

            <CardKeywordChips data={data} />

            {showBadge && (
                <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-10px',
                    background: '#7c3aed',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    zIndex: 2
                }}>
                    {showBadge}
                </div>
            )}

            {hasHoverActions && isHovered && (
                <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    display: 'flex',
                    gap: '4px',
                    zIndex: 3
                }}>
                    {onRemove && (
                        <button
                            aria-label={`Remove ${data.name}`}
                            style={hoverBtnStyle(removeDisabled, 'var(--hp-red)')}
                            disabled={removeDisabled}
                            onClick={(e) => { e.stopPropagation(); if (!removeDisabled) onRemove(); }}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            −
                        </button>
                    )}
                    {onAdd && (
                        <button
                            aria-label={`Add ${data.name}`}
                            style={hoverBtnStyle(addDisabled, 'var(--hp-green)')}
                            disabled={addDisabled}
                            onClick={(e) => { e.stopPropagation(); if (!addDisabled) onAdd(); }}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            +
                        </button>
                    )}
                </div>
            )}

            {tooltipPos && createPortal(
                <div className="card-hover-preview portal-tooltip" style={{
                    position: 'fixed',
                    top: tooltipPos.top,
                    left: tooltipPos.left,
                    zIndex: 9999,
                    pointerEvents: 'none'
                }}>
                    <div className="preview-content">
                        <strong>{data.name}</strong>
                        <p>{data.description}</p>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProgramCard;
