/**
 * TICKET 199 — THE INSTINCT GLYPHS. One map from an Instinct to its picture, beside `instinctNames.ts`.
 *
 * Henry (2026-10-06): "I think we just use them." Twelve glyphs ship for 1.0, one for each Instinct of
 * the first six species (fenrir, skoll, kraken, jormungandr, ratatoskr, huldra). They are AI-drawn art,
 * disclosed on the Steam page; they are the one exception to 190's "no AI-generated art" rule.
 *
 * The files live in `src/ui/assets/instinct-glyphs/`, one SVG per Instinct, **named by the registry id**
 * (`UNBOUND_KERNEL.svg`, the same keys as `NORSE_INSTINCT_NAMES`). Each is drawn on a 24 grid in one
 * colour (`currentColor`), so a chip can tint it by element. They are read at build time and inlined, so
 * a glyph is part of the component tree: it cannot 404 and `renderToStaticMarkup` sees the real thing,
 * the same reasoning as `theme/Icon.tsx`.
 *
 * The other 21 Instincts have no file yet. Dropping `<REGISTRY_ID>.svg` into the folder is all it takes
 * to give one a glyph; until then `InstinctGlyph` draws the generic firmware icon.
 *
 * This is a `.ts` file apart from the component because `react-refresh/only-export-components` is an
 * error in this repo.
 */
import { getOSBehavior } from '../../engine/data/firmwareRegistry';

const FILES = import.meta.glob('../assets/instinct-glyphs/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

/** `<svg ...>` and `</svg>` are the component's to draw (size, tint, label); the shapes are the file's. */
function innerMarkup(svg: string): string {
    const match = /<svg\b[^>]*>([\s\S]*)<\/svg>/i.exec(svg);
    return (match ? match[1] : svg).trim();
}

const MARKUP: ReadonlyMap<string, string> = new Map(
    Object.entries(FILES).map(([path, svg]) => [path.replace(/^.*\/([^/]+)\.svg$/, '$1'), innerMarkup(svg)]),
);

/** The registry ids that have a glyph file. */
export const INSTINCT_GLYPH_IDS: readonly string[] = [...MARKUP.keys()];

/**
 * The glyph key (the registry id, e.g. `UNBOUND_KERNEL`) for an Instinct, or null if none is drawn.
 * Takes either what a body stores as `activeOS` (a species id like `fenrir_v1`) or the registry id itself.
 */
export function instinctGlyphKey(instinct: string | null | undefined): string | null {
    if (!instinct) return null;
    const registryId = getOSBehavior(instinct)?.name ?? instinct;
    return MARKUP.has(registryId) ? registryId : null;
}

/** The inner SVG markup of an Instinct's glyph, or null when it has none yet. */
export function instinctGlyphMarkup(instinct: string | null | undefined): string | null {
    const key = instinctGlyphKey(instinct);
    return key === null ? null : (MARKUP.get(key) ?? null);
}
