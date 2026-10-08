/**
 * THE ELEMENT BADGE - ticket 183a. An element-colour plate with the symbol and, when asked, the
 * word, in white. It sits on plaques; the word is what settles the colour for a player who cannot
 * tell the blues apart, and it is the badge's own word even for an element with no colour of its
 * own (which draws grey).
 */
import type { ReactElement } from 'react';

import { TablerGlyph } from '../TablerGlyph';
import './kit.css';
import { elementVars } from './elementGlyphs';
import { badgeLayers } from './elementLayers';

export interface ElementBadgeProps {
    readonly element: string;
    /** The word to print beside the symbol. Left out, the badge is the symbol alone. */
    readonly label?: string;
}

export function ElementBadge({ element, label }: ElementBadgeProps): ReactElement {
    return (
        <div
            className="k-slant k-badge k-display"
            role="img"
            aria-label={element}
            title={element}
            style={elementVars(element)}
        >
            <TablerGlyph layers={badgeLayers(element)} size={12} className="k-badge-glyph" />
            {label !== undefined && <span className="k-badge-word">{label}</span>}
        </div>
    );
}
