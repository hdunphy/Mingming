/**
 * TICKET 200d - the Tabler name maps: every name a screen asks for is in the generated file, nothing
 * hand-typed is left behind, and the layered Trace icon is what the ticket drew.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_NAMES, ICON_TABLER } from './icons';
import { iconLayers } from './iconLayers';
import { ELEMENT_TABLER } from './kit/elementGlyphs';
import { STATUS_ICON_NAMES, STATUS_STROKE } from './kit/statusIconPaths';
import { TABLER_FILLED, TABLER_OUTLINE } from './tabler.generated';
import { TRACE_LAYERS, TRACE_NAMES } from './traceGlyph';

const outline = TABLER_OUTLINE as Readonly<Record<string, unknown>>;
const filled = TABLER_FILLED as Readonly<Record<string, unknown>>;

describe('every mapped Tabler name exists in tabler.generated.ts (200d)', () => {
    it('statuses', () => {
        for (const [status, name] of Object.entries(STATUS_ICON_NAMES)) expect(outline[name], status).toBeDefined();
    });
    it('icons.ts', () => {
        for (const [key, name] of Object.entries(ICON_TABLER)) expect(outline[name], key).toBeDefined();
        for (const name of TRACE_NAMES) expect(outline[name], name).toBeDefined();
    });
    it('element marks, both the filled and the outline variant', () => {
        for (const [key, name] of Object.entries(ELEMENT_TABLER)) {
            expect(outline[name], `${key} outline`).toBeDefined();
            expect(filled[name], `${key} filled`).toBeDefined();
        }
    });
});

describe('the rulings (200d)', () => {
    it('maps the statuses as ruled', () => {
        expect(STATUS_ICON_NAMES).toEqual({
            Burn: 'flame', Poison: 'skull', Asleep: 'zzz', Weakened: 'arrow-big-down', Strengthened: 'arrow-big-up',
            Dazed: 'spiral', Sharp: 'shield-up', Stunned: 'ban', Regen: 'heart-plus', Energized: 'recharging',
            StableOS: 'eye', BarkShield: 'wood', DarkStance: 'moon', LightStance: 'sun',
        });
        expect(STATUS_STROKE).toBe(2);
    });
    it('maps icons.ts as ruled', () => {
        expect(ICON_TABLER).toEqual({
            ranch: 'home-heart', debug: 'bug', expedition: 'map', roster: 'paw', assembly: 'sparkles-2', vault: 'vault', codex: 'book',
            wild: 'sword', rival: 'swords', elite: 'star', alpha: 'crown', ambush: 'eye', marketplace: 'building-store',
            workshop: 'campfire', town: 'building-cottage', event: 'help-circle', start: 'flag', gym: 'building-bank',
            'sound-on': 'volume', 'sound-off': 'volume-off', search: 'search', settings: 'settings', warning: 'alert-triangle',
            check: 'check', grave: 'grave-2', trophy: 'trophy', door: 'door', swap: 'arrows-exchange', scrap: 'hexagons',
            attack: 'sword', defense: 'shield', hp: 'heart', energy: 'bolt', firmware: 'cpu',
            'el-fire': 'flame', 'el-water': 'droplet', 'el-nature': 'leaf', 'el-none': 'circle-off',
            'target-enemy': 'crosshair', 'target-self': 'user',
        });
    });
    it('renames the chrome skull to grave, which draws grave-2; Poison keeps skull', () => {
        expect(ICON_NAMES).toContain('grave');
        expect(ICON_NAMES).not.toContain('skull');
        expect(ICON_TABLER.grave).toBe('grave-2');
        expect(STATUS_ICON_NAMES.Poison).toBe('skull');
    });
    it('keeps blueprint (Trace) as an icon name, drawn as layers', () => {
        expect(ICON_NAMES).toContain('blueprint');
    });
    it('Trace is two layers: a full-size hexagon and a lambda scaled into it with the heavier stroke', () => {
        expect(iconLayers('blueprint')).toBe(TRACE_LAYERS);
        expect(TRACE_LAYERS).toHaveLength(2);
        expect(TRACE_LAYERS[0].nodes).toBe(TABLER_OUTLINE.hexagon);
        expect(TRACE_LAYERS[0].transform).toBeUndefined();
        expect(TRACE_LAYERS[1].nodes).toBe(TABLER_OUTLINE.lambda);
        expect(TRACE_LAYERS[1].transform).toBe('translate(5.28 5.28) scale(0.56)');
        expect(TRACE_LAYERS[1].strokeWidth).toBe(3);
    });
});

describe('nothing hand-typed is left (200d)', () => {
    // A string literal that starts like SVG path data: an absolute move followed by a number.
    const PATH_DATA = /['"`]M\s?-?\d/;
    const FILES = [
        'src/ui/theme/icons.ts',
        'src/ui/theme/Icon.tsx',
        'src/ui/theme/kit/statusIconPaths.ts',
        'src/ui/theme/kit/StatusIcon.tsx',
        'src/ui/theme/kit/elementGlyphs.ts',
        'src/ui/theme/kit/ElementMark.tsx',
        'src/ui/theme/kit/ElementBadge.tsx',
        'src/ui/components/topbar/BiomeSign.tsx',
    ];
    it.each(FILES)('%s has no path data and no <path d=', (file) => {
        const source = readFileSync(resolve(file), 'utf8');
        expect(source).not.toMatch(PATH_DATA);
        expect(source).not.toMatch(/<path\s+d=/);
    });
});

describe('no emoji element icons in the Codex or the type chart (200d)', () => {
    it.each(['src/ui/screens/CodexScreen.tsx', 'src/ui/components/TypeChart.tsx'])('%s draws ElementMark', (file) => {
        const source = readFileSync(resolve(file), 'utf8');
        expect(source).not.toContain('getElementIcon');
        expect(source).toContain('ElementMark');
    });
    it('cardIcons.ts holds no emoji', () => {
        const source = readFileSync(resolve('src/ui/components/cardIcons.ts'), 'utf8');
        expect(source).not.toContain('getElementIcon');
        expect(source).not.toContain('getCategoryIcon');
        expect(source).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    });
});
