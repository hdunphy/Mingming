/**
 * THE FAN — ticket 145d §2c, and every number is the mock's.
 *
 * The mock draws five cards at `rotate(-12|-6|0|6|12)deg` with `translateY(0|-10|-18|-10|0)px` and
 * `margin-left: -18px` on all but the first. The centre card is the HIGHEST — an arch, not a dip —
 * and that is the shape a hand is read along.
 *
 * # WHY THE LIFT IS A FITTED CURVE RATHER THAN A LOOKUP
 *
 * A five-card table would be exact and useless: a hand is 3 to 8 cards and the shape has to hold at
 * every size. So the lift is the quadratic through the mock's own three points — at `t = |offset| /
 * half`, `lift(0) = 18`, `lift(0.5) = 10`, `lift(1) = 0` gives `18 − 14t − 4t²` exactly. It
 * reproduces the mock at five cards to the pixel and degrades smoothly either side of it, which a
 * table cannot. `fanGeometry.test.ts` pins the five-card case against the mock's literal numbers.
 *
 * # WHY THE ANGLE NARROWS AS THE HAND GROWS
 *
 * §2c: "±12° at five, flattening toward ±8° at eight with overlap tightening to −30px, so the hand
 * stays inside the pile-to-pile width". Both dials move for one reason — a wider hand at a fixed
 * angle and a fixed overlap runs into the draw and discard piles, and a fan that overlaps its own
 * piles reads as a bug. Flattening the arch and tightening the overlap buys the width back without
 * shrinking the cards, which is the thing that must not happen: the card face is where the numbers
 * are.
 */

/** The card face in the fan. The reveal lane's card is bigger (148×196) — see `stageGeometry`. */
export const FAN_CARD_W = 140;
export const FAN_CARD_H = 176;

/** The hand size the mock draws, and the anchor every constant below is stated at. */
export const FAN_REFERENCE_HAND = 5;

/** Outermost rotation at the reference hand, in degrees. */
export const FAN_MAX_ANGLE = 12;
/** Outermost rotation at `FAN_WIDE_HAND`, where the fan is at its flattest. */
export const FAN_MIN_ANGLE = 8;
/** The hand size at which the angle and the overlap reach their far ends. */
export const FAN_WIDE_HAND = 8;

/** Overlap at the reference hand (negative: cards sit on each other). */
export const FAN_OVERLAP = -18;
/** Overlap at `FAN_WIDE_HAND`. */
export const FAN_TIGHT_OVERLAP = -30;

/** Lift of the centre card. The edges sit at 0 — the arch is measured from the baseline up. */
export const FAN_MAX_LIFT = 18;

/** `transform-origin`, per §2c. Below the card, so a rotation swings the top rather than the foot. */
export const FAN_TRANSFORM_ORIGIN = '50% 130%';

/** How far a card lifts on selection, ON TOP of its place in the arch. */
export const FAN_SELECTED_LIFT = 10;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));

/** Where a hand of `size` sits between the reference fan and the widest one. */
const widthT = (size: number): number =>
    (size - FAN_REFERENCE_HAND) / (FAN_WIDE_HAND - FAN_REFERENCE_HAND);

/** Outermost rotation for a hand of `size`, in degrees. */
export const fanMaxAngle = (size: number): number =>
    lerp(FAN_MAX_ANGLE, FAN_MIN_ANGLE, widthT(size));

/** Card-to-card overlap for a hand of `size`, in px (negative). */
export const fanOverlap = (size: number): number =>
    lerp(FAN_OVERLAP, FAN_TIGHT_OVERLAP, widthT(size));

export interface FanCard {
    /** Degrees, negative on the left. */
    readonly rotation: number;
    /** Pixels UP from the baseline — apply as `translateY(-lift)`. */
    readonly lift: number;
    /** `margin-left`, which is 0 on the first card and the overlap on every other. */
    readonly overlap: number;
}

/**
 * One card's place in the fan.
 *
 * A one-card hand is flat and unlifted rather than a degenerate arch: with `half = 0` every ratio
 * below is 0/0, and a single card tilted 12° for no reason is the kind of detail that reads as a
 * rendering fault.
 */
export function fanCard(index: number, size: number): FanCard {
    const overlap = index === 0 ? 0 : fanOverlap(size);
    if (size <= 1) return { rotation: 0, lift: 0, overlap };

    const half = (size - 1) / 2;
    const offset = index - half;
    const maxAngle = fanMaxAngle(size);

    // Evenly spaced across the full spread: at five cards the step is 24/4 = 6, which is the mock's
    // -12/-6/0/6/12 exactly.
    const rotation = (offset / half) * maxAngle;

    // The quadratic through the mock's (0, 18), (0.5, 10), (1, 0).
    const t = Math.abs(offset) / half;
    const lift = FAN_MAX_LIFT - 14 * t - 4 * t * t;

    return { rotation, lift, overlap };
}
