/**
 * TICKET 170a — THE GHOST WALK, and the two halves that let tiers share a deck.
 *
 * The gauntlet is three fights with no healing between them (a 30% repair since 173). To measure it
 * many parties have to stand at the gym gate, and a real walk gets there about one time in seven.
 *
 * 1. `walkToGym` walks the map as the walker always has, except that a fight lost BEFORE the gym is
 *    carried on as a win: the party is whole, the rewards are rolled as for a win, and the walk goes
 *    on. It stops at the gate and hands back a `GymSnapshot`. Each carried fight is counted
 *    (`ghostFights`) and marked `ghost: true` on its fight record, whose `won` stays the real result,
 *    so a report can say how much of a deck came from fights the walker really won.
 * 2. `playGauntlet` starts from a snapshot with a tier (and modifiers) set, does the gate steps the
 *    walker already does, plays the three gauntlet fights and returns what happened in each.
 *
 * ONE SNAPSHOT, EVERY TIER. The snapshot is built once per seed and every tier plays from the same
 * one, so the deck, the party and the scrap are identical and only the tier differs. It is also
 * cheap: a map walk costs minutes and a gauntlet is three fights.
 *
 * WHAT THIS DELIBERATELY DOES NOT MEASURE. Tiers 1 and 2 also change fights BEFORE the gym (wild
 * firmware, the lite AI, an extra elite). Under a shared snapshot those changes are invisible, so
 * this measures the gauntlet alone. The whole-run ladder keeps measuring the whole run.
 */

import { GAUNTLET_FIGHTS } from '../../engine/run/gauntlet';
import { walkRun, type WalkInput } from './runWalker';
import type { GymSnapshot } from './gymSnapshot';

export type { GymSnapshot } from './gymSnapshot';

/** What a walk is asked when it is only being walked to the gate: no tier, since the map is tier 0's. */
export type GhostWalkInput = Pick<WalkInput, 'seed' | 'starter' | 'gymIndex' | 'upgrades' | 'patchPrice'>;

/** One gauntlet fight as the report needs it. */
export interface GauntletFightResult {
    readonly won: boolean;
    readonly turns: number;
    /** Each member's HP at the end of the fight, as a fraction of its maximum, before the repair. */
    readonly hp: ReadonlyArray<{ readonly osId: string; readonly hpFraction: number }>;
}

export interface GauntletResult {
    readonly tier: number;
    /** All three fights won. */
    readonly cleared: boolean;
    /** Gauntlet fights won, 0 to 3. */
    readonly fightsWon: number;
    /** The fights played: up to three, ending at the first one lost. */
    readonly fights: ReadonlyArray<GauntletFightResult>;
    /** The deck the party took into the gauntlet, after the gate's own steps. Sorted. */
    readonly deck: ReadonlyArray<string>;
}

/** The snapshot, or null when the walk could not get to the gate (it ran out of map to step to). */
export function walkToGym(input: GhostWalkInput): GymSnapshot | null {
    const result = walkRun({
        seed: input.seed, starter: input.starter, gymIndex: input.gymIndex,
        upgrades: input.upgrades, patchPrice: input.patchPrice,
        ghost: true, stopAtGym: true,
    });
    return result.gymSnapshot ?? null;
}

/**
 * Play the gauntlet from a snapshot at `tier`, with `modifiers` on. The snapshot is not changed: the
 * walk starts from a deep copy of it.
 */
export function playGauntlet(snapshot: GymSnapshot, tier: number, modifiers?: ReadonlyArray<string>): GauntletResult {
    const copy = structuredClone(snapshot) as GymSnapshot;
    const result = walkRun({
        ...copy.input, tier, modifiers,
        resume: copy,
    });
    const gauntlet = result.fights.slice(copy.fights.length).filter((fight) => fight.kind === 'gym').slice(0, GAUNTLET_FIGHTS);
    const fightsWon = gauntlet.filter((fight) => fight.won).length;
    const deckAtGate = result.log.events.find((event, index) =>
        event.kind === 'FIGHT_DECK' && event.nodeKind === 'gym' && index >= copy.log.events.length);
    return {
        tier,
        cleared: result.outcome === 'victory',
        fightsWon,
        fights: gauntlet.map((fight) => ({
            won: fight.won,
            turns: fight.turns,
            hp: fight.survivors.map((s) => ({ osId: s.osId, hpFraction: s.hpFraction })),
        })),
        deck: deckAtGate && deckAtGate.kind === 'FIGHT_DECK' ? [...deckAtGate.deck] : [],
    };
}
