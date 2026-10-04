/**
 * TICKET 185b — **how much HP one swing actually took off its target.**
 *
 * Henry (2026-10-02), on skoll_v1's TREACHERY_KERNEL: *"if an ally gets damaged by an enemy."* The
 * hook used to be an `onPostDamage` with `source: OPPONENT, target: ALLY`, and `onPostDamage` runs
 * after EVERY action an enemy resolves on your side, whether or not it did damage. So a hit Bark
 * Shield soaked completely, and an enemy card that only applied a status (Corrosive Bolt, ROOT
 * ROT's Poison), both paid Sköll Strength.
 *
 * The honest question is "did the target's HP go down", and the honest way to ask it is to compare
 * the board before and after, because everything that can stand between a swing and HP (Bark
 * Shield, temp HP, Stalwart, a cancelled hit) has already run by the time the executor returns.
 * Nothing here knows what any of those are, which is the point: a new shield cannot make this lie.
 *
 * One job and one only: board before, board after, target id in; a number out. The reducer puts it
 * on the per-hit context and `ConditionValidator` reads it through the `hpLost` condition.
 */
import type { IBattleState } from '../types';

/** A unit's current HP on a board, or 0 when it is not there. */
function hpOf(state: IBattleState, id: string): number {
    const unit = state.playerParty.find(e => e.id === id) ?? state.enemyParty.find(e => e.id === id);
    return unit ? unit.currentHp : 0;
}

/**
 * HP the target lost between two boards. Never negative: a heal, or a swing that changed nothing,
 * reads 0, so a condition of `hpLost: true` can only pass on a hit that cost HP.
 */
export function hpLostInHit(before: IBattleState, after: IBattleState, targetId: string): number {
    return Math.max(0, hpOf(before, targetId) - hpOf(after, targetId));
}
