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

/** Middle of the 0..31 IV band, so no unit is rolled lucky. */
export const BALANCE_IV = 15;

/**
 * Every species in the registry, in declaration order. `GetMingmingData`'s not-found stub
 * is not a registry entry, so nothing needs filtering out - but the assertion keeps a
 * future stub from silently joining the gauntlet.
 */
export const BALANCE_SPECIES: ReadonlyArray<string> = Object.keys(MingmingRegistry).filter(
    id => MingmingRegistry[id].availableOS.length > 0
        && MingmingRegistry[id].availableOS.every(os => getDeckForOS(id, os).length > 0),
);

/** The §2.2 control archetype: "Kraken Poison". */
export const CONTROL_SPECIES = 'kraken';

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
