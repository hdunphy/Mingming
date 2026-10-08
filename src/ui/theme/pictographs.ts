/**
 * TICKET 205 - what counts as an emoji or pictographic symbol, written once. `noEmoji.test.ts` scans
 * the whole UI with it and `TooltipLines.test.tsx` checks the words of every effect line with it.
 *
 * The ranges: the emoji planes, Miscellaneous Technical (the stopwatch), Miscellaneous Symbols and
 * Dingbats (the tick, the stars, the skull), Miscellaneous Symbols and Arrows (the up arrow), and the
 * two arrows that have an emoji form. The variation selector and the joiner sit outside the class:
 * inside it they would combine with the character before them (`no-misleading-character-class`).
 *
 * Everything is written as escapes on purpose, so this file holds no pictograph itself and the scan
 * that reads it finds nothing.
 */

import { PUNCTUATION } from './emojiAllowList';

const PICTOGRAPH = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{21A9}\u{21AA}]|\u{FE0F}|\u{200D}/u;

/** The same characters written as an escape (`✓`, `\u{1F525}`, a CSS `\2713`). */
const ESCAPED = /\\u\{?(?:1F[0-9A-F]{3}|2[3-7][0-9A-F]{2}|2B[0-9A-F]{2}|FE0F|21A9|21AA)\}?|content:\s*['"]\\(?:2[3-7][0-9a-f]{2}|2b[0-9a-f]{2}|1f[0-9a-f]{3})/i;

/** True when `text` carries an emoji or pictographic symbol, the allowed punctuation not counting. */
export function hasPictograph(text: string): boolean {
    const visible = [...text].filter((ch) => !PUNCTUATION.has(ch)).join('');
    return PICTOGRAPH.test(visible) || ESCAPED.test(visible);
}
