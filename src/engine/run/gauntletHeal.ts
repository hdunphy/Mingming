/**
 * TICKET 173a — **THE GAUNTLET REPAIRS 30% BETWEEN FIGHTS.**
 *
 * The gym was ruled three fights with no healing between them (`exploration-map.md`). Henry lost
 * the Emberfall gauntlet on 2026-09-30 after fight 1 left two of his three members near 0 (*"I lost
 * two mingming's early on which made it impossible"*), and ticket 172f replayed his gate: with no
 * healing the team clears 4 runs in 20; from full health the boss alone falls 15 times in 18. The
 * wall was the boss reached after attrition. Henry, 2026-09-30: *"30% is fine. I've beaten the gym
 * before with a different deck. You have to lose sometimes, it just can't feel unfair to lose."*
 *
 * So between gauntlet fights every member still standing repairs 30% of its max HP, capped at max.
 * A member at 0 stays at 0: Revive is how the fallen come back, and a percent of nothing is nothing.
 * The amount is printed on the pit stop, so none of it is hidden math.
 */

/** Percent of max HP a standing member repairs between gauntlet fights. Numbers move in 5s. */
export const GAUNTLET_HEAL_PERCENT = 30;

/** HP after the between-fights repair, and how much was repaired. A downed member is untouched. */
export function healBetweenFights(hp: number, maxHp: number): { hp: number; healed: number } {
    if (hp <= 0 || maxHp <= 0) return { hp: Math.max(0, hp), healed: 0 };
    const healed = Math.min(maxHp - hp, Math.floor((maxHp * GAUNTLET_HEAL_PERCENT) / 100));
    return { hp: hp + Math.max(0, healed), healed: Math.max(0, healed) };
}
