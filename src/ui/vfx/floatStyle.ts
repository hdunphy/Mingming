/**
 * TICKET 194k-4 — HOW A FLOATING NUMBER LOOKS: its size, its outline and its stacking step.
 *
 * Henry, 2026-10-04: *"Damage numbers seem thin."* `TierProfile.damageNumberPx` (30-60 px on
 * Showy) was defined and tested and nothing read it; the float was a fixed 1.6rem with a 2 px
 * shadow. The lab draws the number in italic 800 Barlow Condensed at 30 + 30 s px with a dark
 * outline about 18% of the size, and its labels at 20 px with the same outline.
 *
 * The outline is `-webkit-text-stroke` with `paint-order: stroke fill` (in `index.css`), so the
 * stroke sits under the fill: the same as the lab's `strokeText` then `fillText`.
 */
import type { CSSProperties } from 'react';

import type { FloatKind } from '../hooks/useBattleVfx';

/** The size of a label (a status, SUPER EFFECTIVE, an absorbed number, a Driver's name). */
export const LABEL_PX = 20;
/** The outline is this fraction of the font size... */
export const OUTLINE_FRACTION = 0.18;
/** ...and never thinner than this. */
export const OUTLINE_MIN_PX = 4;
/** A stacked float starts this much of its own height below the one before it, at least `MIN_STEP_PX`. */
const STEP_FRACTION = 0.7;
export const MIN_STEP_PX = 22;

const NUMBER_KINDS: ReadonlySet<FloatKind> = new Set(['damage', 'crit']);
const LABEL_KINDS: ReadonlySet<FloatKind> = new Set(['status', 'tag', 'absorbed', 'proc']);

/** The font size in px, or `undefined` to leave it to the class (a heal, or a number with no profile size). */
export function floatFontPx(kind: FloatKind, px?: number): number | undefined {
    if (NUMBER_KINDS.has(kind)) return px;
    if (LABEL_KINDS.has(kind)) return LABEL_PX;
    return undefined;
}

export const outlinePx = (fontPx: number): number => Math.max(OUTLINE_MIN_PX, Math.round(fontPx * OUTLINE_FRACTION));

/** How far apart this float's stack slots are, so a 60 px number does not sit on the one under it. */
export const slotStepPx = (fontPx: number | undefined): number =>
    Math.max(MIN_STEP_PX, Math.round((fontPx ?? 0) * STEP_FRACTION));

/** The inline style a float adds on top of its class: font size and outline width. */
export function floatSizing(kind: FloatKind, px?: number): CSSProperties {
    const fontPx = floatFontPx(kind, px);
    if (fontPx === undefined) return {};
    return { fontSize: `${fontPx}px`, WebkitTextStrokeWidth: `${outlinePx(fontPx)}px` };
}
