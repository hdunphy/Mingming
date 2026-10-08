import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TABLER_FILLED, TABLER_OUTLINE } from '../tabler.generated';
import { ElementMark } from './ElementMark';
import { ELEMENT_TABLER } from './elementGlyphs';

describe('ElementMark (183a, 200d)', () => {
    it('draws the element\'s symbol in its colour and names it', () => {
        const html = renderToStaticMarkup(<ElementMark element="Fire" />);
        expect(html).toContain('aria-label="Fire"');
        expect(html).toContain('--k-el:var(--el-fire)');
        expect(ELEMENT_TABLER.fire).toBe('flame');
        expect(html).toContain(`d="${TABLER_FILLED.flame[0][1].d}"`);
        expect(html).toContain(`d="${TABLER_OUTLINE.flame[0][1].d}"`);
        expect(html).toContain('width:18px');
    });

    it('draws an element with no colour as the neutral dot, keeping its own name', () => {
        const html = renderToStaticMarkup(<ElementMark element="Dark" size={24} />);
        expect(html).toContain('aria-label="Dark"');
        expect(html).toContain('var(--el-none)');
        expect(ELEMENT_TABLER.none).toBe('point');
        expect(html).toContain(`d="${TABLER_FILLED.point[0][1].d}"`);
    });
});
