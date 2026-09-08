/**
 * TICKET 145a — THE STAGGER STAGE, AS ARITHMETIC.
 *
 * Every number here is read off `docs/wayfinder/deck-archetypes/tickets/145-mock/145-mock.html`,
 * which the ticket names as the spec: *"where this text and the mock disagree, the mock wins."* The
 * mock positions its sprites absolutely on a 1280x800 frame, so these are FRAME coordinates at that
 * reference size, and `stageScale()` is the only thing that turns them into pixels for a real
 * viewport.
 *
 * WHY A MODULE RATHER THAN NUMBERS IN THE COMPONENT. Ticket 145 §3 makes the slot rectangles a
 * published interface: `useStageAnchors()` hands them to ticket 146, which fires particles and
 * hit-stop at them, and 146's whole design assumes a slot does not move on selection, death, or
 * hand size. A layout that lives in JSX cannot be asserted against or reused; this can, and
 * `stageGeometry.test.ts` holds it to the mock's numbers directly.
 */

/** The frame the mock was drawn at. Everything below is in these coordinates. */
export const REF_WIDTH = 1280;
export const REF_HEIGHT = 800;

/** The three bands, in reference pixels. `44 + 546 + 210 = 800`. */
export const TOP_BAR_H = 44;
export const STAGE_H = 546;
export const CONSOLE_H = 210;
/** Frame y of the stage band's top edge. */
export const STAGE_TOP = TOP_BAR_H;

/** Row pitch. The ticket names it in §2b and again in the 1920 rule, so it is a constant, not a gap. */
export const ROW_PITCH = 170;

/** Sprite box at the reference size. */
export const SPRITE_W = 150;
export const SPRITE_H = 120;

/**
 * The largest a sprite may be drawn, per §4.1's 1920 rule. It bites before the width scale does:
 * 150 x (1920/1280) is 225, so a 1920 stage draws 190 and the columns spread further than the
 * sprites grow. That is the intent — the stagger is a COMPOSITION, and letting the sprites track
 * the width would close the reveal lane it is built around.
 */
export const SPRITE_MAX_W = 190;

export const PLAQUE_W = 168;
/** A plaque's top, relative to its sprite's top. Read off the mock: 110 - 62 = 48. */
export const PLAQUE_DY = 48;

/**
 * How far the ACTIVE ally steps toward the centre. §2b: "the active ally's slot is its column x
 * + 60; the others stay."
 */
export const ACTIVE_STEP = 60;

export type StageSide = 'ally' | 'enemy';

/** A rectangle in frame coordinates. */
export interface StageRect {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

/**
 * The column each side rests at, and the direction "toward the centre" points.
 *
 * ENEMIES DO NOT STEP, and the mock's enemy-1 x of 790 is not a step — it is where that slot IS.
 * §2b says "Enemies never step" and the same paragraph's table puts enemy 1 at 790 and enemies 2/3
 * at 850, so the front enemy slot is 60px closer to the centre as a fixed part of the composition
 * and stays there whoever is acting. Both statements are true at once only under that reading, and
 * it is the one the mock draws. If Henry meant the enemy column to be flat at 850, `ENEMY_FRONT_STEP`
 * is the one number to change.
 */
const ALLY_COLUMN_X = 270;
const ENEMY_COLUMN_X = 850;
const ENEMY_FRONT_STEP = 60;

/** Frame y of row `index`'s sprite box, before scaling. Mock: 62, 232, 402. */
export const rowY = (index: number): number => 62 + index * ROW_PITCH;

/**
 * The sprite box for one slot, in reference coordinates.
 *
 * `activeIndex` is the ally whose turn it is; pass `-1` (or an enemy side) for no step. Only the x
 * moves, and only for an ally — §3 requires that a slot is otherwise stable across selection,
 * death and hand size, because 146 caches these.
 */
export function spriteRect(side: StageSide, index: number, activeIndex = -1): StageRect {
    const y = rowY(index);
    if (side === 'ally') {
        const stepped = index === activeIndex ? ACTIVE_STEP : 0;
        return { x: ALLY_COLUMN_X + stepped, y, w: SPRITE_W, h: SPRITE_H };
    }
    const stepped = index === 0 ? ENEMY_FRONT_STEP : 0;
    return { x: ENEMY_COLUMN_X - stepped, y, w: SPRITE_W, h: SPRITE_H };
}

/**
 * The plaque for one slot — always on the OUTSIDE of its column, which is the rule that keeps the
 * middle of the screen clear for the reveal lane. An ally's plaque sits to the LEFT of its sprite
 * and an enemy's to the RIGHT, so neither ever crosses the lane however far a sprite steps.
 */
export function plaqueRect(side: StageSide, index: number, activeIndex = -1): StageRect {
    const sprite = spriteRect(side, index, activeIndex);
    const x = side === 'ally' ? sprite.x - PLAQUE_W - 8 : sprite.x + sprite.w + 8;
    return { x, y: sprite.y + PLAQUE_DY, w: PLAQUE_W, h: 0 };
}

/**
 * The reveal lane — where `PlayedCardReveal` holds the card that just resolved. §2b: 148x196 at
 * (566, 118), rotated -4deg. The lane is ~300px of gap between the two columns and it is empty
 * between plays ON PURPOSE (`final-between-plays.png`); it is where the play happens.
 */
export const REVEAL_RECT: StageRect = { x: 566, y: 118, w: 148, h: 196 };
export const REVEAL_ROTATION_DEG = -4;

/** The fan's centre, in the console band. Anchors only — the console owns its own layout. */
export const HAND_ANCHOR: StageRect = {
    x: REF_WIDTH / 2 - 70,
    y: STAGE_TOP + STAGE_H + 20,
    w: 140,
    h: 176,
};

/**
 * How the reference composition maps onto a real viewport.
 *
 * UNIFORM, and clamped so it can only shrink the composition, never stretch it out of proportion.
 * §4.1 asks for "column x's proportionally, the 170px pitch, sprites capped at 190" — a uniform
 * scale is the shape that delivers all three at once, because the pitch and the columns then move
 * together and only the cap breaks ranks. Scaling x alone was tried on paper and rejected: at
 * 1920x1080 it leaves the three rows in the top 460px of an 826px band with a third of the stage
 * empty under them.
 *
 * At exactly 1280x800 this returns 1 and the layout IS the mock, pixel for pixel. That property is
 * what `stageGeometry.test.ts` pins, and it is the reason to scale rather than to re-lay-out.
 */
export function stageScale(viewportWidth: number, viewportHeight: number): number {
    const bandHeight = Math.max(0, viewportHeight - TOP_BAR_H - CONSOLE_H);
    return Math.min(viewportWidth / REF_WIDTH, bandHeight / STAGE_H);
}

/** The drawn width of a sprite at `scale`, with §4.1's cap applied. */
export const spriteWidthAt = (scale: number): number => Math.min(SPRITE_W * scale, SPRITE_MAX_W);

/**
 * A reference rect placed on a real viewport.
 *
 * The scaled composition is CENTRED horizontally in the viewport rather than pinned left, so a
 * window wider than 1.463:1 (where the band height binds first) grows its margins evenly instead of
 * pushing the whole stage against one edge.
 */
export function place(rect: StageRect, viewportWidth: number, viewportHeight: number): StageRect {
    const scale = stageScale(viewportWidth, viewportHeight);
    const offsetX = (viewportWidth - REF_WIDTH * scale) / 2;
    const bandHeight = Math.max(0, viewportHeight - TOP_BAR_H - CONSOLE_H);
    const offsetY = TOP_BAR_H + (bandHeight - STAGE_H * scale) / 2 - STAGE_TOP * scale;
    return {
        x: offsetX + rect.x * scale,
        y: offsetY + rect.y * scale,
        w: rect.w * scale,
        h: rect.h * scale,
    };
}
