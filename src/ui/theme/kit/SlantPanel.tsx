/**
 * THE SLANT PANEL — ticket 183a. A navy parallelogram with a 2px light edge and, optionally, an
 * element-coloured slash on one face (the face that looks at the monster). Every plaque, tray,
 * toast and tab in direction B is one of these.
 *
 * Built as the light-edge shape with the navy body laid 2px inside it, both with the same skew so
 * the edge is an even 2px all the way round. `cut` is the skew in px: 8 on panels, 5 on badges.
 * The body grows with its content; give the panel a width and let height follow, or set both.
 */
import type { CSSProperties, HTMLAttributes, ReactElement } from 'react';

import './kit.css';
import { elementVars } from './elementGlyphs';

export interface SlantPanelProps extends HTMLAttributes<HTMLDivElement> {
    /** The skew in px. */
    readonly cut?: number;
    /** Which face carries the element slash. Left out, no slash. */
    readonly slash?: 'left' | 'right';
    /** The slash's element. Defaults to Neutral. */
    readonly element?: string;
}

export function SlantPanel({
    cut = 8,
    slash,
    element = 'None',
    className,
    style,
    children,
    ...rest
}: SlantPanelProps): ReactElement {
    const cutVars = { '--k-cut': `${cut}px` } as CSSProperties;
    return (
        <div
            {...rest}
            className={['k-slant', 'k-panel', className].filter(Boolean).join(' ')}
            style={{ ...cutVars, ...elementVars(element), ...style }}
        >
            <div className="k-slant k-panel-body" style={cutVars}>
                {slash && <div className={`k-slash k-slash-${slash}`} data-testid="slant-slash" />}
                {children}
            </div>
        </div>
    );
}
