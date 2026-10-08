/**
 * TICKET 200b - the shape of a Tabler icon: a list of SVG elements, each `[tag, attributes]`, exactly
 * as `@tabler/icons` ships them in `tabler-nodes-outline.json`. The generated file is typed with this
 * and `TablerGlyph` (200c) draws it.
 */

/** One SVG element of an icon, e.g. `['path', { d: 'M4 12h6' }]`. */
export type TablerNode = readonly [tag: string, attributes: Readonly<Record<string, string>>];

/** One icon. */
export type TablerNodes = readonly TablerNode[];
