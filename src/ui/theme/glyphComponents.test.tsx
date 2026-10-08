/**
 * TICKET 200c - the six components that draw an icon each learn to draw a Tabler layer list too.
 * Nothing passes one yet (200d flips the maps), so every existing screen draws as before; these
 * tests give each component a layer list and look for Tabler's own path data in what comes out.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BiomeSign } from '../components/topbar/BiomeSign';
import { NodeIcon } from '../components/map/NodeIcon';
import { TownButton } from '../components/map/TownButton';
import { Icon } from './Icon';
import { ELEMENT_GLYPHS } from './kit/elementGlyphs';
import { ElementMark } from './kit/ElementMark';
import { StatusIcon } from './kit/StatusIcon';
import { STATUS_ICON_PATHS } from './kit/statusIconPaths';
import { outlineLayers } from './glyphLayers';
import { PATHS } from './icons';
import { TABLER_OUTLINE } from './tabler.generated';
import { TOWN_BUILDINGS } from '../components/map/townBuildings';
import { NODE_GLYPHS } from '../components/map/nodeGlyphs';

const layers = outlineLayers('flame');
const tabler = (TABLER_OUTLINE.flame[0][1] as { d: string }).d;

describe('a component given Tabler layers (200c)', () => {
    it('Icon draws them in place of its path strings, at the same weight', () => {
        const html = renderToStaticMarkup(<Icon name="ranch" size={20} layers={layers} />);
        expect(html).toContain(`d="${tabler}"`);
        expect(html).not.toContain(PATHS.ranch[0]);
        expect(html).toContain('width="20"');
        expect(html).toContain('stroke-width="1.7"');
    });

    it('StatusIcon draws them, keeping its class and data attribute', () => {
        const html = renderToStaticMarkup(<StatusIcon status="Burn" layers={layers} />);
        expect(html).toContain(`d="${tabler}"`);
        expect(html).not.toContain(STATUS_ICON_PATHS.Burn);
        expect(html).toContain('class="k-status-icon"');
        expect(html).toContain('data-status-icon="Burn"');
        expect(html).toContain('width="12"');
    });

    it('ElementMark draws them inside its disc', () => {
        const html = renderToStaticMarkup(<ElementMark element="Fire" layers={layers} />);
        expect(html).toContain(`d="${tabler}"`);
        expect(html).not.toContain(ELEMENT_GLYPHS.fire);
        expect(html).toContain('class="k-mark-glyph"');
        expect(html).toContain('aria-label="Fire"');
    });

    it('NodeIcon draws them as its glyph, on a disc and on a town plate', () => {
        for (const kind of ['fight', 'town'] as const) {
            const html = renderToStaticMarkup(<NodeIcon kind={kind} layers={layers} />);
            expect(html, kind).toContain(`d="${tabler}"`);
            expect(html, kind).not.toContain(NODE_GLYPHS[kind]);
            expect(html, kind).toContain('class="k-node-glyph"');
        }
    });

    it('TownButton draws them in the icon block and the ghost corner', () => {
        const html = renderToStaticMarkup(<TownButton building="shop" status="open" layers={layers} />);
        expect(html.split(`d="${tabler}"`)).toHaveLength(3);
        expect(html).not.toContain(TOWN_BUILDINGS.shop.glyph);
        expect(html).toContain('class="k-town-ghost"');
    });

    it('BiomeSign draws them beside the biome name', () => {
        const html = renderToStaticMarkup(<BiomeSign name="Ember Hollow" element="Fire" layers={layers} />);
        expect(html).toContain(`d="${tabler}"`);
        expect(html).not.toContain(ELEMENT_GLYPHS.fire);
        expect(html).toContain('class="k-badge-glyph"');
        expect(html).toContain('Ember Hollow');
    });

    it('with no layers, every one still draws its own path string', () => {
        expect(renderToStaticMarkup(<Icon name="ranch" />)).toContain(PATHS.ranch[0]);
        expect(renderToStaticMarkup(<StatusIcon status="Burn" />)).toContain(STATUS_ICON_PATHS.Burn);
        expect(renderToStaticMarkup(<ElementMark element="Fire" />)).toContain(ELEMENT_GLYPHS.fire);
        expect(renderToStaticMarkup(<NodeIcon kind="fight" />)).toContain(NODE_GLYPHS.fight);
        expect(renderToStaticMarkup(<TownButton building="shop" status="open" />)).toContain(TOWN_BUILDINGS.shop.glyph);
        expect(renderToStaticMarkup(<BiomeSign name="x" element="Fire" />)).toContain(ELEMENT_GLYPHS.fire);
    });
});
