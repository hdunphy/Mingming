import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ElementMark } from './ElementMark';
import { ELEMENT_GLYPHS } from './elementGlyphs';

describe('ElementMark (183a)', () => {
    it('draws the element\'s symbol in its colour and names it', () => {
        const html = renderToStaticMarkup(<ElementMark element="Fire" />);
        expect(html).toContain('aria-label="Fire"');
        expect(html).toContain('--k-el:var(--el-fire)');
        expect(html).toContain(ELEMENT_GLYPHS.fire);
        expect(html).toContain('width:18px');
    });

    it('draws an element with no colour as the neutral dot, keeping its own name', () => {
        const html = renderToStaticMarkup(<ElementMark element="Dark" size={24} />);
        expect(html).toContain('aria-label="Dark"');
        expect(html).toContain('var(--el-none)');
        expect(html).toContain(ELEMENT_GLYPHS.none);
    });
});
