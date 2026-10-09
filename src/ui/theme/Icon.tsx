/**
 * THE ICON SET - ticket 34, *"No emoji in production UI"*; drawn from Tabler since ticket 200d.
 *
 * # WHY EMOJI HAD TO GO, BEYOND TASTE
 *
 * An emoji is a font glyph the player's system chooses. A building is beige on Windows, blue on
 * macOS and a monochrome outline on some Linux fonts, and some render as nothing at all. So the
 * region map's node legend - the screen whose entire job is *"you can tell what a node is from
 * across the map"* - was drawn by whichever emoji font shipped with the machine. On top of that they
 * cannot take a colour: an emoji ignores `color`, which is why the ruled mockups tint node icons by
 * biome and the emoji ones could not.
 *
 * These are inline SVG on a 24 grid, stroked in `currentColor`. They inherit colour from the rule
 * that placed them, scale to any size, and look the same on every machine.
 *
 * # WHY INLINE AND NOT A SPRITE SHEET OR AN ICON FONT
 *
 * A sprite sheet needs a fetch and a build step, and `assert-no-debug.mjs` already polices what
 * reaches `dist/`. An icon font has emoji's own problem back again: a glyph that fails to load
 * leaves a box. Inlined, an icon is part of the component tree - it cannot 404, cannot flash, and
 * `renderToStaticMarkup` (which is how every UI test in this repo renders) sees the real thing.
 *
 * The set is deliberately small and closed: `IconName` is a union, so a screen asking for an icon
 * that does not exist is a type error rather than an empty box. The shapes are Tabler's own (see
 * `icons.ts`); stroke 1.7 at 24 lands on the pixel grid at the sizes actually used (16 and 20).
 */

import type { CSSProperties, ReactElement } from 'react';

import { iconLayers } from './iconLayers';
import type { IconName } from './icons';
import { TablerGlyph } from './TablerGlyph';

export interface IconProps {
    readonly name: IconName;
    /** Rendered square. 16 in dense chrome, 20 in nav, 28 on the map. */
    readonly size?: number;
    readonly className?: string;
    readonly style?: CSSProperties;
    /**
     * An accessible name. **Omit it for a decorative icon that sits beside its own label** - which
     * is most of them - and the icon is hidden from assistive tech instead of read out twice.
     */
    readonly title?: string;
}

export function Icon({ name, size = 16, className, style, title }: IconProps): ReactElement {
    return <TablerGlyph layers={iconLayers(name)} size={size} className={className} style={style} title={title} />;
}
