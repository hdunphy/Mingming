/**
 * THE ELEMENT MARK GLYPHS - ticket 183a, swapped to Tabler by ticket 200d. The data half of
 * `ElementMark`, `ElementBadge` and `BiomeSign`.
 *
 * Every element is said three ways, colour, symbol and word, so no information rides on colour
 * alone (colour-blind players, Henry 2026-10-01). This is the symbol: a flame, a drop, a leaf and
 * a dot for neutral. Each is a Tabler icon that exists both filled and outline; `elementLayers.ts`
 * draws the filled one in the element's colour with the outline over it in ink.
 *
 * Only four elements have a colour (`tokens.css`). An element the engine can still produce but no
 * shipped species uses (Earth, Air, Ice, Light, Dark) draws as Neutral; the badge keeps its own
 * word, so it still says what it is.
 *
 * A separate `.ts` file from the components because `react-refresh/only-export-components` is an
 * error in this repo, and `tokens.test.ts` sweeps these keys against `tokens.css` without rendering.
 */

import type { CSSProperties } from 'react';

import type { TablerFilledName, TablerOutlineName } from '../tabler.generated';

export type ElementKey = 'fire' | 'water' | 'nature' | 'none';

/** The Tabler icon per element key: one that Tabler ships in both the filled and the outline set. */
export const ELEMENT_TABLER: Readonly<Record<ElementKey, TablerFilledName & TablerOutlineName>> = {
    fire: 'flame',
    water: 'droplet',
    nature: 'leaf',
    none: 'point',
};

/** The key an engine element name draws as. Anything without its own colour is Neutral. */
export function elementKey(element: string): ElementKey {
    const lower = element.toLowerCase();
    return lower === 'fire' || lower === 'water' || lower === 'nature' ? lower : 'none';
}

/** The one custom property every kit piece reads its element colour from. */
export function elementVars(element: string): CSSProperties {
    return { '--k-el': `var(--el-${elementKey(element)})` } as CSSProperties;
}
