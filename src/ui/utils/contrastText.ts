/**
 * Text-contrast utilities for element-colored UI (cost badges, gems, chips).
 *
 * The element palette lives in src/index.css (--fire, --ice, ...). CSS vars
 * can't be parsed cheaply at render time, so the same hex values are mirrored
 * here and per-element text/badge colors are precomputed once at module load
 * using WCAG relative luminance — deterministic, no runtime DOM reads.
 */

export const DARK_TEXT = '#0b0e14';
export const LIGHT_TEXT = '#ffffff';

/** Reference dark backdrop of the terminal UI (panels / cards). */
const DARK_UI_BG = '#0d0d14';

/** Mirrors the element CSS vars in src/index.css (plus the None gray). */
export const ELEMENT_HEX: Record<string, string> = {
    Fire: '#ff3333',
    Water: '#3399ff',
    Nature: '#33cc33',
    Earth: '#996633',
    Air: '#87ceeb',
    Ice: '#00ffff',
    Light: '#ffff80',
    Dark: '#8000ff',
    None: '#8a8a99',
};

function parseHex(hex: string): [number, number, number] {
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = Number.parseInt(h.slice(0, 6), 16);
    if (h.length < 6 || Number.isNaN(n)) return [0, 0, 0];
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function toHex([r, g, b]: [number, number, number]): string {
    const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

function channel(v: number): number {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a hex color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
    const [r, g, b] = parseHex(hex);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

/** Mix `hex` toward `toward` by `amount` (0..1) in plain sRGB. */
export function mixHex(hex: string, toward: string, amount: number): string {
    const a = parseHex(hex);
    const b = parseHex(toward);
    return toHex([
        a[0] + (b[0] - a[0]) * amount,
        a[1] + (b[1] - a[1]) * amount,
        a[2] + (b[2] - a[2]) * amount,
    ]);
}

/**
 * Readable text color for a solid background fill.
 * Bright fills (Ice cyan, Light, Air, Nature green) get near-black text;
 * dark fills (Fire red, Dark purple, Water blue) keep white text.
 */
export function readableTextOn(bg: string): string {
    return relativeLuminance(bg) > 0.36 ? DARK_TEXT : LIGHT_TEXT;
}

/**
 * Solid badge fill for an element color: unchanged when its computed text
 * color already clears WCAG AA (4.5:1); otherwise darkened step-by-step until
 * white text does (mid-brightness cases: Fire red, Water blue, None gray).
 */
export function badgeBackgroundFor(hex: string): string {
    const text = readableTextOn(hex);
    let bg = hex;
    for (let i = 0; i < 12 && contrastRatio(text, bg) < 4.5; i++) {
        bg = mixHex(bg, '#000000', 0.12);
    }
    return bg;
}

/**
 * Element-tinted TEXT color for use on the dark terminal UI (chips, labels):
 * dark element colors (Earth brown, Dark purple) are lightened until they
 * clear 4.5:1 against the panel backdrop; bright ones pass through unchanged.
 */
export function accentOnDarkFor(hex: string): string {
    let c = hex;
    for (let i = 0; i < 12 && contrastRatio(c, DARK_UI_BG) < 4.5; i++) {
        c = mixHex(c, '#ffffff', 0.15);
    }
    return c;
}

const hexFor = (el: string): string => ELEMENT_HEX[el] ?? ELEMENT_HEX.None;

/* Precomputed per-element maps (derived from ELEMENT_HEX, deterministic). */
export const ELEMENT_TEXT_COLOR: Record<string, string> = Object.fromEntries(
    Object.keys(ELEMENT_HEX).map(el => [el, readableTextOn(ELEMENT_HEX[el])])
);

export const ELEMENT_BADGE_BG: Record<string, string> = Object.fromEntries(
    Object.keys(ELEMENT_HEX).map(el => [el, badgeBackgroundFor(ELEMENT_HEX[el])])
);

export const ELEMENT_ACCENT_ON_DARK: Record<string, string> = Object.fromEntries(
    Object.keys(ELEMENT_HEX).map(el => [el, accentOnDarkFor(ELEMENT_HEX[el])])
);

/** Text color to use on a badge/gem filled with this element's color. */
export const getElementTextColor = (el: string): string =>
    ELEMENT_TEXT_COLOR[el] ?? readableTextOn(hexFor(el));

/** Solid fill for an element badge/gem, guaranteed >= 4.5:1 with its text. */
export const getElementBadgeBg = (el: string): string =>
    ELEMENT_BADGE_BG[el] ?? badgeBackgroundFor(hexFor(el));

/** Element-tinted text color readable on the dark terminal background. */
export const getElementAccent = (el: string): string =>
    ELEMENT_ACCENT_ON_DARK[el] ?? accentOnDarkFor(hexFor(el));

/** Subtle shadow that keeps light badge text crisp on mid-brightness fills. */
export const badgeTextShadow = (textColor: string): string =>
    textColor === LIGHT_TEXT ? '0 1px 2px rgba(0, 0, 0, 0.65)' : 'none';
