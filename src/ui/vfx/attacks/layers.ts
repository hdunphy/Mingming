/**
 * TICKET 194k-3 — THE THREE LAYERS every light effect is drawn in, so it reads on a light stage.
 *
 * The lab drew light additively over a dark navy stage. The game's stages are sand and pale
 * grey-blue, and additive light over a light background washes out (see `glow.ts`). So instead
 * of borrowing the dark stage's contrast, each effect brings its own, bottom to top:
 *
 *   1. a DARK RIM: the element colour at about 30% brightness, ordinary blending, so it is dark
 *      on any stage;
 *   2. an OPAQUE-ENOUGH BODY in the element colour (the old outer strokes were 20% opaque, which
 *      is invisible when the stage is already that colour);
 *   3. the HOT CORE, near white.
 *
 * Only the rim is pinned to `source-over`. The body and the core still go through `LIGHT_BLEND`,
 * so changing that one constant still changes how the light layers blend.
 */

export type Rgb = readonly [number, number, number];
export type Stop = readonly [offset: number, colour: string];

/** The rim is the element colour at this fraction of its brightness. */
export const RIM_BRIGHTNESS = 0.3;
/** No body layer is drawn fainter than this: below it the colour disappears into a same-hued stage. */
export const MIN_BODY_ALPHA = 0.5;

export const rgbaOf = (rgb: Rgb, alpha: number): string =>
    `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${alpha})`;

/** The dark rim colour for an element colour. */
export const rimOf = (rgb: Rgb, alpha = 1): string =>
    rgbaOf([rgb[0] * RIM_BRIGHTNESS, rgb[1] * RIM_BRIGHTNESS, rgb[2] * RIM_BRIGHTNESS], alpha);

/** The glow sprite's radial stops: a white centre, the body, then a dark rim that fades out. */
export function glowStops(rgb: Rgb): Stop[] {
    return [
        [0, 'rgba(255,255,255,1)'],
        [0.22, rgbaOf(rgb, 1)],
        [0.5, rgbaOf(rgb, 0.5)],
        [0.72, rimOf(rgb, 0.4)],
        [1, rimOf(rgb, 0)],
    ];
}

/** The particle field's ramp-sprite stops for one step of the colour ramp: white centre, body, dark rim. */
export function rampStops(rgb: Rgb): Stop[] {
    return [
        [0, 'rgba(255,255,255,1)'],
        [0.16, rgbaOf(rgb, 1)],
        [0.34, rgbaOf(rgb, 0.92)],
        [0.62, rgbaOf(rgb, 0.4)],
        [0.8, rimOf(rgb, 0.3)],
        [1, rimOf(rgb, 0)],
    ];
}
