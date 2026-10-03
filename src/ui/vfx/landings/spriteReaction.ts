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
