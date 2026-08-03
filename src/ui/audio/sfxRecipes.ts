/**
 * SFX recipe book — every game sound as a small pure "recipe" over an abstract
 * synthesis toolkit. Zero asset files: everything is synthesized live with the
 * Web Audio API (see AudioEngine.ts for the toolkit implementation).
 *
 * Aesthetic: cyberpunk terminal. Clean sine/square/saw blips, filtered noise
 * impacts, glitchy ticks, small arpeggios. Nothing orchestral or cartoonish.
 *
 * Tuning guide: all times are SECONDS, all gains are linear 0..1 (pre master).
 * Each recipe is a plain function of (toolkit, opts) so numbers can be tweaked
 * in isolation without touching engine plumbing.
 */

export type SfxName =
    | 'cardPlay'
    | 'cardDraw'
    | 'hit'
    | 'hitCrit'
    | 'absorbed'
    | 'heal'
    | 'statusApply'
    | 'death'
    | 'levelUp'
    | 'turnPlayer'
    | 'turnEnemy'
    | 'victory'
    | 'defeat'
    | 'reveal'
    | 'rewardClaim'
    | 'stanceDark'
    | 'stanceLight'
    | 'discountPrimed'
    | 'breach'
    | 'uiClick'
    | 'uiError';

/** Runtime list of every SFX name (kept in sync with the union by the type below). */
export const ALL_SFX_NAMES = [
    'cardPlay',
    'cardDraw',
    'hit',
    'hitCrit',
    'absorbed',
    'heal',
    'statusApply',
    'death',
    'levelUp',
    'turnPlayer',
    'turnEnemy',
    'victory',
    'defeat',
    'reveal',
    'rewardClaim',
    'stanceDark',
    'stanceLight',
    'discountPrimed',
    'breach',
    'uiClick',
    'uiError',
] as const satisfies readonly SfxName[];

// Compile-time completeness check: the array above must cover the whole union.
type _AssertAllNames = SfxName extends (typeof ALL_SFX_NAMES)[number] ? true : never;
const _allNamesCovered: _AssertAllNames = true;
void _allNamesCovered;

export interface SfxOptions {
    /** 0..1 — e.g. damage as a fraction of max HP. Bigger = lower/longer/louder. */
    intensity?: number;
    /** Frequency multiplier for pitch-varied sounds (statusApply). Default 1. */
    pitch?: number;
}

export interface ToneOpts {
    freq: number;
    /** If set, the oscillator glides (exponentially) to this frequency. */
    endFreq?: number;
    type?: OscillatorType;
    /** Seconds after the recipe starts before this tone begins. */
    delay?: number;
    attack?: number;
    decay?: number;
    gain?: number;
}

export interface NoiseOpts {
    duration?: number;
    delay?: number;
    attack?: number;
    gain?: number;
    filterType?: BiquadFilterType;
    filterFreq?: number;
    /** If set, the filter sweeps (exponentially) to this frequency. */
    filterEndFreq?: number;
    q?: number;
}

export interface ArpOpts {
    /** Seconds between note starts. */
    step?: number;
    type?: OscillatorType;
    decay?: number;
    gain?: number;
    delay?: number;
}

/**
 * Abstract synthesis toolkit a recipe draws with. The engine provides a real
 * Web Audio implementation; tests can provide a recording stub.
 */
export interface SynthToolkit {
    /** Enveloped oscillator tone with optional pitch glide. */
    tone(opts: ToneOpts): void;
    /** Filtered white-noise burst (impacts, whooshes, glitches, crashes). */
    noise(opts: NoiseOpts): void;
    /** Quick sequence of short tones. */
    arp(freqs: number[], opts?: ArpOpts): void;
}

export type SfxRecipe = (s: SynthToolkit, opts: Required<SfxOptions>) => void;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const SFX_RECIPES: Record<SfxName, SfxRecipe> = {
    /** Short filtered whoosh + square blip — a program executing. */
    cardPlay: (s) => {
        s.noise({ duration: 0.09, filterType: 'bandpass', filterFreq: 850, filterEndFreq: 2600, q: 1.1, gain: 0.35 });
        s.tone({ freq: 640, endFreq: 900, type: 'square', attack: 0.004, decay: 0.07, gain: 0.1 });
    },

    /** Soft digital tick — a card sliding off the drawpile. */
    cardDraw: (s) => {
        s.tone({ freq: 1650, type: 'square', attack: 0.002, decay: 0.028, gain: 0.05 });
        s.tone({ freq: 2350, type: 'sine', delay: 0.014, attack: 0.002, decay: 0.024, gain: 0.045 });
    },

    /** Noise burst + low sine thump. Intensity (damage fraction) = lower/longer/louder. */
    hit: (s, o) => {
        const i = clamp01(o.intensity);
        s.noise({
            duration: 0.06 + i * 0.14,
            filterType: 'lowpass',
            filterFreq: 1700 - i * 950,
            gain: 0.28 + i * 0.4,
        });
        s.tone({
            freq: 160 - i * 55,
            endFreq: 42,
            type: 'sine',
            attack: 0.003,
            decay: 0.1 + i * 0.2,
            gain: 0.45 + i * 0.45,
        });
    },

    /** hit + inharmonic metallic ring overtones for the >=25%-max-HP slams. */
    hitCrit: (s, o) => {
        SFX_RECIPES.hit(s, { ...o, intensity: Math.max(0.7, clamp01(o.intensity)) });
        s.tone({ freq: 1244, type: 'square', attack: 0.002, decay: 0.26, gain: 0.07 });
        s.tone({ freq: 1867, type: 'triangle', delay: 0.012, attack: 0.002, decay: 0.32, gain: 0.06 });
    },

    /** Dull muted thud — the shield ate it. */
    absorbed: (s) => {
        s.noise({ duration: 0.09, filterType: 'lowpass', filterFreq: 320, gain: 0.4 });
        s.tone({ freq: 95, endFreq: 70, type: 'sine', attack: 0.004, decay: 0.09, gain: 0.35 });
    },

    /** Soft two-note rising sine — repair routine. */
    heal: (s) => {
        s.tone({ freq: 523.25, type: 'sine', attack: 0.01, decay: 0.14, gain: 0.16 });
        s.tone({ freq: 784, type: 'sine', delay: 0.09, attack: 0.01, decay: 0.2, gain: 0.16 });
    },

    /** Tiny glitch tick; pitch varied per status so stacks read differently. */
    statusApply: (s, o) => {
        const p = o.pitch;
        s.tone({ freq: 980 * p, endFreq: 560 * p, type: 'square', attack: 0.002, decay: 0.045, gain: 0.09 });
        s.noise({ duration: 0.03, filterType: 'highpass', filterFreq: 2600, gain: 0.08 });
    },

    /** Descending glitch sweep + noise crash — matches the CRT death FX. */
    death: (s) => {
        s.tone({ freq: 420, endFreq: 55, type: 'sawtooth', attack: 0.004, decay: 0.42, gain: 0.28 });
        s.tone({ freq: 640, endFreq: 90, type: 'square', delay: 0.05, attack: 0.003, decay: 0.3, gain: 0.12 });
        s.noise({ duration: 0.4, delay: 0.02, filterType: 'lowpass', filterFreq: 1600, filterEndFreq: 220, gain: 0.42 });
    },

    /** Bright 4-note ascending arpeggio — firmware upgraded. */
    levelUp: (s) => {
        s.arp([523.25, 659.25, 783.99, 1046.5], { step: 0.08, type: 'square', decay: 0.16, gain: 0.09 });
        s.tone({ freq: 1046.5, type: 'sine', delay: 0.32, attack: 0.01, decay: 0.3, gain: 0.1 });
    },

    /** Soft ready beep — your move. */
    turnPlayer: (s) => {
        s.tone({ freq: 880, type: 'sine', attack: 0.008, decay: 0.12, gain: 0.12 });
        s.tone({ freq: 1174.66, type: 'sine', delay: 0.07, attack: 0.006, decay: 0.1, gain: 0.07 });
    },

    /** Lower warning beep — hostile process scheduled. */
    turnEnemy: (s) => {
        s.tone({ freq: 311, type: 'square', attack: 0.008, decay: 0.14, gain: 0.09 });
        s.tone({ freq: 233, type: 'square', delay: 0.09, attack: 0.008, decay: 0.16, gain: 0.09 });
    },

    /** Short synthy major-arp fanfare — enemy processes terminated. */
    victory: (s) => {
        s.arp([523.25, 659.25, 783.99, 1046.5, 1318.5], { step: 0.09, type: 'sawtooth', decay: 0.18, gain: 0.07 });
        s.tone({ freq: 1046.5, type: 'sine', delay: 0.45, attack: 0.02, decay: 0.45, gain: 0.11 });
        s.tone({ freq: 1318.5, type: 'sine', delay: 0.45, attack: 0.02, decay: 0.45, gain: 0.08 });
    },

    /** Slow two-note descend — run terminated. */
    defeat: (s) => {
        s.tone({ freq: 311, endFreq: 294, type: 'sine', attack: 0.02, decay: 0.5, gain: 0.18 });
        s.tone({ freq: 196, endFreq: 185, type: 'sine', delay: 0.4, attack: 0.02, decay: 0.8, gain: 0.2 });
        s.noise({ duration: 0.7, delay: 0.35, filterType: 'lowpass', filterFreq: 420, gain: 0.1 });
    },

    /** Card-flip shimmer — decryption reveal. */
    reveal: (s) => {
        s.noise({ duration: 0.16, filterType: 'bandpass', filterFreq: 1400, filterEndFreq: 5200, q: 2.2, gain: 0.16 });
        s.arp([1318.5, 1760, 2349.3], { step: 0.045, type: 'sine', decay: 0.1, gain: 0.06 });
    },

    /** Positive confirmation blip — reward locked in. */
    rewardClaim: (s) => {
        s.tone({ freq: 880, type: 'square', attack: 0.003, decay: 0.06, gain: 0.09 });
        s.tone({ freq: 1318.5, type: 'square', delay: 0.06, attack: 0.003, decay: 0.11, gain: 0.09 });
    },

    /** Low minor pulse — DarkStance engaged. */
    stanceDark: (s) => {
        s.tone({ freq: 220, type: 'triangle', attack: 0.01, decay: 0.28, gain: 0.18 });
        s.tone({ freq: 261.63, type: 'triangle', delay: 0.02, attack: 0.01, decay: 0.26, gain: 0.12 });
    },

    /** High bright pulse — LightStance engaged. */
    stanceLight: (s) => {
        s.tone({ freq: 880, type: 'sine', attack: 0.008, decay: 0.24, gain: 0.13 });
        s.tone({ freq: 1108.73, type: 'sine', delay: 0.02, attack: 0.008, decay: 0.24, gain: 0.1 });
    },

    /** Subtle charge-up zap — a primed next-program discount (UNSTOPPABLE_MASS). */
    discountPrimed: (s) => {
        s.tone({ freq: 220, endFreq: 940, type: 'sawtooth', attack: 0.01, decay: 0.16, gain: 0.08 });
        s.noise({ duration: 0.12, filterType: 'bandpass', filterFreq: 700, filterEndFreq: 3200, q: 3, gain: 0.09 });
    },

    /** Dramatic unlock swell — FIREWALL BREACHED. */
    breach: (s) => {
        s.tone({ freq: 110, endFreq: 220, type: 'sawtooth', attack: 0.05, decay: 0.55, gain: 0.16 });
        s.noise({ duration: 0.6, filterType: 'lowpass', filterFreq: 300, filterEndFreq: 4200, gain: 0.14 });
        s.arp([440, 554.37, 659.25, 880], { delay: 0.28, step: 0.09, type: 'square', decay: 0.2, gain: 0.07 });
    },

    /** Micro tick for buttons/tabs. */
    uiClick: (s) => {
        s.tone({ freq: 2100, type: 'square', attack: 0.001, decay: 0.018, gain: 0.05 });
    },

    /** Short buzz for blocked actions — two detuned low squares beating. */
    uiError: (s) => {
        s.tone({ freq: 156, type: 'square', attack: 0.004, decay: 0.13, gain: 0.08 });
        s.tone({ freq: 164, type: 'square', attack: 0.004, decay: 0.13, gain: 0.08 });
    },
};
