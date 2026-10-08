/**
 * TICKET 200c - the data half of `TablerGlyph`, and the glue the icon components share.
 *
 * A glyph is a list of LAYERS. Most are one layer (a Tabler outline icon). An element mark is two (a
 * filled shape in the element colour with the matching outline over it) and Trace is two (a hexagon
 * with a lambda scaled into it). Each layer carries its own nodes, and optionally its own fill,
 * stroke, stroke width and transform, so every case is the same code.
 *
 * Colours are tokens (`var(--k-el)`, `currentColor`, `none`), never a hex: `noHex.test.ts` holds the
 * line. A separate `.ts` file from the component because `react-refresh/only-export-components` is
 * an error in this repo.
 */

import { TABLER_OUTLINE, type TablerOutlineName } from './tabler.generated';
import type { TablerNodes } from './tablerNodes';

/** Today's stroke weight at 24: lands on the pixel grid at the sizes actually used (16 and 20). */
export const GLYPH_STROKE = 1.7;

export interface GlyphLayer {
    readonly nodes: TablerNodes;
    /** A token or `none`. Absent: inherit, which is `none` for an outline glyph. */
    readonly fill?: string;
    /** Absent: `currentColor`. */
    readonly stroke?: string;
    /** Absent: the glyph's own weight. */
    readonly strokeWidth?: number;
    /** An SVG transform, e.g. `translate(5.28 5.28) scale(0.56)`. */
    readonly transform?: string;
}

/** What NodeIcon and TownButton still take until the map swap (next commit). */
export interface WithGlyphLayers {
    readonly layers?: readonly GlyphLayer[];
}

/** One Tabler outline icon as a layer list. */
export function outlineLayers(name: TablerOutlineName): readonly GlyphLayer[] {
    return [{ nodes: TABLER_OUTLINE[name] }];
}
