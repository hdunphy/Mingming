/**
 * WHO WON — one answer, for the screen and for the harness.
 *
 * # WHY THIS IS ITS OWN FILE
 *
 * The question was answered in two places that disagreed. `BattleArena` computed
 * `isVictory = every enemy down` and then `isDefeat = !isVictory && every ally down`, so a fight
 * that killed both sides in one resolution was a WIN; `runBatch.decideOutcome` called the same
 * board a DRAW. Two answers to "did I win" is one answer too many, and the screen's was the one the
 * player saw.
 *
 * # THE RULING (Henry, 2026-09-05 playtest)
 *
 * *"Fenrir killed me, but added burn overload to himself and he died first, so I won?"* — the
 * question mark is the report. A run whose last mingming is down does not continue, whatever
 * happened to the enemy in the same instant: the next node would be entered by a party of corpses.
 * So **a mutual kill is a DEFEAT**, and the fight it happened in is over either way.
 *
 * The old precedence had a stated reason — *"count it as a win so the defeat overlay never renders
 * and the save is never wiped"* — and that reason is dead. Ticket 11 deleted the defeat wipe: a
 * lost fight ends the RUN and never touches the ranch. What was protecting the save is now only
 * protecting a wrong scoreboard.
 *
 * Separately, `battleReducer` stops a caster's remaining actions the moment it dies, so the
 * specific board Henry saw — a dead Fenrir finishing his card — cannot arise any more. This file is
 * what decides the case where both sides genuinely fall together.
 */

import type { IBattleState } from './types';

export type BattleOutcome = 'PLAYER' | 'ENEMY' | 'DRAW';

const anyAlive = (party: IBattleState['playerParty']): boolean =>
    party.length > 0 && party.some((e) => e.currentHp > 0);

/**
 * The outcome, or `null` while the fight is still live.
 *
 * `DRAW` is reported honestly rather than folded into a loss here, because the two callers want
 * different things from it: the balance harness counts draws as their own bucket (a stall is data),
 * and the game treats one as a defeat — see `isPlayerDefeat`.
 */
export function battleOutcome(state: IBattleState): BattleOutcome | null {
    const playerAlive = anyAlive(state.playerParty);
    const enemyAlive = anyAlive(state.enemyParty);
    if (!playerAlive && !enemyAlive) return 'DRAW';
    if (!playerAlive) return 'ENEMY';
    if (!enemyAlive) return 'PLAYER';
    return null;
}

/** Did the player WIN — every enemy down and someone of theirs still standing. */
export function isPlayerVictory(state: IBattleState): boolean {
    return battleOutcome(state) === 'PLAYER';
}

/**
 * Is the run over — the player's side is down, mutual kills included.
 *
 * The asymmetry with `isPlayerVictory` is the ruling: a draw ends the run, and it does not pay.
 */
export function isPlayerDefeat(state: IBattleState): boolean {
    const outcome = battleOutcome(state);
    return outcome === 'ENEMY' || outcome === 'DRAW';
}
