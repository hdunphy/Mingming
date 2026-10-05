/**
 * ELEMENT TRAILS — ticket 146d.
 *
 * Ruling 4: *"One trail shape per element, with that element's particle. Water drop, flame, leaf."*
 *
 * Three authored shapes, one neutral streak, and a tinted slot for the five elements that have no
 * shape yet. Each authored one is a PATH — a function from progress to position — plus what it
 * sheds along the way, because the three differences Henry named are differences in how a thing
 * MOVES across the board, not in its colour:
 *
 *   Fire   an arc that flares      — rises off the straight line, sheds embers that rise
 *   Water  a lash that ripples     — sine along its own length, sheds drops that fall
 *   Nature a vine that curls       — a tightening spiral, sheds leaves that drift
 *   None   a plain streak          — the straight line, sheds nothing
 *
 * # WHY THE FIVE OTHERS ARE A SLOT AND NOT A DEBT
 *
 * §2d: *"Earth / Ice / Air / Light / Dark: the plain streak tinted in the element colour — none yet
 * — **slot**"*. A tinted streak is a complete, correct effect for an element whose shape has not
 * been designed; it reads, it is the right colour, and it is obviously the same family as the other
 * four. Authoring a fifth shape nobody has ruled on would be inventing design, which is not this
 * row's job.
 *
 * # COLOURS COME FROM `tokens.css`
 *
 * §2d says so, and it matters: the element colours are already the ones the type chart, the plaque
 * chips and the card frames use, so a Fire trail is the same red the player has been taught means
 * Fire. Read from the stylesheet at call time rather than duplicated here, with the token values as
 * the fallback for a headless render.
 */

import type { ParticleSeed } from './particles';
import type { EmitAt } from './emit';

export type TrailElement =
    | 'Fire' | 'Water' | 'Nature' | 'None'
    | 'Earth' | 'Ice' | 'Air' | 'Light' | 'Dark';

/** §2c: the trail crosses the board in 220ms. */
export const TRAIL_MS = 220;
/** §2c: a Side or All card sends one trail per target, this far apart. */
export const TRAIL_STAGGER_MS = 40;

export interface Rgb { r: number; g: number; b: number }

/**
 * `tokens.css`'s `--el-*`, as numbers.
 *
 * Duplicated as a fallback rather than as the source: `elementColor` reads the live custom property
 * first, so a re-themed stylesheet moves the trails with it. These values are what a headless
 * render (the capture harness, a test) gets, and they are the token values at the time this was
 * written — if they drift, the fallback is wrong in a test and right in the game, which is the
 * failure direction worth having.
 */
const TOKEN_FALLBACK: Record<TrailElement, Rgb> = {
    Fire: { r: 224, g: 93, b: 67 },
    Water: { r: 61, g: 155, b: 224 },
    Nature: { r: 67, g: 180, b: 95 },
    Earth: { r: 176, g: 128, b: 64 },
    Air: { r: 143, g: 199, b: 245 },
    Ice: { r: 127, g: 214, b: 255 },
    Light: { r: 232, g: 210, b: 122 },
    Dark: { r: 154, g: 111, b: 208 },
    None: { r: 154, g: 163, b: 173 },
};

const hexToRgb = (hex: string): Rgb | null => {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

export function elementColor(element: TrailElement): Rgb {
    if (typeof window !== 'undefined' && typeof getComputedStyle === 'function') {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(`--el-${element.toLowerCase()}`);
        const parsed = raw ? hexToRgb(raw) : null;
        if (parsed) return parsed;
    }
    return TOKEN_FALLBACK[element] ?? TOKEN_FALLBACK.None;
}

/** The centre of an anchor — a slot rect, or a bare point. */
const centre = (at: EmitAt): { x: number; y: number } => ({
    x: at.w ? at.x + at.w / 2 : at.x,
    y: at.h ? at.y + at.h / 2 : at.y,
});

/**
 * THE FOUR PATHS.
 *
 * Each takes the straight line from caster to target and deforms it. Working from the straight line
 * rather than from absolute coordinates is what makes them work in every direction — the board has
 * allies on the left and enemies on the right, and a Side card fires at three targets at three
 * different angles. `nx, ny` is the unit vector along the shot and `px, py` is perpendicular to it,
 * so "rises off the line" and "ripples across it" mean the same thing whichever way it is pointing.
 */
function pathFor(
    element: TrailElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
): (t: number) => { x: number; y: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    // Perpendicular, always pointing "up-ish" so an arc bends over the board rather than into it.
    const px = ny > 0 ? ny : -ny;
    const py = ny > 0 ? -nx : nx;

    const straight = (t: number) => ({ x: from.x + dx * t, y: from.y + dy * t });

    switch (element) {
        case 'Fire':
            /*
             * AN ARC THAT FLARES. A single hump, peaking at the middle, scaled to the shot's own
             * length so a point-blank cast does not loop over the whole board. `sin(pi t)` rather
             * than a parabola because it leaves and arrives flat — a trail that departs at a steep
             * angle reads as a mortar rather than as fire thrown at someone.
             */
            return (t) => {
                const base = straight(t);
                const lift = Math.sin(Math.PI * t) * Math.min(len * 0.22, 70);
                return { x: base.x + px * lift, y: base.y + py * lift };
            };

        case 'Water':
            /*
             * A LASH THAT RIPPLES — §2d's *"sine along its length"*. Three crossings, damped to
             * nothing at both ends so the head leaves and lands on the line rather than off it.
             * Damping is the difference between a whip and a wobble.
             */
            return (t) => {
                const base = straight(t);
                const damp = Math.sin(Math.PI * t);
                const wave = Math.sin(t * Math.PI * 3) * damp * Math.min(len * 0.14, 34);
                return { x: base.x + px * wave, y: base.y + py * wave };
            };

        case 'Nature':
            /*
             * A VINE THAT CURLS AS IT GROWS. A spiral whose radius TIGHTENS with progress: wide,
             * loose turns near the caster, closing to nothing at the target. Growing the other way
             * (tight to wide) reads as something unravelling, which is the opposite of a vine
             * reaching for a thing.
             */
            return (t) => {
                const base = straight(t);
                const radius = (1 - t) * Math.min(len * 0.16, 40);
                const angle = t * Math.PI * 3.2;
                return {
                    x: base.x + px * Math.sin(angle) * radius,
                    /*
                     * `1 - cos` and not `cos`, which is the version this shipped with for about
                     * five minutes. `cos(0)` is 1, so the raw cosine put the vine 14px off the
                     * caster at t=0 — invisible in any single frame, and it would have meant every
                     * Nature card in the game left from slightly beside the unit that cast it. The
                     * test in `castSequence.test.ts` caught it, which is the entire reason that
                     * test asserts both endpoints rather than just the shape.
                     */
                    y: base.y + py * Math.sin(angle) * radius + (1 - Math.cos(angle)) * radius * 0.35,
                };
            };

        default:
            // None, and the five tinted slots. A straight line is not a placeholder — it is the
            // right shape for a hit that has no element behind it.
            return straight;
    }
}

/** What each element sheds behind its head, and how the impact reads. Ruling 4's three particles. */
interface TrailStyle {
    readonly shed: ParticleSeed['trail'] | null;
    /** The burst at the far end. */
    readonly impact: { kind: 'flame' | 'drop' | 'leaf' | 'puff'; count: number; gravity?: number };
}

function styleFor(element: TrailElement, color: Rgb): TrailStyle {
    switch (element) {
        case 'Fire':
            // Embers RISE off the trail — negative gravity — because fire's exhaust goes up and
            // everything else's goes down. It is the cheapest way to tell the three apart in
            // motion, which is how a player reads them at speed.
            return {
                shed: { kind: 'flame', every: 26, color, gravity: -90, size: 3.4 },
                impact: { kind: 'flame', count: 7, gravity: -60 },
            };
        case 'Water':
            // §2d: *"drops fall with gravity, splash on the floor line"*. The fall is the read.
            return {
                shed: { kind: 'drop', every: 24, color, gravity: 620, size: 2.6 },
                impact: { kind: 'drop', count: 9, gravity: 620 },
            };
        case 'Nature':
            // Leaves tumble and DRIFT: almost no gravity, so they hang and settle rather than drop.
            return {
                shed: { kind: 'leaf', every: 34, color, gravity: 40, size: 3.2 },
                impact: { kind: 'leaf', count: 8, gravity: 40 },
            };
        case 'None':
            // §2d: no particles behind it, a grey puff at the end. The absence is the design —
            // a neutral hit should read as plainer than an elemental one.
            return { shed: null, impact: { kind: 'puff', count: 5 } };
        default:
            // The tinted slots: no shed particles yet, a puff in the element's own colour.
            return { shed: null, impact: { kind: 'puff', count: 5 } };
    }
}

/**
 * The trail head itself: one `streak` particle following the element's path, shedding as it goes.
 *
 * Its life IS the travel time (`TRAIL_MS`, or the length 190c's plan gives it), so the life and the path's progress are the same clock and the
 * head cannot arrive early or linger past the impact it is supposed to cause.
 */
export function trailSeed(element: TrailElement, from: EmitAt, to: EmitAt, lifeMs: number = TRAIL_MS): ParticleSeed {
    const a = centre(from);
    const b = centre(to);
    const color = elementColor(element);
    const style = styleFor(element, color);

    return {
        x: a.x, y: a.y,
        // Ignored — `path` owns the motion — but a seed without them is a seed with holes in it,
        // and the direction is the honest value for anything that reads velocity (the `streak`
        // shape takes its length from speed).
        vx: (b.x - a.x) / (lifeMs / 1000),
        vy: (b.y - a.y) / (lifeMs / 1000),
        // Ticket 190c: the head crosses in as long as the plan's travel (it grows with the damage).
        life: lifeMs,
        size: 3.2,
        r: Math.min(255, color.r + 60), g: Math.min(255, color.g + 60), b: Math.min(255, color.b + 60),
        r2: color.r, g2: color.g, b2: color.b,
        a: 1,
        shape: 'streak',
        path: pathFor(element, a, b),
        trail: style.shed ?? undefined,
    };
}

/** The burst at the far end. §2d's impact column, one call. */
export function impactFor(element: TrailElement): {
    kind: 'flame' | 'drop' | 'leaf' | 'puff'; count: number; color: Rgb; gravity?: number;
} {
    const color = elementColor(element);
    const { impact } = styleFor(element, color);
    return { ...impact, color };
}
