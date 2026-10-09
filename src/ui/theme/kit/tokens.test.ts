/**
 * TICKET 183a — every element colour has a symbol. An element is said three ways (colour, symbol,
 * word) so no information rides on colour alone; a colour with no glyph would be the one place it
 * does. Swept against `tokens.css` without rendering anything.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ELEMENT_TABLER, elementKey } from './elementGlyphs';

const TOKENS = readFileSync(resolve('src/ui/theme/tokens.css'), 'utf8');
const elementTokens = [...TOKENS.matchAll(/--el-([a-z]+)\s*:/g)].map((m) => m[1]);

describe('the element marks', () => {
    it('has a mark glyph for every --el-* token', () => {
        expect(elementTokens.length).toBe(4);
        for (const name of elementTokens) {
            expect(ELEMENT_TABLER[name as keyof typeof ELEMENT_TABLER], `--el-${name} has no glyph`).toBeTruthy();
        }
    });

    it('has no glyph for a colour that does not exist', () => {
        expect(Object.keys(ELEMENT_TABLER).sort()).toEqual([...elementTokens].sort());
    });

    it('draws an element with no colour of its own as Neutral', () => {
        expect(elementKey('Fire')).toBe('fire');
        expect(elementKey('WATER')).toBe('water');
        for (const e of ['None', 'Dark', 'Air', 'Plasma', '']) expect(elementKey(e)).toBe('none');
    });
});
