/**
 * TICKET 199 — `InstinctGlyph` draws an Instinct's glyph tinted by the surrounding colour, and the
 * generic firmware icon for an Instinct whose file is not drawn yet.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { instinctGlyphMarkup } from '../labels/instinctGlyphs';
import { InstinctGlyph } from './InstinctGlyph';

describe('199 InstinctGlyph', () => {
    it('draws the glyph of a species Instinct, in currentColor', () => {
        const html = renderToStaticMarkup(<InstinctGlyph instinct="fenrir_v1" />);
        expect(html).toContain('data-instinct-glyph="UNBOUND_KERNEL"');
        expect(html).toContain(instinctGlyphMarkup('fenrir_v1')!);
        expect(html).toContain('currentColor');
        expect(html).toContain('viewBox="0 0 24 24"');
    });

    it('is decorative unless it is given a title', () => {
        expect(renderToStaticMarkup(<InstinctGlyph instinct="kraken_v1" />)).toContain('aria-hidden="true"');
        const titled = renderToStaticMarkup(<InstinctGlyph instinct="kraken_v1" title="Abyssal Ink" />);
        expect(titled).toContain('aria-label="Abyssal Ink"');
        expect(titled).not.toContain('aria-hidden');
    });

    it('falls back to the generic firmware icon while a file is missing', () => {
        const html = renderToStaticMarkup(<InstinctGlyph instinct="ymir_v1" />);
        expect(html).toContain('data-instinct-glyph="generic"');
        expect(html).toContain('<svg');
    });

    it('takes a size and a class', () => {
        const html = renderToStaticMarkup(<InstinctGlyph instinct="skoll_v2" size={20} className="x-glyph" />);
        expect(html).toContain('width="20"');
        expect(html).toContain('height="20"');
        expect(html).toContain('x-glyph');
    });
});
