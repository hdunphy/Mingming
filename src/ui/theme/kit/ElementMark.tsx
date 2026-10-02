/**
 * THE ELEMENT MARK — ticket 183a. An 18px white disc with the element's symbol drawn in the
 * element's colour. It is ticket 182's "element icon" too (182 R4), so the two tickets ship one
 * component. Its `aria-label` is the element, which is the third way an element is said.
 */
import type { ReactElement } from 'react';

import './kit.css';
import { ELEMENT_GLYPHS, elementKey, elementVars } from './elementGlyphs';

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
            <svg className="k-mark-glyph" width={glyph} height={glyph} viewBox="0 0 24 24" aria-hidden="true">
                <path d={ELEMENT_GLYPHS[elementKey(element)]} />
            </svg>
        </div>
    );
}
