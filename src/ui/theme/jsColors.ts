/**
 * THE COLOURS JAVASCRIPT NEEDS AS REAL HEX — ticket 183a.
 *
 * Almost every colour in the UI is a `var(--token)` and the browser resolves it. A few places
 * cannot use one: a status colour is parsed to RGB for a canvas ring (`statusTells.ts`), and a
 * float's colour gets an alpha suffix glued on (`${color}66`). Both need a literal `#rrggbb`.
 * Those places take it from here, so the hex lives in a palette file (exempt from the no-hex test,
 * like `tokens.css` and `runShell.ts`) and `theme.test.ts` asserts every value equals its token.
 */

export const JS_COLOR = {
    text: '#ffffff',
    textDim: '#c9d3e0',
    textMute: '#9aa6b8',
    edge: '#e8eef5',
    hp: '#4cda64',
    hpLow: '#f2423b',
} as const;

/** Which `tokens.css` name each value mirrors. */
export const JS_COLOR_TOKEN: Readonly<Record<keyof typeof JS_COLOR, string>> = {
    text: '--text',
    textDim: '--text-dim',
    textMute: '--text-mute',
    edge: '--panel-edge',
    hp: '--hp',
    hpLow: '--hp-low',
};
