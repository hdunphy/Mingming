/**
 * THE ELEMENT MARK GLYPHS — ticket 183a. The data half of `ElementMark` and `ElementBadge`.
 *
 * Every element is said three ways, colour, symbol and word, so no information rides on colour
 * alone (colour-blind players, Henry 2026-10-01). This is the symbol: a flame, a drop, a leaf and
 * a dot for neutral, on a 24 grid, filled in the element's colour with an ink outline.
 *
 * Only four elements have a colour (`tokens.css`). An element the engine can still produce but no
 * shipped species uses (Earth, Air, Ice, Light, Dark) draws as Neutral; the badge keeps its own
 * word, so it still says what it is.
 *
 * A separate `.ts` file from the components because `react-refresh/only-export-components` is an
 * error in this repo, and `tokens.test.ts` sweeps these keys against `tokens.css` without rendering.
 */

import type { CSSProperties } from 'react';

export type ElementKey = 'fire' | 'water' | 'nature' | 'none';

/** Path data per element key, on a 24x24 viewBox. */
export const ELEMENT_GLYPHS: Readonly<Record<ElementKey, string>> = {
    fire: 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-4 2-6 2-10z',
    water: 'M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z',
    nature: 'M20 4c-9 0-15 5-15 13 0 1 0 2 1 3 2-7 7-11 11-12-4 3-8 7-9 13 8 1 13-5 12-17z',
    none: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
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
