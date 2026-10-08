/**
 * TICKET 200c - THE SHARED GLYPH RENDERER. Layers in, one `<svg>` out.
 *
 * Tabler icons are lists of SVG elements (`path`, `circle`, `rect`, `line`, `ellipse`), not one path
 * string. This draws them on the 24 grid with the kit's weight: stroke 1.7, `currentColor`, no fill,
 * round caps and joins. A layer may override fill, stroke, weight or transform (an element mark's
 * filled shape, Trace's scaled lambda); the fill is always a token, never a hex.
 *
 * `Icon`, `StatusIcon`, `ElementMark`, `NodeIcon`, `TownButton` and `BiomeSign` compose this when
 * given layers; with none they draw their path strings exactly as before.
 */

import { createElement, type ReactElement, type SVGProps } from 'react';

import { GLYPH_STROKE, type GlyphLayer } from './glyphLayers';
import type { TablerNode } from './tablerNodes';

export interface TablerGlyphProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox' | 'width' | 'height' | 'ref'> {
    readonly layers: readonly GlyphLayer[];
    /** Rendered square, px. */
    readonly size?: number;
    /** An accessible name. Absent, the glyph is decorative and hidden from assistive tech. */
    readonly title?: string;
}

/** `stroke-width` -> `strokeWidth`: React wants camelCase for SVG attributes. */
const camel = (name: string): string => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function drawNode([tag, attributes]: TablerNode, index: number): ReactElement {
    const props: Record<string, string> = {};
    for (const key of Object.keys(attributes)) props[camel(key)] = attributes[key];
    return createElement(tag, { key: index, ...props });
}

export function TablerGlyph({ layers, size = 16, title, ...rest }: TablerGlyphProps): ReactElement {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={GLYPH_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            focusable="false"
            {...rest}
        >
            {title ? <title>{title}</title> : null}
            {layers.map((layer, i) => (
                <g key={i} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} transform={layer.transform}>
                    {layer.nodes.map(drawNode)}
                </g>
            ))}
        </svg>
    );
}
