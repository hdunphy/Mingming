/**
 * TICKET 34 — the icon set, and the guard that keeps emoji from coming back.
 *
 * The sweep matters more than it looks. An icon is drawn once and then referenced by name forever,
 * so a path with a typo in it renders as *nothing* — an empty 16px box in a nav bar, which reads as
 * a layout quirk rather than a bug and would survive every other test in this suite. Rendering the
 * whole set and asserting each one actually produced geometry is the only place that gets caught.
 *
 * The no-emoji sweep is the ticket's own acceptance criterion (*"No emoji in production UI"*) turned
 * into something that fails a build instead of something someone has to re-check by eye.
 */

import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Icon } from './Icon';
import { ICON_NAMES } from './icons';
import { iconLayers } from './iconLayers';
import { NODE_ICON } from '../screens/regionLayout';
import { FIGHT_KINDS } from '../../engine/run/encounter';
import type { NodeKind } from '../../engine/runTypes';

describe('the icon set', () => {
    it('draws every name it offers', () => {
        for (const name of ICON_NAMES) {
            const markup = renderToStaticMarkup(<Icon name={name} />);
            expect(markup, `${name} rendered no geometry`).toMatch(/<(path|circle|rect|line|ellipse)\b/);
            expect(iconLayers(name).length, `${name} has no layers`).toBeGreaterThan(0);
            // Tabler's own nodes, every layer non-empty.
            for (const layer of iconLayers(name)) expect(layer.nodes.length, `${name} has an empty layer`).toBeGreaterThan(0);
        }
    });

    it('inherits colour instead of carrying its own', () => {
        // The whole reason for the swap: an emoji ignores `color`, so the map could not tint a node
        // by its biome. Any hardcoded fill or stroke here would give that property straight back.
        for (const name of ICON_NAMES) {
            const markup = renderToStaticMarkup(<Icon name={name} />);
            expect(markup).toContain('stroke="currentColor"');
            expect(markup).toContain('fill="none"');
            expect(markup, `${name} hardcodes a colour`).not.toMatch(/(fill|stroke)="#/);
        }
    });

    it('is decorative by default and named only when asked', () => {
        // An icon beside its own text label read out by a screen reader is the label twice.
        expect(renderToStaticMarkup(<Icon name="gym" />)).toContain('aria-hidden="true"');
        const titled = renderToStaticMarkup(<Icon name="gym" title="Gym" />);
        expect(titled).toContain('role="img"');
        expect(titled).toContain('<title>Gym</title>');
        expect(titled).not.toContain('aria-hidden');
    });

    it('covers every node kind the region graph can produce', () => {
        // `NODE_ICON` is typed `Record<NodeKind, IconName>`, so this cannot fail at compile time —
        // what it guards is a kind added to the union and given an icon that was never drawn.
        for (const kind of Object.keys(NODE_ICON) as NodeKind[]) {
            expect(ICON_NAMES, `no icon drawn for ${kind}`).toContain(NODE_ICON[kind]);
        }
        for (const kind of FIGHT_KINDS) expect(NODE_ICON[kind]).toBeDefined();
    });
});

/**
 * The acceptance criterion, as a test.
 *
 * Scoped to `src/ui` and to what is RENDERED: comment lines are skipped (a doc comment naming the
 * emoji it replaced is the most useful place for one to be), and `src/engine` is excluded because
 * its combat-log strings are a separate vocabulary that ticket 34's resolution hands to a second
 * pass — see the ticket. Narrow and honest beats broad and disabled.
 */
describe('no emoji in the production UI', () => {
    // `\uFE0F` is listed separately from the ranges: inside a class it combines with whatever
    // precedes it, which is `no-misleading-character-class` (blocking in CI since ticket 55) and is
    // also just wrong — the variation selector is its own tell, not part of a range.
    const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}/u;

    /*
     * Ticket 205: no exemption any more. The tick, the stars and the four-point star used to be waved
     * through here as "typography", and the in-battle files (card effect lines, intents, the type
     * chart, TERMINATED, the banners, the absorbed float) were skipped as "phase two". All of them are
     * Tabler icons now, so this scan covers the whole UI. The arrows and shapes that stay as plain text
     * are outside these ranges; `noEmoji.test.ts` is the wider guard, with its own allow-list.
     */
    function walk(dir: string, out: string[] = []): string[] {
        for (const entry of readdirSync(dir)) {
            const path = join(dir, entry);
            if (statSync(path).isDirectory()) walk(path, out);
            else if (/\.(tsx?|css)$/.test(entry) && !entry.includes('.test.')) out.push(path);
        }
        return out;
    }

    it('has none left in the chrome — nav, screens and the map', () => {
        const offenders: string[] = [];
        for (const file of walk(resolve('src/ui'))) {
            readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
                if (EMOJI.test(line)) offenders.push(`${file.replace(resolve('.') + '/', '')}:${index + 1}  ${trimmed.slice(0, 80)}`);
            });
        }
        expect(offenders, `emoji found:\n${offenders.join('\n')}`).toEqual([]);
    });
});
