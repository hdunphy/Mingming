/**
 * TICKET 190f - WHAT THE SPRITE DOES when a status lands, as keys the sprite plays on its art:
 *
 *   dull    Poison    the colour drains for a moment
 *   wobble  Dazed     the body rocks side to side
 *   slump   Weakened  it sinks and greys
 *   pump    Strengthened  it swells and settles
 *
 * Each is one short animation (200-900 ms) that ends exactly where it began. Pure data; the sprite
 * holds it to the battle clock so a freeze holds it.
 */

export type ReactionKind = 'dull' | 'wobble' | 'slump' | 'pump';

export interface ReactionKeys {
    readonly durationMs: number;
    /** 0..1 along the duration, one per value. */
    readonly times: readonly number[];
    readonly values: {
        readonly y?: readonly number[];
        readonly rotate?: readonly number[];
        readonly scaleX?: readonly number[];
        readonly scaleY?: readonly number[];
        readonly filter?: readonly string[];
    };
}

const NORMAL = 'brightness(1) saturate(1)';

export function reactionKeys(kind: ReactionKind): ReactionKeys {
    switch (kind) {
        case 'dull':
            return {
                durationMs: 520, times: [0, 0.3, 0.7, 1],
                values: { filter: [NORMAL, 'brightness(0.82) saturate(0.45)', 'brightness(0.82) saturate(0.45)', NORMAL] },
            };
        case 'wobble':
            return {
                durationMs: 640, times: [0, 0.15, 0.35, 0.55, 0.75, 1],
                values: { rotate: [0, -7, 7, -5, 3, 0] },
            };
        case 'slump':
            return {
                durationMs: 760, times: [0, 0.3, 0.7, 1],
                values: {
                    y: [0, 7, 7, 0],
                    scaleX: [1, 1.04, 1.04, 1],
                    scaleY: [1, 0.93, 0.93, 1],
                    filter: [NORMAL, 'brightness(0.85) saturate(0.35)', 'brightness(0.85) saturate(0.35)', NORMAL],
                },
            };
        case 'pump':
            return {
                durationMs: 460, times: [0, 0.35, 0.65, 1],
                values: {
                    y: [0, -5, -2, 0],
                    scaleX: [1, 1.12, 1.07, 1],
                    scaleY: [1, 1.12, 1.07, 1],
                },
            };
    }
}

/**
 * TICKET 194k-5 - THE BODY GLOW every status landing adds: the sprite glows in the status colour for
 * 450 ms, as the lab's does (`u.glow = S.rgb; play(450, ...)`). A `drop-shadow` filter, so it follows
 * the art's own outline rather than its box. It is a separate signal from the reactions above
 * because a landing can have both (Poison dulls AND glows purple), and two animations never share
 * one element's filter: the glow plays on its own wrapper.
 */
export const GLOW_MS = 450;

export interface GlowKeys {
    readonly durationMs: number;
    readonly times: readonly number[];
    readonly filter: readonly string[];
}

export function glowKeys(rgb: { readonly r: number; readonly g: number; readonly b: number }): GlowKeys {
    const at = (alpha: number): string => `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    const shadow = (blur: number, wide: number, alpha: number): string =>
        `drop-shadow(0 0 ${blur}px ${at(alpha)}) drop-shadow(0 0 ${wide}px ${at(alpha)})`;
    return {
        durationMs: GLOW_MS,
        times: [0, 0.15, 1],
        // Same shape at both ends, so the glow starts and ends at nothing.
        filter: [shadow(0, 0, 0), shadow(8, 22, 0.95), shadow(0, 0, 0)],
    };
}
