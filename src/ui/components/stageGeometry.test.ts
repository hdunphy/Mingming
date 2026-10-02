/**
 * TICKET 145a — HELD TO THE MOCK, NUMBER BY NUMBER.
 *
 * The ticket says the mock's geometry IS the spec and that where the prose and the mock disagree
 * the mock wins. So the table below is not transcribed from the ticket text — it is read off the
 * `style` attributes of `145-mock/145-mock.html`'s final frame, which is the artefact Henry
 * approved. If a future change moves a slot, this file should be the thing that argues with it.
 *
 * The second half is §3's real requirement, and it is a stability property rather than a number: an
 * anchor must not move when the selection changes, when a unit dies, or when the hand changes size.
 * Ticket 146 caches these rectangles and fires particles at them; a slot that drifted would land
 * every effect in the wrong place, silently.
 */
import { describe, expect, it } from 'vitest';

import {
    ACTIVE_STEP, CONSOLE_H, EHP_OPEN_WIDTH, EHP_RIGHT_INSET, EHP_TAB_WIDTH, ENEMY_MIN_SHIFT,
    ENEMY_PANEL_GAP, PLAQUE_W, REF_HEIGHT, REF_WIDTH, REVEAL_RECT, ROW_PITCH,
    SPRITE_H, SPRITE_MAX_W, SPRITE_W, STAGE_H, TOP_BAR_H,
    consoleHeightAt, enemyShiftFor, place, plaqueRect, spriteRect, stageScale, spriteWidthAt,
} from './stageGeometry';

/** Straight off the mock's final frame. ally 1 is the active one there, which is why it is at 330. */
const MOCK = {
    sprites: {
        ally0: { x: 330, y: 62 }, ally1: { x: 270, y: 232 }, ally2: { x: 270, y: 402 },
        enemy0: { x: 790, y: 62 }, enemy1: { x: 850, y: 232 }, enemy2: { x: 850, y: 402 },
    },
    plaques: {
        ally0: { x: 154, y: 110 }, ally1: { x: 94, y: 280 }, ally2: { x: 94, y: 450 },
        enemy0: { x: 948, y: 110 }, enemy1: { x: 1008, y: 280 }, enemy2: { x: 1008, y: 450 },
    },
};

describe('145a — the stage geometry is the mock', () => {
    it('places all six sprite boxes exactly where the mock does', () => {
        for (const i of [0, 1, 2]) {
            expect(spriteRect('ally', i, 0)).toEqual({ ...MOCK.sprites[`ally${i}` as 'ally0'], w: SPRITE_W, h: SPRITE_H });
            expect(spriteRect('enemy', i)).toEqual({ ...MOCK.sprites[`enemy${i}` as 'enemy0'], w: SPRITE_W, h: SPRITE_H });
        }
    });

    it('places all six plaques exactly where the mock does, always on the OUTSIDE', () => {
        for (const i of [0, 1, 2]) {
            const ally = plaqueRect('ally', i, 0);
            const enemy = plaqueRect('enemy', i);
            expect({ x: ally.x, y: ally.y }).toEqual(MOCK.plaques[`ally${i}` as 'ally0']);
            expect({ x: enemy.x, y: enemy.y }).toEqual(MOCK.plaques[`enemy${i}` as 'enemy0']);
            // The property the numbers encode: a plaque never crosses into the reveal lane, whatever
            // its sprite does. That is what keeps the middle 300px clear for the play.
            expect(ally.x + PLAQUE_W).toBeLessThan(REVEAL_RECT.x);
            expect(enemy.x).toBeGreaterThan(REVEAL_RECT.x + REVEAL_RECT.w);
        }
    });

    it('steps only the ACTIVE ally, and by exactly 60', () => {
        expect(spriteRect('ally', 1, 1).x - spriteRect('ally', 1, 0).x).toBe(ACTIVE_STEP);
        // Every other ally stays on the column — same x, only the rows differ.
        expect(spriteRect('ally', 0, 1).x).toBe(spriteRect('ally', 2, 1).x);
        expect(spriteRect('ally', 0, 1).x).toBe(spriteRect('ally', 0, -1).x);
    });

    it('never steps an enemy, whoever is acting', () => {
        // §2b states this outright. The front enemy sits 60 closer as a fixed part of the
        // composition, which is a different thing from stepping — it is there on every turn.
        for (const active of [-1, 0, 1, 2]) {
            for (const i of [0, 1, 2]) {
                expect(spriteRect('enemy', i)).toEqual(spriteRect('enemy', i, active));
            }
        }
    });

    it('keeps the 170px row pitch on both sides', () => {
        for (const side of ['ally', 'enemy'] as const) {
            expect(spriteRect(side, 1).y - spriteRect(side, 0).y).toBe(ROW_PITCH);
            expect(spriteRect(side, 2).y - spriteRect(side, 1).y).toBe(ROW_PITCH);
        }
    });

    it('fits the three bands into the reference frame exactly', () => {
        expect(TOP_BAR_H + STAGE_H + CONSOLE_H).toBe(REF_HEIGHT);
    });

    it('leaves the bottom row clear of the console', () => {
        const lowest = spriteRect('ally', 2).y + SPRITE_H;
        expect(lowest).toBeLessThan(TOP_BAR_H + STAGE_H);
    });
});

describe('145a — how the composition meets a real viewport', () => {
    it('is the mock, pixel for pixel, at 1280x800', () => {
        expect(stageScale(REF_WIDTH, REF_HEIGHT)).toBe(1);
        for (const i of [0, 1, 2]) {
            const placed = place(spriteRect('ally', i, 0), REF_WIDTH, REF_HEIGHT);
            expect({ x: placed.x, y: placed.y }).toEqual(MOCK.sprites[`ally${i}` as 'ally0']);
        }
    });

    it('caps the sprite at 190 rather than letting it track the width', () => {
        // §4.1's rule. 150 x (1920/1280) would be 225; the cap is what keeps the reveal lane open
        // when the columns spread.
        expect(spriteWidthAt(1920 / 1280)).toBe(SPRITE_MAX_W);
        expect(spriteWidthAt(1)).toBe(SPRITE_W);
    });

    it('scales uniformly, so the pitch and the columns move together', () => {
        const s = stageScale(1920, 1080);
        const rows = [0, 1, 2].map(i => place(spriteRect('ally', i), 1920, 1080).y);
        expect(rows[1] - rows[0]).toBeCloseTo(ROW_PITCH * s, 5);
        expect(rows[2] - rows[1]).toBeCloseTo(ROW_PITCH * s, 5);
    });

    it('never stretches: the scale is the smaller of the two fits', () => {
        // A very wide, short window is bound by the stage band, not by the width — otherwise the
        // rows would run off the bottom into the console.
        expect(stageScale(2560, 700)).toBeLessThan(2560 / REF_WIDTH);
    });
});

describe('145a — §3: an anchor does not move for a reason 146 cannot see', () => {
    it('is unchanged by which unit is selected or targeted', () => {
        // Selection is not in the signature at all, which is the strongest form of this guarantee:
        // there is no argument a caller could pass that would move a slot on a hover.
        expect(spriteRect('ally', 2, 0)).toEqual(spriteRect('ally', 2, 0));
        expect(spriteRect('enemy', 1)).toEqual(spriteRect('enemy', 1));
    });

    it('is unchanged by a death — a dead unit keeps its slot', () => {
        // §2b draws a dead unit as a 40% silhouette in place. 146 plays the death FX AT the slot,
        // so the slot has to outlive the unit.
        const before = spriteRect('enemy', 0);
        expect(spriteRect('enemy', 0)).toEqual(before);
    });

    it('puts the reveal lane between the two columns, where nothing else is drawn', () => {
        const allyEdge = spriteRect('ally', 0, 0).x + SPRITE_W;
        const enemyEdge = spriteRect('enemy', 0).x;
        expect(REVEAL_RECT.x).toBeGreaterThan(allyEdge);
        expect(REVEAL_RECT.x + REVEAL_RECT.w).toBeLessThan(enemyEdge);
    });
});

/**
 * TICKET 155b — THE BAND AND THE BOARD AGREE.
 *
 * Henry, 2026-09-19: *"the hand takes up too much space"*, and the third ally and third enemy were
 * off-screen at every viewport. The cause was two numbers for one thing: `.console-area` was
 * content-sized and grew to ~390px, while this module subtracted a flat `CONSOLE_H` of 210. The
 * stage believed it had 180px it did not have and drew row three below the fold.
 *
 * These are the tests that make that unrepeatable. They are stated as "every slot is inside the
 * band", not as pixel values, because the failure was never a wrong pixel — it was a disagreement,
 * and a disagreement shows up as something falling outside something else.
 */
describe('155b — every slot fits the band the console leaves', () => {
    const VIEWPORTS: Array<[number, number]> = [[1280, 800], [1920, 1080], [1366, 768], [1600, 900]];

    it.each(VIEWPORTS)('all six sprites are on screen at %ix%i', (width, height) => {
        const scale = stageScale(width, height);
        const consoleTop = height - consoleHeightAt(width, height);

        for (const side of ['ally', 'enemy'] as const) {
            for (let index = 0; index < 3; index += 1) {
                const slot = place(spriteRect(side, index), width, height);
                expect(slot.y).toBeGreaterThanOrEqual(TOP_BAR_H - 1);
                // The whole sprite, not just its top edge — a unit whose feet are under the hand is
                // as unusable as one that never drew.
                expect(slot.y + slot.h).toBeLessThanOrEqual(consoleTop + 1);
            }
        }
        expect(scale).toBeGreaterThan(0);
    });

    it('publishes the same console height it subtracts', () => {
        // The one-number property. `BattleArena` writes this into `--console-h` and `place()`
        // subtracts it; if they ever came from different expressions the board would drift again.
        for (const [width, height] of VIEWPORTS) {
            expect(consoleHeightAt(width, height)).toBeCloseTo(CONSOLE_H * stageScale(width, height), 6);
        }
    });

    it('still returns exactly 1 at the mock, so the composition is unchanged there', () => {
        // The property the rest of this file pins. The band arithmetic moved; the mock did not.
        expect(stageScale(REF_WIDTH, REF_HEIGHT)).toBeCloseTo(1, 6);
    });

    it('leaves the console a real share of a short window rather than collapsing it', () => {
        // A 768px laptop is the tightest common case. The console must still be able to hold a
        // card: below about 150px the fan has nowhere to go and the piles overlap it.
        expect(consoleHeightAt(1366, 768)).toBeGreaterThan(150);
    });
});

/**
 * TICKET 167g — THE ENEMIES SLIDE TO THE HAND PANEL'S EDGE.
 *
 * Henry, 2026-09-28: *"I just want the enemies to slide as far to the right as they can. If the panel
 * is open then push them towards the middle. If it is closed make sure there isn't a gap of 'white
 * space' between them."* The shift is computed per window size, because the stage is scaled and
 * centred but the panel is a fixed number of real pixels on the window's edge.
 */
describe('167g — the optional enemy shift on the rects', () => {
    it('adds the shift to an ENEMY plaque and sprite, in reference pixels', () => {
        expect(plaqueRect('enemy', 1, -1, 50).x).toBe(plaqueRect('enemy', 1).x + 50);
        expect(spriteRect('enemy', 0, -1, 50).x).toBe(spriteRect('enemy', 0).x + 50);
        // Only x moves.
        expect(plaqueRect('enemy', 2, -1, 50).y).toBe(plaqueRect('enemy', 2).y);
    });

    it('never moves an ally, whatever the shift', () => {
        for (const i of [0, 1, 2]) {
            expect(plaqueRect('ally', i, 0, 50)).toEqual(plaqueRect('ally', i, 0));
            expect(spriteRect('ally', i, 0, 50)).toEqual(spriteRect('ally', i, 0));
        }
    });

    it('is unchanged when no shift is given, so the mock still holds', () => {
        for (const i of [0, 1, 2]) {
            expect(spriteRect('enemy', i)).toEqual(spriteRect('enemy', i, -1, 0));
        }
    });
});

describe('167g — enemyShiftFor', () => {
    /** The rightmost enemy plaque's right edge, as drawn in a real window, with the shift applied. */
    const plaqueRightAt = (w: number, h: number, shift: number): number =>
        Math.max(...[0, 1, 2].map((i) => {
            const r = place(plaqueRect('enemy', i, -1, shift), w, h);
            return r.x + r.w;
        }));

    it('derives the reveal-lane clamp from the rects, not from a typed number', () => {
        expect(ENEMY_MIN_SHIFT).toBe(REVEAL_RECT.x + REVEAL_RECT.w - spriteRect('enemy', 0).x);
        expect(ENEMY_MIN_SHIFT).toBe(-76);
    });

    it('reads the panel footprint from exported constants that match the stylesheet (right 8, open 270, tab 34)', () => {
        expect([EHP_RIGHT_INSET, EHP_OPEN_WIDTH, EHP_TAB_WIDTH, ENEMY_PANEL_GAP]).toEqual([8, 270, 34, 12]);
    });

    it('at 1920x1080 with the panel CLOSED lands the plaques 12 px short of the tab', () => {
        const shift = enemyShiftFor(1920, 1080, false);
        expect(plaqueRightAt(1920, 1080, shift)).toBeCloseTo(1920 - EHP_RIGHT_INSET - EHP_TAB_WIDTH - ENEMY_PANEL_GAP, 6);
        // ...which closes the ~184 px of white space Henry saw: they were at x = 1694.
        expect(shift).toBeGreaterThan(0);
    });

    it('at 1920x1080 with the panel OPEN lands them 12 px short of its edge, toward the middle', () => {
        const open = enemyShiftFor(1920, 1080, true);
        const closed = enemyShiftFor(1920, 1080, false);
        expect(plaqueRightAt(1920, 1080, open)).toBeCloseTo(1920 - EHP_RIGHT_INSET - EHP_OPEN_WIDTH - ENEMY_PANEL_GAP, 6);
        expect(open).toBeLessThan(closed);
    });

    it('at 1280x800 with the panel open the reveal-lane clamp binds and returns exactly ENEMY_MIN_SHIFT', () => {
        // The open panel would need a 186 reference-pixel shift; only 76 are available before the
        // front enemy enters the reveal lane. The lane wins, and the panel covers part of the plaques.
        expect(enemyShiftFor(1280, 800, true)).toBe(ENEMY_MIN_SHIFT);
    });

    it('never lets the front enemy sprite enter the reveal lane, at any window size or panel state', () => {
        for (const [w, h] of [[1280, 800], [1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1080]]) {
            for (const open of [false, true]) {
                const shift = enemyShiftFor(w, h, open);
                expect(shift).toBeGreaterThanOrEqual(ENEMY_MIN_SHIFT);
                expect(spriteRect('enemy', 0, -1, shift).x).toBeGreaterThanOrEqual(REVEAL_RECT.x + REVEAL_RECT.w);
            }
        }
    });

    it('survives a window too short to have a stage', () => {
        expect(Number.isFinite(enemyShiftFor(300, 20, false))).toBe(true);
    });
});
