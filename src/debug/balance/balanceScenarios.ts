/**
 * Composed scenarios for the balance suite.
 *
 * Every scenario here is a `ComposedSetup` - the same envelope the debug launcher and the
 * scenario files use - so a batch and a hand-launched repro are the same battle.
 *
 * The knobs are pinned on purpose. A batch comparing decks must vary the deck and nothing
 * else, so level and all three IVs are fixed across every unit in every scenario; the only
 * thing that differs between the two sides of a matchup is the species, its base deck and
 * (for the OS audit) the firmware.
 */

import { MingmingRegistry, getDeckForOS } from '../../engine/data/mingmingRegistry';
import type { ComposedSetup, EnemySetup, PartyMemberSetup } from '../scenarios/scenarioSchema';

/**
 * Mid-game level. Low enough that base decks are still what a unit is fighting with,
 * high enough that the stat curve is out of its early-level noise.
 */
export const BALANCE_LEVEL = 15;

/**
 * Ticket 19: IV jitter magnitude for every balance scenario (mirrors, OS variance,
 * gauntlet - they all compose through `matchupScenario`). 15±5 per Henry's ticket-18
 * decision: same seed-derived roll for both sides, applied per seed by
 * `runBatch.applyStatJitter`. Committed numbers are "win rate over a small stat
 * neighborhood" rather than a single pinned frame.
 */
export const BALANCE_STAT_JITTER = 5;

/** Middle of the 0..31 IV band, so no unit is rolled lucky. */
export const BALANCE_IV = 15;

/**
 * Every species in the registry, in declaration order. `GetMingmingData`'s not-found stub
 * is not a registry entry, so nothing needs filtering out - but the assertion keeps a
 * future stub from silently joining the gauntlet.
 */
const ALL_BALANCE_SPECIES: ReadonlyArray<string> = Object.keys(MingmingRegistry).filter(
    // Ticket 42: the control is an instrument, not a species to balance. It is excluded from
    // the mirror and §2.3 entirely - it carries one firmware, so `osVarianceScenario` would
    // throw on it, and "the control against itself" measures nothing. It appears only as the
    // gauntlet benchmark, where BALANCE_ONLY scoping must not filter it out either.
    id => id !== 'control'
        && MingmingRegistry[id].availableOS.length > 0
        && MingmingRegistry[id].availableOS.every(os => getDeckForOS(id, os).length > 0),
);

/**
 * Ticket 17: `BALANCE_ONLY=kraken,jormungandr npm run balance` scopes every suite to the
 * named species for the deck-tuning loop (Windows cmd: `set BALANCE_ONLY=kraken&& npm run
 * balance`; PowerShell: `$env:BALANCE_ONLY='kraken'; npm run balance`). A scoped run
 * never overwrites docs/balance/ - see reportGlobalSetup.
 */
const only = (process.env.BALANCE_ONLY ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

export const BALANCE_SPECIES: ReadonlyArray<string> =
    only.length === 0 ? ALL_BALANCE_SPECIES : ALL_BALANCE_SPECIES.filter(id => only.includes(id));

/**
 * Ticket 17: contiguous shard of the (possibly scoped) species list, so a heavy suite can
 * split across several `*.balance.ts` files and vitest's per-file worker pool can run
 * them on separate cores. Deterministic: same list, same slices, any worker count.
 */
export function shardSpecies(index: number, count: number): ReadonlyArray<string> {
    const size = Math.ceil(BALANCE_SPECIES.length / count);
    return BALANCE_SPECIES.slice(index * size, (index + 1) * size);
}

/**
 * The §2.2 benchmark. Ticket 42: this was `kraken` - a real, elemental, tuned deck, which made
 * the yardstick both skewed (kraken sits well below the field) and MOVING (every kraken retune
 * silently rescaled every other species' reading). It is now a purpose-built None-element deck
 * with no firmware and every card priced exactly at band, so the measurement is absolute.
 */
export const CONTROL_SPECIES = 'control';

function unit(definitionId: string, activeOS?: string): PartyMemberSetup {
    const definition = MingmingRegistry[definitionId];
    if (!definition) throw new Error(`[balanceScenarios] Unknown mingming '${definitionId}'.`);
    return {
        definitionId,
        level: BALANCE_LEVEL,
        attackIV: BALANCE_IV,
        defenseIV: BALANCE_IV,
        hpIV: BALANCE_IV,
        activeOS: activeOS ?? definition.availableOS[0],
    };
}

function enemyUnit(definitionId: string, activeOS?: string): EnemySetup {
    // Ticket 13: each side fights with ITS OS's deck - the fix for the shared-deck
    // confound this whole map exists to kill.
    const resolvedOS = activeOS ?? MingmingRegistry[definitionId].availableOS[0];
    return { ...unit(definitionId, resolvedOS), deck: getDeckForOS(definitionId, resolvedOS) };
}

export interface MatchupSpec {
    player: string;
    enemy: string;
    /** Defaults to `availableOS[0]` for each side. */
    playerOS?: string;
    enemyOS?: string;
    /** Base seed; batch seeds are derived from it. Defaults to a name-derived string. */
    seed?: string;
}

/**
 * One archetype against another, both sides played by `TacticalAI` from their base decks.
 *
 * `enemyMode` is always `'CARDS'`: a `MOVES` enemy plays telegraphed intents instead of a
 * deck, and `runBatch` rejects such a setup outright.
 */
export function matchupScenario(spec: MatchupSpec): ComposedSetup {
    const { player, enemy, playerOS, enemyOS } = spec;
    return {
        seed: spec.seed ?? `balance:${player}${playerOS ? `(${playerOS})` : ''}-vs-${enemy}${enemyOS ? `(${enemyOS})` : ''}`,
        enemyMode: 'CARDS',
        player: {
            party: [unit(player, playerOS)],
            deck: getDeckForOS(player, playerOS ?? MingmingRegistry[player].availableOS[0]),
            relics: [],
        },
        enemies: [enemyUnit(enemy, enemyOS)],
        statJitter: BALANCE_STAT_JITTER,
    };
}

/**
 * Identical species, identical deck, identical firmware, identical stats on both sides -
 * `docs/balance_testing.md` §2.1. The only remaining difference is which side moves first,
 * which is why the Mirror Test runs it under both orientations.
 */
export function mirrorScenario(definitionId: string): ComposedSetup {
    return matchupScenario({
        player: definitionId,
        enemy: definitionId,
        seed: `balance:mirror:${definitionId}`,
    });
}

/**
 * §2.3: same species, same deck, one firmware each. A head-to-head rather than two runs
 * against a third party, because the registry has no opponent that is competitive with
 * every species - a benchmark that a species beats (or loses to) 100% of the time cannot
 * distinguish its two OS variants at all.
 */
export function osVarianceScenario(definitionId: string): ComposedSetup {
    const [v1, v2] = MingmingRegistry[definitionId].availableOS;
    if (!v1 || !v2) {
        throw new Error(`[balanceScenarios] '${definitionId}' does not have two OS variants.`);
    }
    return matchupScenario({
        player: definitionId,
        enemy: definitionId,
        playerOS: v1,
        enemyOS: v2,
        seed: `balance:os:${definitionId}`,
    });
}

/**
 * TICKET 98: a 3v3 team battle, composed from the SAME registry the 1v1 grid uses.
 *
 * WHAT THIS DOES NOT DO IS THE POINT. It builds no new engine machinery, because the ruled 3v3
 * design (HANDOFF, "3v3 RECONFIRMED + DESIGN RULED") turned out to be **already live**:
 *
 *   - `IBattleState` carries parties, not frames, and the scenario schema already caps them at 3;
 *   - `PLAY_PROGRAM` takes an explicit `sourceId` and resolves it against the active party, so any
 *     member can cast - there is no "active" slot to switch;
 *   - `TacticalAI` already enumerates every LIVING member as a candidate caster, so
 *     caster-allocation is not a component to write, it is a search the AI is already running;
 *   - the deck and hand are per-SIDE, which is the ruled shared-deck model;
 *   - energy is per-entity;
 *   - and `battleReducer`'s pre-turn draw already computes `sum(members' cardDraw) - (N-1)`.
 *
 * So the skeleton the ticket asks for is a HARNESS, not an engine change, and keeping it that way
 * is what makes its numbers comparable to the 1v1 grid: the same reducer, the same AI, the same
 * scorer. A team sim built on a parallel code path would answer a different question.
 *
 * The shared deck is the concatenation of the three members' OS decks - 27 cards where 1v1 runs 9.
 * That is deliberately the naive composition and it is the thing the canary is watching: the
 * DECK-SIZE audit (guardrail 2) predicts that draw-triggered and reshuffle-triggered firmware
 * behaves differently in a 27-card pile, and the way to find out is to run it.
 */
export interface TeamSpec {
    /** Up to 3 members, `[species, os]` each. */
    player: ReadonlyArray<readonly [string, string]>;
    enemy: ReadonlyArray<readonly [string, string]>;
    seed?: string;
}

const teamName = (t: ReadonlyArray<readonly [string, string]>) => t.map(([, os]) => os).join('+');

export function teamScenario(spec: TeamSpec): ComposedSetup {
    const { player, enemy } = spec;
    if (player.length === 0 || enemy.length === 0) {
        throw new Error('[balanceScenarios] A team needs at least one member.');
    }
    if (player.length > 3 || enemy.length > 3) {
        throw new Error('[balanceScenarios] Party cap is 3 (MingmingInstanceSchema).');
    }
    return {
        seed: spec.seed ?? `team:${teamName(player)}-vs-${teamName(enemy)}`,
        enemyMode: 'CARDS',
        player: {
            party: player.map(([sp, os]) => unit(sp, os)),
            // Shared pile, per the ruled design. `buildScenarioState` already flattens the enemy
            // side the same way, so both sides get the same treatment without a special case.
            deck: player.flatMap(([sp, os]) => getDeckForOS(sp, os)),
            relics: [],
        },
        enemies: enemy.map(([sp, os]) => enemyUnit(sp, os)),
        statJitter: BALANCE_STAT_JITTER,
    };
}
