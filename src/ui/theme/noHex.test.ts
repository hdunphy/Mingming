/**
 * TICKET 183a — NO HEX LITERAL OUTSIDE THE PALETTE FILES.
 *
 * Ticket 183's rule 3: *"Tokens only. No hex literal in a screen stylesheet or a component after
 * 183a."* A colour typed into a screen is a colour the palette cannot move, which is how the old
 * look and the new one end up on the same screen.
 *
 * 183a first shipped this as a ratchet (528 literals in 37 files, counts only going down). Henry
 * ruled a one-time sweep instead, and the sweep is done: every screen stylesheet and component
 * now reads a token, so this is a flat ban with no baseline to maintain.
 *
 * What it counts: every `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa` in code. Comments are skipped,
 * because a comment may name the colour it replaced.
 *
 * Out of scope on purpose: `src/debug/` (dev tools, stripped from the build), `src/engine/` (the
 * status glossary's colours are engine data; ticket 183 changes nothing in the engine), tests, and
 * the files that ARE the palette or do colour math on hex: `tokens.css`, `runShell.ts`
 * (`ELEMENT_COLOR`), `jsColors.ts` (the few colours JS must have as hex) and `contrastText.ts`.
 */

import { describe, expect, it } from 'vitest';

import { sourceFiles } from './scanSource';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const COMMENTS = /\/\*[\s\S]*?\*\/|(?<![:\w])\/\/[^\n]*/g;

const EXEMPT = [
    /^src\/debug\//,
    /^src\/engine\//,
    /\.test\.(ts|tsx)$/,
    /^src\/ui\/theme\/tokens\.css$/,
    /^src\/ui\/theme\/jsColors\.ts$/,
    /^src\/ui\/screens\/runShell\.ts$/,
    /^src\/ui\/utils\/contrastText\.ts$/,
];

const hits = sourceFiles()
    .filter((f) => !EXEMPT.some((rule) => rule.test(f.path)))
    .map((f) => ({ path: f.path, found: f.text.replace(COMMENTS, '').match(HEX) ?? [] }))
    .filter((f) => f.found.length > 0);

describe('no hex literal outside the palette files (183a)', () => {
    it('has none in any stylesheet or component', () => {
        const report = hits.map((h) => `${h.path}: ${h.found.join(' ')}`);
        expect(report, 'use a token from tokens.css (or JS_COLOR from jsColors.ts)').toEqual([]);
    });

    it('holds the whole kit to it too', () => {
        expect(hits.filter((h) => h.path.startsWith('src/ui/theme/kit/'))).toEqual([]);
    });
});
