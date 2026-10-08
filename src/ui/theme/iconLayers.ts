/**
 * TICKET 200d - what an `IconName` draws: the layers for it. Every name is one Tabler outline icon
 * (`ICON_TABLER`) except Trace, which is the two-layer glyph in `traceGlyph.ts`.
 */

import { outlineLayers, type GlyphLayer } from './glyphLayers';
import { ICON_TABLER, type IconName } from './icons';
import { TRACE_LAYERS } from './traceGlyph';

export function iconLayers(name: IconName): readonly GlyphLayer[] {
    return name === 'blueprint' ? TRACE_LAYERS : outlineLayers(ICON_TABLER[name]);
}
