/**
 * TICKET 200d - TRACE, the layered icon. Tabler has no hexagon lambda, so it is two Tabler icons: a
 * `hexagon` outline at full size and a `lambda` centred inside it, scaled to 0.56 on the 24 grid with
 * its stroke raised to 3 so it lands near the outer weight after scaling. Henry's ruling (2026-10-06);
 * the renderer is the one the element marks use. Nothing here is hand-drawn.
 */

import type { GlyphLayer } from './glyphLayers';
import { TABLER_OUTLINE, type TablerOutlineName } from './tabler.generated';

/** The two Tabler names Trace is made of, outer first. */
export const TRACE_NAMES: readonly TablerOutlineName[] = ['hexagon', 'lambda'];

export const TRACE_LAYERS: readonly GlyphLayer[] = [
    { nodes: TABLER_OUTLINE.hexagon },
    { nodes: TABLER_OUTLINE.lambda, strokeWidth: 3, transform: 'translate(5.28 5.28) scale(0.56)' },
];
