/**
 * TICKET 169f — one run-modifier toggle chip on the party screen.
 *
 * A pressable chip showing the modifier's name. Hovering (or focusing) it draws the description in a
 * portal into <body>, the house tooltip pattern (`ElementMatchupHover`, `StatusBadge`), so the text
 * never moves the layout around it.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredRect } from '../hooks/useAnchoredRect';

export interface ModifierChipProps {
    readonly name: string;
    readonly description: string;
    readonly on: boolean;
    readonly disabled: boolean;
    readonly onToggle: () => void;
}

export default function ModifierChip({ name, description, on, disabled, onToggle }: ModifierChipProps): ReactNode {
    const [hovered, setHovered] = useState(false);
    const { ref, rect } = useAnchoredRect<HTMLButtonElement>(hovered);

    return (
        <button
            ref={ref}
            type="button"
            className={`ranch-modifier-chip k-button is-quiet ${on ? 'on is-on' : ''}`}
            aria-pressed={on}
            disabled={disabled}
            onClick={onToggle}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
        >
            {name}
            {hovered && rect !== null && createPortal(
                <div
                    className="os-tooltip-portal"
                    role="tooltip"
                    style={{
                        position: 'fixed',
                        left: Math.max(8, Math.min(rect.left, window.innerWidth - 248)),
                        top: rect.bottom + 8,
                        width: '230px',
                        zIndex: 10001,
                    }}
                >
                    <div className="os-tooltip-header">{name.toUpperCase()} · MODIFIER</div>
                    <div className="os-tooltip-desc">{description}</div>
                </div>,
                document.body,
            )}
        </button>
    );
}
