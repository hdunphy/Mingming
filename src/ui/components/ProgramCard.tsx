import React from 'react';
import { createPortal } from 'react-dom';
import type { ProgramData } from '../../engine/types';

interface Props {
    data: ProgramData;
    count?: number;
    isSelected?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    showBadge?: string;
    className?: string;
}

export const getElementIcon = (el: string) => {
    const map: Record<string, string> = {
        Fire: '🔥', Water: '💧', Nature: '🌿', Earth: '⛰️',
        Air: '💨', Ice: '❄️', Light: '✨', Dark: '🌑', None: '⚪'
    };
    return map[el] ?? '❓';
};

export const getCategoryIcon = (cat: string) => {
    const map: Record<string, string> = {
        Attack: '⚔️', Heal: '💚', Status: '🧪', Special: '🌟'
    };
    return map[cat] ?? '❓';
};

export const getElementColor = (el: string) => {
    const map: Record<string, string> = {
        Fire: 'var(--fire)', Water: 'var(--water)', Nature: 'var(--nature)',
        Earth: 'var(--earth)', Air: 'var(--air)', Ice: 'var(--ice)',
        Light: 'var(--light)', Dark: 'var(--dark)'
    };
    return map[el] ?? '#888';
};

const ProgramCard: React.FC<Props> = ({ data, count, isSelected, onClick, onContextMenu, showBadge, className = '' }) => {
    const [tooltipPos, setTooltipPos] = React.useState<{ top: number; left: number } | null>(null);

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
                    background: getElementColor(data.element),
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                }}>
                    {data.baseCost}⚡
                </span>
                <span style={{ fontSize: '1.2rem' }}>{getElementIcon(data.element)}</span>
            </div>

            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>
                {data.name} {count && count > 1 ? `x${count}` : ''}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: '#888' }}>
                <span>{getCategoryIcon(data.category)}</span>
                <span>{data.category.toUpperCase()}</span>
            </div>

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
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    zIndex: 2
                }}>
                    {showBadge}
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
