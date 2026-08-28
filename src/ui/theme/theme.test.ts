/**
 * TICKET 34 — the token vocabulary, and the one seam in it that can silently come apart.
 *
 * CSS custom properties and TypeScript constants cannot import from each other, so the nine element
 * colours exist twice: once in `tokens.css` as `--el-*` (for stylesheets) and once in
 * `screens/runShell.ts` as `ELEMENT_COLOR` (for the inline `style` attributes the ruled mockups
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

    it('declares the whole vocabulary a screen sheet is told to reach for', () => {
        // The point of a token layer is that a stylesheet can rely on the names existing. A missing
        // one does not throw — it resolves to nothing and the rule silently does not apply, which is
        // the quietest possible styling bug.
        const required = [
            '--surface-0', '--surface-1', '--surface-2', '--surface-3',
            '--line-soft', '--line', '--line-strong',
            '--ink', '--ink-dim', '--ink-label', '--ink-faint', '--ink-head',
            '--fs-micro', '--fs-tiny', '--fs-small', '--fs-body', '--fs-lead', '--fs-head', '--fs-title',
            '--track-wide', '--track-loose',
            '--gap-hair', '--gap-tight', '--gap', '--gap-wide', '--gap-section',
            '--radius-chip', '--radius-card', '--radius-panel',
            '--glow-blur', '--shadow-panel', '--shadow-inset-top',
        ];
        for (const name of required) expect(tokens.has(name), `${name} is missing`).toBe(true);
    });

    it('still declares every legacy name index.css was shipped reading', () => {
        // The aliases are what make this pass a vocabulary addition rather than a restyle. Deleting
        // one before its last reader is a screen that loses a colour with no error anywhere.
        const legacy = [
            '--bg-dark', '--bg-card', '--accent-primary', '--hp-green', '--hp-red',
            '--energy-blue', '--glass-border', '--premium-shadow',
            '--fire', '--water', '--nature', '--earth', '--air', '--ice', '--light', '--dark',
        ];
        for (const name of legacy) expect(tokens.has(name), `${name} was dropped`).toBe(true);
    });
});
