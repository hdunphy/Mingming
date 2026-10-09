/**
 * TICKET 205c - THE GUARD. No emoji or pictographic symbol is left anywhere in the player-facing UI.
 *
 * `Icon.test.tsx` held this rule for the chrome and exempted "the in-battle phase two" (the card
 * effect lines, the intent icons, the type chart, TERMINATED, the banners, the absorbed float). Ticket
 * 205 swapped those for Tabler icons, so this scan has no exemption: every non-test file under
 * `src/ui` is read, comment lines are skipped (a doc comment naming the emoji it replaced is the most
 * useful place for one), and the only things let through are the two lists in `emojiAllowList.ts`.
 *
 * It fails on the parent of 205b with every symbol the 200d sweep found.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALLOWED_FILES, ALLOWED_FOLDERS } from './emojiAllowList';
import { hasPictograph } from './pictographs';

const TEXT_FILES = /\.(tsx?|css|svg|json|html)$/;

/** The lines of `text` that carry a pictographic character, comment lines skipped. */
export function pictographLines(text: string): { line: number; text: string }[] {
    const found: { line: number; text: string }[] = [];
    text.split('\n').forEach((raw, index) => {
        const trimmed = raw.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        if (hasPictograph(raw)) found.push({ line: index + 1, text: trimmed.slice(0, 90) });
    });
    return found;
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        const forward = path.split('\\').join('/');
        if (ALLOWED_FOLDERS.some((folder) => forward.endsWith(folder))) continue;
        if (ALLOWED_FILES.some((file) => forward.endsWith(file))) continue;
        if (statSync(path).isDirectory()) walk(path, out);
        else if (TEXT_FILES.test(entry) && !entry.includes('.test.')) out.push(path);
    }
    return out;
}

describe('the scanner itself (205c)', () => {
    it('flags the symbols the 200d sweep found', () => {
        for (const symbol of ['\u2694\uFE0F', '\u{1F49A}', '\u2726', '\u2716', '\u26A1', '\u{1F0CF}', '\u{1F5D1}', '\u{1F525}', '\u21A9',
            '\u{1F50D}', '\u2728', '\u23F1', '\u{1F6E1}', '\u2B06', '\u21AA', '\u{1F317}', '\u267B', '\u26A0',
            '\u2713', '\u{1F9EA}', '\u{1F31F}', '\u2620', '\u{1F9EC}', '\u2605', '\u2606']) {
            expect(pictographLines(`<span>${symbol} text</span>`), symbol).toHaveLength(1);
        }
    });
    it('flags an escape sequence for one', () => {
        expect(pictographLines("const tick = '\\u2713';")).toHaveLength(1);
        expect(pictographLines("content: '\\2713';")).toHaveLength(1);
    });
    it('lets the punctuation set and comment lines through', () => {
        expect(pictographLines('<b>SORT \u25BE {n} \u2192 \u00D7 \u2026 \u00B7</b>')).toEqual([]);
        expect(pictographLines(' * the old \u2694\uFE0F became a sword')).toEqual([]);
        expect(pictographLines('// \u2713 was here')).toEqual([]);
    });
});

describe('no emoji or pictographic symbol in the production UI (205c)', () => {
    it('reads every non-test file under src/ui and finds none', () => {
        const files = walk(resolve('src/ui'));
        expect(files.length, 'the scan found no files; the path is wrong').toBeGreaterThan(100);
        const offenders: string[] = [];
        for (const file of files) {
            for (const hit of pictographLines(readFileSync(file, 'utf8'))) {
                offenders.push(`${file.split(resolve('.')).join('').replace(/^[\\/]/, '')}:${hit.line}  ${hit.text}`);
            }
        }
        expect(offenders, `emoji found (${offenders.length}):\n${offenders.join('\n')}`).toEqual([]);
    });

    it('skips only the Instinct glyph folder and the file that defines what a pictograph is', () => {
        expect(ALLOWED_FOLDERS).toEqual(['src/ui/assets/instinct-glyphs']);
        expect(ALLOWED_FILES).toEqual(['src/ui/theme/pictographs.ts']);
    });
});
