/**
 * TICKET 205c - what the no-emoji source scan (`noEmoji.test.ts`) lets through.
 *
 * Three things only, and all are explicit so the list is short enough to read:
 *
 *  - FOLDERS the scan does not enter. The Instinct glyph pictures (ticket 199) are AI-drawn and
 *    disclosed on Steam; they are art files, not text a font draws.
 *  - FILES the scan does not read: `pictographs.ts`, which DEFINES what a pictograph is and so has to write the
 *    ranges out (as escapes; it holds no pictograph character itself).
 *  - PUNCTUATION: typographic marks that are plain text glyphs in every UI font, render in the text
 *    colour and are not emoji (arrows, triangles, a bullet, a middle dot, an ellipsis, the times
 *    sign). None of them is in the scanned ranges today; they are named here so a future widening of
 *    the ranges cannot start flagging them by accident.
 *
 * Everything else that is an emoji or a pictographic symbol must be a Tabler icon (`InlineIcon`).
 * Not allowed, on purpose: the tick, the stars and the four-point star that `Icon.test.tsx` used to
 * wave through as "typography". They became icons in this ticket.
 */

/** Folders under the repo root that the scan skips entirely, forward slashes. */
export const ALLOWED_FOLDERS: readonly string[] = ['src/ui/assets/instinct-glyphs'];

/** Individual files the scan skips, forward slashes from the repo root. */
export const ALLOWED_FILES: readonly string[] = ['src/ui/theme/pictographs.ts'];

/** Plain typographic marks. */
export const PUNCTUATION: ReadonlySet<string> = new Set([
    '·', '×', '…', '–', '—',
    '←', '→', '↑', '↓', '⇄', '⇐', '⇧',
    '▶', '◀', '▲', '▼', '▴', '▾', '●', '◆',
]);
