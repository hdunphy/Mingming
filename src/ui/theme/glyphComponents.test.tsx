/**
 * TICKET 200d - the six components that draw an icon each draw Tabler's own nodes, from their name
 * maps. (200c gave them an optional `layers` prop; 200d flipped the maps and the prop went.)
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BiomeSign } from '../components/topbar/BiomeSign';
import { Icon } from './Icon';
import { ELEMENT_TABLER } from './kit/elementGlyphs';
import { ElementBadge } from './kit/ElementBadge';
import { ElementMark } from './kit/ElementMark';
import { StatusIcon } from './kit/StatusIcon';
import { STATUS_ICON_NAMES } from './kit/statusIconPaths';
import { ICON_TABLER } from './icons';
import { TABLER_FILLED, TABLER_OUTLINE } from './tabler.generated';

const firstD = (nodes: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]>): string => nodes[0][1].d;

describe('a component draws Tabler from its name map (200d)', () => {
    it('Icon draws the mapped outline at the kit weight', () => {
        const html = renderToStaticMarkup(<Icon name="ranch" size={20} />);
        expect(html).toContain(`d="${firstD(TABLER_OUTLINE[ICON_TABLER.ranch])}"`);
        expect(html).toContain('width="20"');
        expect(html).toContain('stroke-width="1.7"');
    });

    it('Icon draws Trace as a hexagon and a scaled lambda', () => {
        const html = renderToStaticMarkup(<Icon name="blueprint" />);
        expect(html).toContain(`d="${firstD(TABLER_OUTLINE.hexagon)}"`);
        expect(html).toContain(`d="${firstD(TABLER_OUTLINE.lambda)}"`);
        expect(html).toContain('transform="translate(5.28 5.28) scale(0.56)"');
        expect(html).toContain('stroke-width="3"');
    });

    it('StatusIcon draws its mapped outline at stroke 2 and keeps its class and data attribute', () => {
        const html = renderToStaticMarkup(<StatusIcon status="Burn" />);
        expect(html).toContain(`d="${firstD(TABLER_OUTLINE[STATUS_ICON_NAMES.Burn])}"`);
        expect(html).toContain('class="k-status-icon"');
        expect(html).toContain('data-status-icon="Burn"');
        expect(html).toContain('width="12"');
        expect(html).toContain('stroke-width="2"');
        expect(html).not.toContain('stroke-width="1.7"');
    });

    it('ElementMark is a filled shape in the element colour with the outline over it in ink', () => {
        for (const [element, key] of [['Fire', 'fire'], ['Water', 'water'], ['Nature', 'nature'], ['None', 'none']] as const) {
            const name = ELEMENT_TABLER[key];
            const html = renderToStaticMarkup(<ElementMark element={element} />);
            const filled = html.indexOf(`d="${firstD(TABLER_FILLED[name])}"`);
            const outline = html.indexOf(`d="${firstD(TABLER_OUTLINE[name])}"`);
            expect(filled, `${element} filled`).toBeGreaterThan(-1);
            expect(outline, `${element} outline`).toBeGreaterThan(filled);
            expect(html).toContain('fill="var(--k-el)"');
            expect(html).toContain('stroke="var(--ink)"');
            expect(html).toContain('class="k-mark-glyph"');
            expect(html).toContain(`aria-label="${element}"`);
        }
    });

    it('ElementBadge and BiomeSign draw the same two layers, filled white', () => {
        const badge = renderToStaticMarkup(<ElementBadge element="Fire" />);
        const sign = renderToStaticMarkup(<BiomeSign name="Ember Hollow" element="Fire" />);
        for (const html of [badge, sign]) {
            expect(html).toContain(`d="${firstD(TABLER_FILLED.flame)}"`);
            expect(html).toContain(`d="${firstD(TABLER_OUTLINE.flame)}"`);
            expect(html).toContain('fill="var(--text)"');
            expect(html).toContain('stroke="var(--ink)"');
            expect(html).toContain('class="k-badge-glyph"');
        }
        expect(sign).toContain('Ember Hollow');
    });
});
