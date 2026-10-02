/**
 * TICKET 183a — NO HEX LITERAL OUTSIDE THE TOKEN FILES.
 *
 * Ticket 183's rule 3: *"Tokens only. No hex literal in a screen stylesheet or a component after
 * 183a."* A colour typed into a screen is a colour the palette cannot move, which is how the old
 * look and the new one end up on the same screen.
 *
 * # A RATCHET, NOT A FLAT BAN
 *
 * About 600 literals sit in 40-odd existing files that 183b to 183f repaint one screen at a time,
 * so a flat ban would either fail today or force one commit to restyle the whole game. Instead:
 *
 *  - a file NOT listed in `noHexBaseline.ts` may hold none, which covers every new file (the whole
 *    kit among them) from the first line;
 *  - a listed file may never hold MORE than its baseline, so the number only goes down;
 *  - a listed file that holds FEWER fails too, and the message says the new number, so whoever
 *    repaints a screen lowers the line (or deletes it at zero) in the same commit.
 *
 * Out of scope on purpose: `src/debug/` (dev tools, stripped from the build), `src/engine/` (the
 * status glossary's colours are engine data; ticket 183 changes nothing in the engine), tests, and
 * the two files that ARE the palette: `tokens.css` and `runShell.ts`.
 */

import { describe, expect, it } from 'vitest';

import { NO_HEX_BASELINE } from './noHexBaseline';
import { sourceFiles } from './scanSource';

const HEX = /#[0-9a-fA-F]{6}\b/g;

const EXEMPT = [
    /^src\/debug\//,
    /^src\/engine\//,
    /\.test\.(ts|tsx)$/,
    /^src\/ui\/theme\/tokens\.css$/,
    /^src\/ui\/screens\/runShell\.ts$/,
];

const counts = new Map<string, number>(
    sourceFiles()
        .filter((f) => !EXEMPT.some((rule) => rule.test(f.path)))
        .map((f) => [f.path, (f.text.match(HEX) ?? []).length] as const)
        .filter(([, n]) => n > 0),
);

describe('no hex literal outside the token files (183a)', () => {
    it('lets no file hold more hex literals than its baseline, and no new file hold any', () => {
        for (const [path, n] of counts) {
            const allowed = NO_HEX_BASELINE[path] ?? 0;
            expect(n, `${path} has ${n} hex literal(s), baseline ${allowed}: use a token from tokens.css`)
                .toBeLessThanOrEqual(allowed);
        }
    });

    it('makes a repaint lower the baseline in the same commit', () => {
        for (const [path, allowed] of Object.entries(NO_HEX_BASELINE)) {
            const n = counts.get(path) ?? 0;
            expect(n, `${path} now holds ${n}: set its baseline to ${n}${n === 0 ? ' (delete the line)' : ''}`)
                .toBe(allowed);
        }
    });

    it('keeps every kit file at zero', () => {
        for (const path of counts.keys()) expect(path.startsWith('src/ui/theme/kit/'), path).toBe(false);
    });
});
