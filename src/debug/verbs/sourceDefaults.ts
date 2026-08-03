/**
 * Where the source picker's pre-filled value comes from.
 *
 * Decided in ticket 05 section 4: the picker is pre-filled from live battle state — the
 * opposing party's active unit relative to the target — and is directly overridable.
 *
 * Explicitly NOT self-attribution. Retaliation and thorns-style hooks compare source to
 * target to decide whether to fire, so defaulting a unit to be its own attacker would
 * silently misfire exactly the reactive hooks the overlay exists to debug. When no
 * opponent is available this returns `null` and the panel disables the verb rather than
 * quietly falling back to the target.
 *
 * Pure functions over `IBattleState` — no React, no Redux.
 */

import type { IBattleEntity, IBattleState } from '../../engine/types';

export type BattleSide = 'PLAYER' | 'ENEMY';

/** Which party a unit fights for, or `null` if it is not on this board. */
export function sideOf(state: IBattleState, entityId: string | null | undefined): BattleSide | null {
    if (!entityId) return null;
    if (state.playerParty.some((e) => e.id === entityId)) return 'PLAYER';
    if (state.enemyParty.some((e) => e.id === entityId)) return 'ENEMY';
    return null;
}

function partyOf(state: IBattleState, side: BattleSide): ReadonlyArray<IBattleEntity> {
    return side === 'PLAYER' ? state.playerParty : state.enemyParty;
}

const isAlive = (entity: IBattleEntity): boolean => entity.currentHp > 0;

/**
 * Everything that could be picked as the source for an effect on `targetId`, ordered
 * the way the picker should list it: living opponents, then living allies, then the
 * dead of both sides (a corpse is a legal `sourceId` — the engine only requires the id
 * to resolve — and "the unit that just died did this" is a real repro).
 *
 * The target itself is never a candidate.
 */
export function sourceCandidates(state: IBattleState, targetId: string | null): ReadonlyArray<IBattleEntity> {
    const targetSide = sideOf(state, targetId);
    const opposing = targetSide === 'PLAYER' ? state.enemyParty
        : targetSide === 'ENEMY' ? state.playerParty
        : [...state.playerParty, ...state.enemyParty];
    const others = targetSide === 'PLAYER' ? state.playerParty
        : targetSide === 'ENEMY' ? state.enemyParty
        : [];

    const notTarget = (e: IBattleEntity) => e.id !== targetId;
    return [
        ...opposing.filter((e) => notTarget(e) && isAlive(e)),
        ...others.filter((e) => notTarget(e) && isAlive(e)),
        ...opposing.filter((e) => notTarget(e) && !isAlive(e)),
        ...others.filter((e) => notTarget(e) && !isAlive(e)),
    ];
}

/**
 * The pre-filled source for an effect on `targetId`.
 *
 * Order of preference:
 *   1. `preferredId`, when it is a living member of the opposing party. The panel passes
 *      `battle.selectedSourceId` here, so a source the operator already chose on the board
 *      stays chosen instead of being second-guessed.
 *   2. The opposing party's active unit — its first living member, which is the party
 *      order the board itself renders and the same "first alive" convention the AI and
 *      the hotkeys use.
 *   3. Any other living unit that is not the target (covers a wiped opposing party).
 *   4. `null` — no legal non-self source exists.
 */
export function defaultSourceId(
    state: IBattleState,
    targetId: string | null,
    preferredId?: string | null,
): string | null {
    const targetSide = sideOf(state, targetId);
    if (targetSide !== null && preferredId && preferredId !== targetId) {
        const opposing = targetSide === 'PLAYER' ? state.enemyParty : state.playerParty;
        const preferred = opposing.find((e) => e.id === preferredId);
        if (preferred && isAlive(preferred)) return preferred.id;
    }

    if (targetSide !== null) {
        const opposing = partyOf(state, targetSide === 'PLAYER' ? 'ENEMY' : 'PLAYER');
        const active = opposing.find((e) => isAlive(e) && e.id !== targetId);
        if (active) return active.id;
    }

    const anyone = [...state.playerParty, ...state.enemyParty]
        .find((e) => isAlive(e) && e.id !== targetId);
    return anyone ? anyone.id : null;
}
