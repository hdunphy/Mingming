/**
 * TICKET 190d — the small maths the element attacks share: easings, bezier points and the
 * inverse of the in-out ease (to ask "when has the wall reached this body?"). Ported from the
 * Battle Juice Lab's helpers; pure, so every effect is testable without a canvas.
 */

export interface Point { readonly x: number; readonly y: number }

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const outQuad = (t: number): number => 1 - (1 - t) * (1 - t);
export const inQuad = (t: number): number => t * t;
export const outCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const inOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** The t that `inOut` maps to `q` (0..1), by bisection. */
export function invInOut(q: number): number {
    const target = clamp(q, 0, 1);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i += 1) {
        const mid = (lo + hi) / 2;
        if (inOut(mid) < target) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

export function bez2(a: Point, b: Point, c: Point, u: number): Point {
    const m = 1 - u;
    return { x: m * m * a.x + 2 * m * u * b.x + u * u * c.x, y: m * m * a.y + 2 * m * u * b.y + u * u * c.y };
}

export function bez3(a: Point, b: Point, c: Point, d: Point, u: number): Point {
    const m = 1 - u;
    return {
        x: m * m * m * a.x + 3 * m * m * u * b.x + 3 * m * u * u * c.x + u * u * u * d.x,
        y: m * m * m * a.y + 3 * m * m * u * b.y + 3 * m * u * u * c.y + u * u * u * d.y,
    };
}

/** `rand(a, b)` over an injected generator, so a test can be deterministic. */
export const randomIn = (rng: () => number) => (a: number, b: number): number => a + rng() * (b - a);
