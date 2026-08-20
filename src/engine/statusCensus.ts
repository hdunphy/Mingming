/**
 * TICKET 109: damage-over-time attribution, for the 3v3 pricing check.
 *
 * WHY THIS EXISTS. `RunTelemetry` deliberately does NOT attribute DoT - its own header calls that
 * "the documented DoT attribution trap" - because a Burn or Poison tick resolves at end of turn with
 * no card to charge it to. But ticket 109's Part 1 asks precisely what share of damage Poison and
 * Burn carry over a 12-turn game against their 5-turn 1v1 share, so the attribution has to exist
 * somewhere. The end-of-turn tick loop iterates PER STATUS EFFECT, so at that one site the cause is
 * unambiguous and no modelling is needed.
 *
 * IT CHANGES NO BEHAVIOUR. Off unless `STATUS_CENSUS=1`, and it only ever adds to counters.
 *
 * 0-AI-SIM-COUNTS. `TacticalAI` scores candidate plays by running them through the REAL reducer, so
 * a counter in the reducer counts the AI's speculation as if it were the battle - at 3v3 that is
 * thousands of imagined plays per real one, and every rate would be nonsense. The AI runs its search
 * with the event bus muted, so `globalBattleEventBus.isLive` is the predicate that separates a real
 * tick from an imagined one. Every recorder here is behind it.
 */
import { globalBattleEventBus } from './events';

const ENABLED = process.env.STATUS_CENSUS === '1';

export interface StatusCensus {
    /** HP removed by each status's end-of-turn tick, keyed by status type. */
    dotDamage: Record<string, number>;
    /** HP restored by each status's tick (Regen). */
    hotHealing: Record<string, number>;
    /** Ticks that fired, per status - the denominator for "how big was a typical tick". */
    ticks: Record<string, number>;
}

export const statusCensus: StatusCensus = {
    dotDamage: {}, hotHealing: {}, ticks: {},
};

export function statusCensusReset(): void {
    statusCensus.dotDamage = {};
    statusCensus.hotHealing = {};
    statusCensus.ticks = {};
}

const bump = (bag: Record<string, number>, key: string, by: number): void => {
    bag[key] = (bag[key] ?? 0) + by;
};

export function recordDotTick(status: string, damage: number, healing: number): void {
    if (!ENABLED || !globalBattleEventBus.isLive) return;
    bump(statusCensus.ticks, status, 1);
    if (damage > 0) bump(statusCensus.dotDamage, status, damage);
    if (healing > 0) bump(statusCensus.hotHealing, status, healing);
}

/* Reshuffles (REBIRTH's trigger) are NOT tapped here: `DECK_SHUFFLED` already rides the event bus,
   and the bus is muted during the AI search, so a plain subscriber is 0-AI-SIM-COUNTS-clean without
   any engine change. The harness subscribes; see scratch/team109.ts. */
