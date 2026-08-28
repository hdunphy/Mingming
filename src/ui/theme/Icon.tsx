/**
 * THE ICON SET — ticket 34, *"No emoji in production UI"*.
 *
 * # WHY EMOJI HAD TO GO, BEYOND TASTE
 *
 * An emoji is a font glyph the player's system chooses. `🏛` is a beige building on Windows, a blue
 * one on macOS and a monochrome outline on some Linux fonts; `🕳` renders as a black ellipse or as
 * nothing at all. So the region map's node legend — the screen whose entire job is *"you can tell
 * what a node is from across the map"* — was drawn by whichever emoji font shipped with the
 * machine. On top of that they cannot take a colour: an emoji ignores `color`, which is why the
 * ruled mockups tint node icons by biome and the emoji ones could not.
 *
 * These are inline SVG on a 24 grid, stroked in `currentColor`. They inherit colour from the rule
 * that placed them, scale to any size, and look the same on every machine — which is the whole of
 * why the swap is worth a ticket.
 *
 * # WHY INLINE AND NOT A SPRITE SHEET OR AN ICON FONT
 *
 * A sprite sheet needs a fetch and a build step, and `assert-no-debug.mjs` already polices what
 * reaches `dist/`. An icon font has emoji's own problem back again: a glyph that fails to load
 * leaves a box. Inlined, an icon is part of the component tree — it cannot 404, cannot flash, and
 * `renderToStaticMarkup` (which is how every UI test in this repo renders) sees the real thing.
 *
 * The set is deliberately small and closed: `IconName` is a union, so a screen asking for an icon
 * that does not exist is a type error rather than an empty box.
 *
 * # DRAWING RULES, IF YOU ADD ONE
 *
 * 24x24 viewBox. Stroke only — no fills, so an icon reads on any surface. 1.7 stroke at 24, which
 * lands on the pixel grid at the two sizes actually used (16 and 20). Round caps and joins.
 * Everything inside a 2px margin so a 16px icon in a 20px slot never touches its neighbour.
 */

import type { CSSProperties, ReactElement } from 'react';

import { PATHS, type IconName } from './icons';

export interface IconProps {
    readonly name: IconName;
    /** Rendered square. 16 in dense chrome, 20 in nav, 28 on the map. */
    readonly size?: number;
    readonly className?: string;
    readonly style?: CSSProperties;
    /**
     * An accessible name. **Omit it for a decorative icon that sits beside its own label** — which
     * is most of them — and the icon is hidden from assistive tech instead of read out twice.
     */
    readonly title?: string;
}

export function Icon({ name, size = 16, className, style, title }: IconProps): ReactElement {
    return (
        <svg
            className={className}
            style={style}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            focusable="false"
        >
            {title ? <title>{title}</title> : null}
            {PATHS[name].map((d) => <path key={d} d={d} />)}
        </svg>
    );
}

