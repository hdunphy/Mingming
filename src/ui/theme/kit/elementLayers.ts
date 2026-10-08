/**
 * TICKET 200d - an element's glyph as two layers: the FILLED Tabler icon, then the matching OUTLINE
 * icon over it in ink. That keeps the old "filled, with an ink outline" look using only Tabler's own
 * nodes. Colours are tokens: `--k-el` (set by `elementVars`), `--text`, `--ink`.
 *
 * One weight per surface, not per icon: the mark's outline is 1.2 and the badge's is 1.5, which are
 * the weights those surfaces drew before the swap.
 */

import type { GlyphLayer } from '../glyphLayers';
import { TABLER_FILLED, TABLER_OUTLINE } from '../tabler.generated';
import { ELEMENT_TABLER, elementKey } from './elementGlyphs';

export const MARK_STROKE = 1.2;
export const BADGE_STROKE = 1.5;

function elementLayers(element: string, fill: string, strokeWidth: number): readonly GlyphLayer[] {
    const name = ELEMENT_TABLER[elementKey(element)];
    return [
        { nodes: TABLER_FILLED[name], fill, stroke: 'none' },
        { nodes: TABLER_OUTLINE[name], fill: 'none', stroke: 'var(--ink)', strokeWidth },
    ];
}

/** The mark on the white disc: filled in the element's colour. */
export const markLayers = (element: string): readonly GlyphLayer[] => elementLayers(element, 'var(--k-el)', MARK_STROKE);

/** The badge (and the biome sign) sit on the element's colour: filled white. */
export const badgeLayers = (element: string): readonly GlyphLayer[] => elementLayers(element, 'var(--text)', BADGE_STROKE);
