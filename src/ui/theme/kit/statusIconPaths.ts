/**
 * THE STATUS ICONS, AS DATA — ticket 183b. Fourteen flat, single-colour glyphs, one per status, on
 * a 24 grid and drawn as strokes in `currentColor` so a chip tints them.
 *
 * They replace the emoji `statusGlossary` carried. An emoji ignores the chip's colour, looks
 * different on every machine, and was the one place the battle screen still drew in someone else's
 * art style. These are plain shapes drawn in code (no picture was generated or traced), so the
 * "no AI-made image goes to an artist" rule is not in play.
 *
 * A separate `.ts` file from the component because `react-refresh/only-export-components` is an
 * error in this repo, and `StatusIcon.test.tsx` sweeps these keys against the glossary without
 * rendering anything.
 */
import type { StatusType } from '../../../engine/types';

export const STATUS_ICON_PATHS: Readonly<Record<StatusType, string>> = {
    /* A flame with a notch in its tongue. */
    Burn: 'M12 3c1 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2 1-3 1.8-3.8.2 1.8 1.2 2.6 2.2 2.6C11 9 12 6 12 3z',
    /* A skull: the cranium, the jaw, and two sockets drawn as round-capped dots. */
    Poison: 'M5 11a7 7 0 0 1 14 0v3l-2 1v4H7v-4l-2-1zM9.5 12h.01M14.5 12h.01M11 17v2M13 17v2',
    /* Two Zs, the second smaller. */
    Asleep: 'M4 5h7l-7 8h7M13 12h6l-6 7h6',
    /* An arrow down. */
    Weakened: 'M12 4v15M5 12l7 7 7-7',
    /* An arrow up. */
    Strengthened: 'M12 20V5M5 12l7-7 7 7',
    /* A spiral: dizzy. */
    Dazed: 'M12 12c0-1.5 2-1.5 2 0s-1.5 3-3 3-4-1.5-4-4 2.5-5.5 5.5-5.5S19 9 19 12',
    /* A shield: takes less damage. */
    Sharp: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z',
    /* A lightning bolt. */
    Stunned: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
    /* A heart with a plus. */
    Regen: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM12 10v4M10 12h4',
    /* A cell with a terminal and a bolt. */
    Energized: 'M3 8h14v8H3zM17 11h3v2h-3M10 10l-2 3h3l-2 3',
    /* A cut gem. */
    StableOS: 'M12 3l8 9-8 9-8-9zM4 12h16',
    /* A log: its end grain and the side. */
    BarkShield: 'M4 8h14a2 2 0 0 1 0 8H4a4 4 0 0 1 0-8zM8 12h.01M11 12h5',
    /* A crescent. */
    DarkStance: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    /* A sun: a disc and eight rays. */
    LightStance: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
};
