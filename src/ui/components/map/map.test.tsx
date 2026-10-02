// @vitest-environment jsdom
/**
 * TICKET 183g — the map's pieces: node icons, route lines, the biome panel and the town buttons.
 * Each is a pure function of its props (176 composes them), so these tests render one at a time.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { NODE_KINDS } from '../../../engine/runTypes';
import { BiomePanel } from './BiomePanel';
import { NodeIcon } from './NodeIcon';
import { RouteLine } from './RouteLine';
import { ROUTE_WIDTH } from './routeStyle';
import { TownButton } from './TownButton';
import { NODE_GLYPHS, NODE_SIZE, NODE_WORD, iconKindFor, type NodeIconKind } from './nodeGlyphs';
import { TOWN_BUILDINGS, type TownBuilding } from './townBuildings';
import { mount, click, makeStore } from '../../../testing/interaction';

const KINDS = Object.keys(NODE_GLYPHS) as NodeIconKind[];

describe('183g NodeIcon', () => {
    it('has a symbol and a word for each of the eight kinds the map draws', () => {
        expect(KINDS.sort()).toEqual(['detour', 'elite', 'event', 'fight', 'gym', 'rival', 'start', 'town'].sort());
        for (const kind of KINDS) {
            expect(NODE_GLYPHS[kind].length).toBeGreaterThan(5);
            expect(NODE_WORD[kind].length).toBeGreaterThan(0);
        }
    });

    it('is 60px on a route, 76px on an elite gate and the gym', () => {
        for (const kind of KINDS.filter((k) => k !== 'town')) {
            const expected = kind === 'elite' || kind === 'gym' ? 76 : 60;
            expect(NODE_SIZE[kind]).toBe(expected);
            expect(renderToStaticMarkup(<NodeIcon kind={kind} />)).toContain(`width:${expected}px;height:${expected}px`);
        }
    });

    it('rings the disc in the fight\'s element when it is known, and fills an elite with it', () => {
        const fight = renderToStaticMarkup(<NodeIcon kind="fight" element="Water" />);
        expect(fight).toContain('--k-el:var(--el-water)');
        expect(fight).not.toContain('data-filled');
        const elite = renderToStaticMarkup(<NodeIcon kind="elite" element="Fire" />);
        expect(elite).toContain('--k-el:var(--el-fire)');
        expect(elite).toContain('data-filled="true"');
        // No element known: a neutral light ring, nothing filled.
        const unknown = renderToStaticMarkup(<NodeIcon kind="elite" />);
        expect(unknown).not.toContain('--k-el');
        expect(unknown).not.toContain('data-filled');
    });

    it('marks the selected and the faded node', () => {
        const markup = renderToStaticMarkup(<NodeIcon kind="event" selected faded />);
        expect(markup).toContain('data-selected="true"');
        expect(markup).toContain('data-faded="true"');
        expect(renderToStaticMarkup(<NodeIcon kind="event" />)).not.toMatch(/data-(selected|faded)/);
    });

    it('draws the town as a plate with the house, the word and a second line', () => {
        const markup = renderToStaticMarkup(<NodeIcon kind="town" sub="Shop · Den" />);
        expect(markup).toContain('k-town-node');
        expect(markup).not.toContain('k-node-disc');
        expect(markup).toContain('Town');
        expect(markup).toContain('Shop · Den');
    });

    it('maps every engine node kind to a picture', () => {
        for (const kind of NODE_KINDS) expect(KINDS).toContain(iconKindFor(kind));
        expect(iconKindFor('wild', true)).toBe('start');
        expect(iconKindFor('marketplace')).toBe('town');
        expect(iconKindFor('workshop')).toBe('town');
        expect(iconKindFor('alpha')).toBe('detour');
        expect(iconKindFor('ambush')).toBe('fight');
    });
});

describe('183g RouteLine', () => {
    const from = { x: 10, y: 20 };
    const to = { x: 110, y: 70 };
    const draw = (state: 'taken' | 'ahead' | 'passed' | 'detour', element?: string) =>
        renderToStaticMarkup(<svg><RouteLine from={from} to={to} state={state} element={element} /></svg>);

    it('runs from one node to the other, round-capped', () => {
        const markup = draw('ahead');
        expect(markup).toContain('x1="10"');
        expect(markup).toContain('y2="70"');
        expect(markup).toContain('stroke-linecap="round"');
    });

    it('is 8px for the gold path, 6px for a road ahead or passed, 5px dashed for a detour', () => {
        expect(ROUTE_WIDTH).toEqual({ taken: 8, ahead: 6, passed: 6, detour: 5 });
        expect(draw('taken')).toContain('stroke-width="8"');
        expect(draw('ahead')).toContain('stroke-width="6"');
        expect(draw('detour')).toContain('stroke-width="5"');
        expect(draw('detour')).toContain('stroke-dasharray="10 8"');
        for (const state of ['taken', 'ahead', 'passed'] as const) expect(draw(state)).not.toContain('stroke-dasharray');
    });

    it('carries the element for the stylesheet to colour, and none when unknown', () => {
        expect(draw('ahead', 'Water')).toContain('data-element="water"');
        expect(draw('ahead', 'Earth')).toContain('data-element="none"');
        expect(draw('ahead')).not.toContain('data-element');
    });
});

describe('183g BiomePanel', () => {
    it('is the stage backdrop in a slanted panel, stamped with the biome', () => {
        const markup = renderToStaticMarkup(<BiomePanel element="Water" label="Biome 1 · Brinehollow" width={996} height={540} />);
        expect(markup).toContain('data-biome="water"');
        expect(markup).toContain('data-testid="biome-backdrop"');
        expect(markup).toContain('Biome 1 · Brinehollow');
        expect(markup).toContain('width:996px;height:540px');
    });
});

describe('183g TownButton', () => {
    const BUILDINGS = Object.keys(TOWN_BUILDINGS) as TownBuilding[];

    it('is one button for each of the four buildings, in its own colour', () => {
        expect(BUILDINGS).toEqual(['shop', 'upgrades', 'den', 'loadout']);
        const colours = BUILDINGS.map((building) => {
            const markup = renderToStaticMarkup(<TownButton building={building} status="a line" />);
            expect(markup).toContain(TOWN_BUILDINGS[building].label);
            expect(markup).toContain('a line');
            return markup.match(/--k-bld:([^;"]+)/)![1];
        });
        expect(colours).toEqual(['var(--el-water)', 'var(--el-nature)', 'var(--el-fire)', 'var(--el-none)']);
    });

    it('wears the READY tag only when it is ready', () => {
        expect(renderToStaticMarkup(<TownButton building="den" status="x" ready />)).toContain('k-town-ready');
        expect(renderToStaticMarkup(<TownButton building="den" status="x" />)).not.toContain('k-town-ready');
    });

    it('answers a click', async () => {
        const onClick = vi.fn();
        const host = await mount(makeStore(), <TownButton building="shop" status="x" onClick={onClick} />);
        await click(host.querySelector('button')!);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
