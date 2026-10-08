/**
 * THE ELEMENT MARK - ticket 183a. An 18px white disc with the element's symbol drawn in the
 * element's colour (a filled Tabler icon with its outline over it in ink, ticket 200d). It is
 * ticket 182's "element icon" too (182 R4), so the two tickets ship one component. Its
 * `aria-label` is the element, which is the third way an element is said.
 */
import type { ReactElement } from 'react';

import { TablerGlyph } from '../TablerGlyph';
import './kit.css';
import { elementVars } from './elementGlyphs';
import { markLayers } from './elementLayers';

export interface ElementMarkProps {
    readonly element: string;
    readonly size?: number;
}

export function ElementMark({ element, size = 18 }: ElementMarkProps): ReactElement {
    const glyph = Math.round(size * 0.67);
    return (
        <div
            className="k-mark"
            role="img"
            aria-label={element}
            title={element}
            style={{ ...elementVars(element), width: size, height: size }}
        >
            <TablerGlyph layers={markLayers(element)} size={glyph} className="k-mark-glyph" />
        </div>
    );
}
