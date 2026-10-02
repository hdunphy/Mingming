import { describe, expect, it } from 'vitest';

import { paintSegments } from './litSegments';

describe('paintSegments', () => {
    it('leaves segments alone when nothing is lit', () => {
        expect(paintSegments([{ text: 'abc', changed: false }], [])).toEqual([{ text: 'abc', changed: false, lit: false }]);
    });

    it('cuts a plain description at the lit range', () => {
        const text = '22 power. If the target is Dazed, draw 1.';
        const out = paintSegments([{ text, changed: false }], [{ start: 10, end: text.length }]);
        expect(out).toEqual([
            { text: '22 power. ', changed: false, lit: false },
            { text: 'If the target is Dazed, draw 1.', changed: false, lit: true },
        ]);
    });

    it('keeps an upgraded number marked inside a lit clause', () => {
        // "30 power. If Dazed, draw 1." with the 30 an upgrade and the second sentence lit.
        const segs = [
            { text: '30', changed: true },
            { text: ' power. If Dazed, draw ', changed: false },
            { text: '1', changed: false },
            { text: '.', changed: false },
        ];
        const out = paintSegments(segs, [{ start: 10, end: 27 }]);
        expect(out.map((s) => s.text).join('')).toBe('30 power. If Dazed, draw 1.');
        expect(out[0]).toEqual({ text: '30', changed: true, lit: false });
        expect(out.filter((s) => s.lit).map((s) => s.text).join('')).toBe('If Dazed, draw 1.');
    });
});
