/**
 * TICKET 171h — **END TURN, WITH ENERGY STILL ON THE TABLE.**
 *
 * Henry's ask (2026-09-29), ruled as written on 2026-09-30: *"a flash on the button and then the
 * card that is playable lights up"*, and nothing like a popup. So the first press of END TURN while a
 * play that spends Energy is still available does not end the turn: it flashes the button and lights
 * those cards. The second press ends it. Nothing else is blocked, and the player never has to answer
 * anything.
 *
 * Both doors to END TURN use this (the button in `CardHand` and the Space key in `BattleArena`), so
 * the two cannot disagree about when a turn really ends.
 */

import type { IBattleState } from '../../engine/types';
import { energyPlaysLeft } from './playsLeft';

/** The nudge on screen: which turn it belongs to, and which cards it lit. */
export interface EndTurnNudge {
    readonly turn: number;
    readonly cardIds: ReadonlyArray<string>;
}

export type EndTurnDecision =
    | { readonly kind: 'end' }
    | { readonly kind: 'nudge'; readonly cardIds: ReadonlyArray<string> };

/**
 * What a press of END TURN does. Ends the turn if this turn has already been nudged (the second
 * press), or if nothing that spends Energy is left; otherwise nudges, naming the cards to light.
 */
export function decideEndTurn(state: IBattleState | null | undefined, nudge: EndTurnNudge | null | undefined): EndTurnDecision {
    if (!state) return { kind: 'end' };
    if (nudge && nudge.turn === state.turn) return { kind: 'end' };
    const cardIds = energyPlaysLeft(state);
    return cardIds.length > 0 ? { kind: 'nudge', cardIds } : { kind: 'end' };
}

/** Whether the nudge on screen belongs to the turn being shown (a stale one lights nothing). */
export function nudgeIsLive(state: IBattleState | null | undefined, nudge: EndTurnNudge | null | undefined): nudge is EndTurnNudge {
    return !!state && !!nudge && state.activeSide === 'PLAYER' && nudge.turn === state.turn;
}
