/**
 * TICKET 34 — the token vocabulary, and the one seam in it that can silently come apart.
 *
 * CSS custom properties and TypeScript constants cannot import from each other, so the four element
 * colours (ticket 183a cut the nine to four) exist twice: once in `tokens.css` as `--el-*` (for
 * stylesheets) and once in `screens/runShell.ts` as `ELEMENT_COLOR` (for the inline `style` attributes the ruled mockups
 * use). Two copies of a palette is exactly the kind of thing that drifts one hex at a time until a
 * card frame and the badge on the card beside it disagree about what Fire looks like — and nothing
 * else in the suite would notice, because both halves are individually correct.
 *
 * So the file is parsed and compared. It is a cheap test for a failure with no other alarm.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ELEMENT_COLOR, colorFor } from '../screens/runShell';
import { JS_COLOR, JS_COLOR_TOKEN } from './jsColors';
import { sourceFiles } from './scanSource';

const TOKENS = readFileSync(resolve('src/ui/theme/tokens.css'), 'utf8');

/** Every `--name: value;` in the file, as a map. Comments hold no declarations, so this is enough. */
function declarations(css: string): Map<string, string> {
    const found = new Map<string, string>();
    for (const [, name, value] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        found.set(name, value.trim());
    }
    return found;
}

describe('the theme tokens', () => {
    const tokens = declarations(TOKENS);

    it('declares an --el-* for every element the engine can produce, and they MATCH runShell', () => {
        for (const [element, hex] of Object.entries(ELEMENT_COLOR)) {
            const name = `--el-${element.toLowerCase()}`;
            expect(tokens.get(name), `${name} is missing from tokens.css`).toBeDefined();
            expect(tokens.get(name)!.toLowerCase(), `${name} disagrees with ELEMENT_COLOR.${element}`)
                .toBe(hex.toLowerCase());
        }
    });

    it('has no --el-* that ELEMENT_COLOR does not know about', () => {
        // The other direction of the same seam: a colour added to the stylesheet and not to the
        // mirror is an element the inline-styled surfaces would render as None.
        const known = new Set(Object.keys(ELEMENT_COLOR).map((e) => `--el-${e.toLowerCase()}`));
        for (const name of tokens.keys()) {
            if (name.startsWith('--el-')) expect(known, `${name} has no ELEMENT_COLOR entry`).toContain(name);
        }
    });

    it('falls back to None for an element with no colour, rather than to nothing', () => {
        expect(colorFor('Plasma')).toBe(ELEMENT_COLOR.None);
    });

    it('declares the whole v2 vocabulary a screen sheet is told to reach for', () => {
        // The point of a token layer is that a stylesheet can rely on the names existing. A missing
        // one does not throw - it resolves to nothing and the rule silently does not apply, which is
        // the quietest possible styling bug.
        const required = [
            '--font-display', '--font-body',
            '--page', '--panel', '--panel-edge', '--panel-2', '--panel-3', '--hp-track', '--ink',
            '--text', '--text-dim', '--text-mute', '--text-faint', '--select', '--energy', '--amber',
            '--hp', '--hp-hi', '--hp-mid', '--hp-mid-hi', '--hp-low', '--hp-low-hi', '--shield',
            '--card-body', '--card-text', '--card-mute',
        ];
        for (const name of required) expect(tokens.has(name), `${name} is missing`).toBe(true);
    });

    it('mirrors every JS colour in jsColors.ts from its token', () => {
        for (const key of Object.keys(JS_COLOR) as Array<keyof typeof JS_COLOR>) {
            const name = JS_COLOR_TOKEN[key];
            expect(tokens.get(name), `${name} is missing from tokens.css`).toBeDefined();
            expect(tokens.get(name)!.toLowerCase(), `JS_COLOR.${key} disagrees with ${name}`).toBe(JS_COLOR[key]);
        }
    });

    it('has exactly the four ruled element colours (183a)', () => {
        const els = [...tokens.keys()].filter((name) => name.startsWith('--el-')).sort();
        expect(els).toEqual(['--el-fire', '--el-nature', '--el-none', '--el-water']);
    });

    it('has the one selection colour and makes energy the same yellow on purpose', () => {
        expect(tokens.get('--select')).toBe(tokens.get('--energy'));
    });

    it('no longer declares any name ticket 183a deleted, and nothing reads one', () => {
        // The legacy aliases had about a hundred readers; 183a re-pointed every one. A glow, a glass
        // panel or a 48px blurred shadow cannot come back through a name that resolves to nothing.
        const deleted = [
            'bg-dark', 'bg-card', 'accent-primary', 'accent-secondary', 'hp-green', 'hp-red', 'energy-blue',
            'glass-border', 'glass-bg', 'premium-shadow', 'shadow-panel', 'shadow-inset-top', 'glow-blur',
            'fire', 'water', 'nature', 'earth', 'air', 'ice', 'light', 'dark',
            'el-earth', 'el-air', 'el-ice', 'el-light', 'el-dark',
            'surface-0', 'surface-1', 'surface-2', 'surface-3', 'line-soft', 'line', 'line-strong',
            'ink-dim', 'ink-label', 'ink-faint', 'ink-head',
        ];
        for (const name of deleted) {
            expect(tokens.has(`--${name}`), `--${name} is back in tokens.css`).toBe(false);
        }
        const reader = new RegExp(`var\\(--(${deleted.join('|')})[,)]`);
        for (const file of sourceFiles()) {
            if (file.path.endsWith('theme.test.ts')) continue;
            const hit = reader.exec(file.text);
            expect(hit, `${file.path} still reads var(--${hit?.[1]})`).toBeNull();
        }
    });
});
