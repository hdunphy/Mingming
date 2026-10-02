/**
 * THE BIOME SIGN — ticket 183b. The element's symbol and the biome's name, in a slant panel at the
 * bar's right. It is where 145f's faint biome name on the backdrop went: the room is now said once,
 * in words, in the same place every fight.
 */
import React from 'react';

import { ELEMENT_GLYPHS, elementKey } from '../../theme/kit/elementGlyphs';
import { SlantPanel } from '../../theme/kit/SlantPanel';

export interface BiomeSignProps {
    readonly name: string;
    readonly element: string;
}

export function BiomeSign({ name, element }: BiomeSignProps): React.ReactElement {
    return (
        <SlantPanel cut={8} className="battle-topbar-biome" data-testid="battle-biome" title={element}>
            <div className="battle-topbar-biome-body k-display">
                <svg className="k-badge-glyph" width={14} height={14} viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ELEMENT_GLYPHS[elementKey(element)]} />
                </svg>
                <span>{name}</span>
            </div>
        </SlantPanel>
    );
}
