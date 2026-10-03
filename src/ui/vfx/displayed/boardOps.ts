/**
 * WHAT A BEAT DOES TO THE DISPLAYED BOARD — ticket 189c. A board change as plain data, so the
 * collector can record it from a bus event and the beat can apply it at the moment it lands.
 */

import type { DisplayedBoard } from './DisplayedBoard';

export type BoardOp =
    | { readonly kind: 'damage'; readonly id: string; readonly applied: number; readonly absorbed: number }
    | { readonly kind: 'heal'; readonly id: string; readonly amount: number }
    | { readonly kind: 'bark'; readonly id: string; readonly points: number };

/**
 * WHEN, on a cast's timeline, an op lands:
 * - `impact`: with the hit on that body (a heal lands with the card on the body it heals);
 * - `first`: with the first impact of the card (the price of a cast: recoil, toll);
 * - `after`: after the last impact, with the statuses (a tick, a Bark Shield arriving).
 */
export type BoardWhen = 'impact' | 'first' | 'after';

export interface TimedBoardOp {
    readonly when: BoardWhen;
    readonly op: BoardOp;
}

/** The slice of the board a beat needs. A test passes a spy. */
export type BoardSink = Pick<DisplayedBoard, 'damage' | 'heal' | 'gainBark'>;

export function applyBoardOp(board: BoardSink, op: BoardOp): void {
    switch (op.kind) {
        case 'damage': board.damage(op.id, op.applied, op.absorbed); return;
        case 'heal': board.heal(op.id, op.amount); return;
        case 'bark': board.gainBark(op.id, op.points);
    }
}
