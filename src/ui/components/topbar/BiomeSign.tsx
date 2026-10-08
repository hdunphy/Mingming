/**
 * THE BIOME SIGN - ticket 183b. The element's symbol and the biome's name, in a slant panel at the
 * bar's right. It is where 145f's faint biome name on the backdrop went: the room is now said once,
 * in words, in the same place every fight. The symbol is the element badge's (ticket 200d).
 */
import React from 'react';

import { badgeLayers } from '../../theme/kit/elementLayers';
import { SlantPanel } from '../../theme/kit/SlantPanel';
import { TablerGlyph } from '../../theme/TablerGlyph';

export interface BiomeSignProps {
    readonly name: string;
    readonly element: string;
}

export function BiomeSign({ name, element }: BiomeSignProps): React.ReactElement {
    return (
        <SlantPanel cut={8} className="battle-topbar-biome" data-testid="battle-biome" title={element}>
            <div className="battle-topbar-biome-body k-display">
                <TablerGlyph layers={badgeLayers(element)} size={14} className="k-badge-glyph" />
                <span>{name}</span>
            </div>
        </SlantPanel>
    );
}
