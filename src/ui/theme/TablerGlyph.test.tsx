/**
 * TICKET 200c - the shared glyph renderer. Layers in, one `<svg>` out, at today's stroke weight.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { outlineLayers, type GlyphLayer } from './glyphLayers';
import { TABLER_FILLED, TABLER_OUTLINE } from './tabler.generated';
import { TablerGlyph } from './TablerGlyph';
import type { TablerNodes } from './tablerNodes';

const render = (layers: readonly GlyphLayer[], props: Partial<Parameters<typeof TablerGlyph>[0]> = {}): string =>
    renderToStaticMarkup(<TablerGlyph layers={layers} {...props} />);

describe('TablerGlyph (200c)', () => {
    it('draws every element type a Tabler node list can hold', () => {
        const nodes: TablerNodes = [
            ['path', { d: 'M4 12h6' }],
            ['circle', { cx: '12', cy: '8', r: '3' }],
            ['rect', { x: '4', y: '4', width: '6', height: '6', rx: '1' }],
            ['line', { x1: '2', y1: '3', x2: '9', y2: '3' }],
            ['ellipse', { cx: '12', cy: '12', rx: '5', ry: '2' }],
        ];
        const html = render([{ nodes }]);
        expect(html).toContain('<path d="M4 12h6"');
        expect(html).toContain('<circle cx="12" cy="8" r="3"');
        expect(html).toContain('<rect x="4" y="4" width="6" height="6" rx="1"');
        expect(html).toContain('<line x1="2" y1="3" x2="9" y2="3"');
        expect(html).toContain('<ellipse cx="12" cy="12" rx="5" ry="2"');
    });

    it('keeps today\'s weight: stroke 1.7, currentColor, no fill, round caps and joins, a 24 grid', () => {
        const html = render(outlineLayers('flame'));
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('stroke-width="1.7"');
        expect(html).toContain('stroke="currentColor"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('stroke-linecap="round"');
        expect(html).toContain('stroke-linejoin="round"');
    });

    it('draws the nodes exactly as Tabler ships them', () => {
        for (const name of ['flame', 'hexagons', 'zzz'] as const) {
            const html = render(outlineLayers(name));
            for (const [, attrs] of TABLER_OUTLINE[name]) expect(html, name).toContain(`d="${attrs.d}"`);
        }
    });

    it('takes a size, a class, and a title that turns it from decorative to named', () => {
        const plain = render(outlineLayers('sun'), { size: 20, className: 'x' });
        expect(plain).toContain('width="20"');
        expect(plain).toContain('height="20"');
        expect(plain).toContain('class="x"');
        expect(plain).toContain('aria-hidden="true"');
        const named = render(outlineLayers('sun'), { title: 'Sun' });
        expect(named).toContain('role="img"');
        expect(named).toContain('<title>Sun</title>');
        expect(named).not.toContain('aria-hidden');
    });

    it('lets a filled layer take its fill from a token, never a hex', () => {
        const html = render([{ nodes: TABLER_FILLED.flame, fill: 'var(--k-el)', stroke: 'none' }]);
        expect(html).toContain('fill="var(--k-el)"');
        expect(html).toContain('stroke="none"');
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    });

    it('draws a layered glyph: both layers, the inner one with its own stroke and transform', () => {
        const html = render([
            { nodes: TABLER_OUTLINE.hexagon },
            { nodes: TABLER_OUTLINE.lambda, strokeWidth: 3, transform: 'translate(5.28 5.28) scale(0.56)' },
        ]);
        expect(html).toContain(`d="${TABLER_OUTLINE.hexagon[0][1].d}"`);
        expect(html).toContain(`d="${TABLER_OUTLINE.lambda[0][1].d}"`);
        expect(html).toContain('stroke-width="3"');
        expect(html).toContain('transform="translate(5.28 5.28) scale(0.56)"');
        expect(html.match(/<g/g)).toHaveLength(2);
    });

    it('passes data attributes through for the caller\'s tests and CSS', () => {
        expect(render(outlineLayers('sun'), { 'data-x': 'y' } as object)).toContain('data-x="y"');
    });
});
