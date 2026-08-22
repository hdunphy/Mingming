/**
 * Scenario materializer - turns a validated `composed` scenario into a live `IBattleState`.
 *
 * See docs/wayfinder/debug-toolkit/tickets/11-scenario-materializer.md.
 *
 * WHY THIS DOES NOT CALL `createBattleState`
 * ------------------------------------------
 * `createBattleState` picks one of four mutually exclusive branches from its input (gym tier
 * 1/2/3, sector, fixed). Only the last honours `enemyIds`; the other three generate their enemies
 * procedurally and ignore the list entirely, and the fixed branch builds each enemy from a species
 * id with no room for the per-enemy overrides `ComposedSetup` exists to express. So the party is
 * built here, directly, from `initializeBattleEntity`.
 *
 * Everything downstream of party construction *is* shared with the real creation path -
 * `instantiateDeck`, `drawCards`, `generateIntents`, and the same field-for-field battle
 * envelope - so a scenario battle and a real battle are structurally indistinguishable.
 *
 * DETERMINISM
 * -----------
 * Every random decision draws from one `SeedStream` seeded with `setup.seed`: entity ids,
 * card-instance ids, deck shuffles, the opening draw, and intent selection. Same setup +
 * same seed => deep-equal state, ids included. There is no `Math.random()`, `Date.now()` or
 * `crypto.randomUUID()` on this path.
 *
 * The result is returned through `normalizeBattleState`, so a state built from a `composed`
 * scenario and one loaded from a `snapshot` are in the same canonical form and can be
 * compared directly.
 *
 * NOT THIS MODULE'S JOB: injection. Nothing here dispatches, touches Redux, or reads a
 * store. Callers take the returned state and inject it however the debug gating
 * architecture decides.
 *
 * `setup.gauntlet` is deliberately untouched: `IBattleState` has no gauntlet field (it lives on
 * the run - `IRunState.gauntlet`, ticket 11), and the one way it reaches battle creation - patching
 * `currentHp` from the carried HP - is already expressed directly as per-member `currentHp` here.
 * It is run context for the injection layer to restore, not battle state.
 *
 * No `IBattleSetup` shim turned out to be needed either: nothing on the direct-build path takes
 * one. `initializeBattleEntity` takes an instance + definition, `instantiateDeck` takes
 * dataIds, `drawCards` takes a deck. Only `createBattleState` - the function being
 * bypassed - wants the assembled setup.
 */

import type {
    EnemyCombatMode,
    IBattleEntity,
    IBattleState,
    IDeckState,
    IMingmingState,
    ProgramEntity,
} from '../../engine/types';
import { initializeBattleEntity } from '../../engine/types';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { GetRelic } from '../../engine/data/relicRegistry';
import { instantiateDeck } from '../../engine/data/battleFactories';
import { drawCards } from '../../engine/deckLogic';
import { generateIntents } from '../../engine/core/IntentUtils';
import { SeedStream } from '../../engine/core/SeedStream';
import { normalizeBattleState } from './normalizeBattleState';
import type { ComposedSetup, EnemySetup, PartyMemberSetup } from './scenarioSchema';

/** Id prefix for scenario-built combat units - matches `createMockEntity`'s. */
const ENTITY_ID_PREFIX = 'mm';

/**
 * One combat unit, built straight from its setup. No procedural rolling: all three IVs come from
 * the file verbatim, which is the whole point of the composed kind.
 *
 * Ticket 21: there is no `level` any more. Every unit is built at `CALIBRATION_LEVEL`, so the only
 * thing a setup can vary is species, OS, deck and stat roll.
 */
function buildEntity(setup: PartyMemberSetup | EnemySetup, rng: SeedStream): IBattleEntity {
    const instance: IMingmingState = {
        id: rng.nextId(ENTITY_ID_PREFIX),
        definitionId: setup.definitionId,
        blueprintsCollected: 0,
        attackIV: setup.attackIV,
        defenseIV: setup.defenseIV,
        hpIV: setup.hpIV,
        // Key stays absent when unset: `initializeBattleEntity` falls back to
        // `definition.availableOS[0]`, which is also the normalizer's fill-class default.
        ...(setup.activeOS !== undefined ? { activeOS: setup.activeOS } : {}),
    };

    let entity = initializeBattleEntity(instance, GetMingmingData(setup.definitionId));

    // maxHp first: it is the ceiling `currentHp` is validated against, and overriding it
    // must move currentHp with it (initializeBattleEntity set currentHp to the *computed*
    // maxHp, so leaving it alone would silently produce a damaged unit).
    const maxHpOverride = (setup as EnemySetup).maxHpOverride;
    if (maxHpOverride !== undefined) {
        entity = { ...entity, maxHp: maxHpOverride, currentHp: maxHpOverride };
    }

    if (setup.currentHp !== undefined) {
        // The schema bounds currentHp below (>= 0) but cannot bound it above, since maxHp
        // is not known until the stats are computed. Clamp loudly rather than emit a state
        // whose HP bar overflows and whose first heal would silently correct it - that
        // correction is exactly the kind of drift that makes a repro stop reproducing.
        const clamped = Math.min(setup.currentHp, entity.maxHp);
        if (clamped !== setup.currentHp) {
            console.warn(
                `[buildScenarioState] currentHp ${setup.currentHp} exceeds maxHp ${entity.maxHp} ` +
                    `for ${setup.definitionId}; clamped to ${clamped}.`,
            );
        }
        entity = { ...entity, currentHp: clamped };
    }

    if (setup.statusEffects !== undefined) {
        entity = { ...entity, statusEffects: setup.statusEffects };
    }

    if (setup.moves !== undefined) {
        entity = { ...entity, moves: setup.moves };
    }

    return entity;
}

/**
 * The player-side relic bonuses `createBattleState` applies at battle start, mirrored here
 * so `player.relics` is not decorative. Enemies get none, same as the real path.
 *
 * `GetRelic` throws on an unknown id. Scenarios follow the registry-drift policy from
 * ticket 02 (warn, then continue) rather than hard-failing an entire scenario library over
 * one renamed relic.
 */
function applyRelics(entity: IBattleEntity, relicIds: ReadonlyArray<string>): IBattleEntity {
    let result = entity;

    for (const relicId of relicIds) {
        let effect: string;
        try {
            effect = GetRelic(relicId).effect;
        } catch {
            console.warn(`[buildScenarioState] Unknown relic '${relicId}' in scenario; skipping.`);
            continue;
        }

        if (effect === 'ENERGY_CAP_BONUS') {
            result = {
                ...result,
                maxEnergy: result.maxEnergy + 1,
                currentEnergy: result.currentEnergy + 1,
            };
        }
        if (effect === 'DRAW_BONUS') {
            result = { ...result, cardDraw: result.cardDraw + 1 };
        }
        if (effect === 'ATTACK_MULTIPLIER') {
            result = {
                ...result,
                relicBonuses: {
                    ...result.relicBonuses!,
                    attackMod: result.relicBonuses!.attackMod * 1.1,
                },
            };
        }
    }

    return result;
}

/**
 * Build a live battle state from a composed scenario setup.
 *
 * Pure and deterministic: the only inputs are `setup` and the data registries. Two calls
 * with the same setup return deep-equal states.
 *
 * Throws when the setup describes a battle that cannot be played - an empty player party
 * or an empty enemy list - matching `createBattleState`'s guards. Both render a hollow
 * arena and an instant, meaningless result, so failing loudly beats materializing them.
 */
export function buildScenarioState(setup: ComposedSetup): IBattleState {
    if (setup.player.party.length === 0) {
        throw new Error('[buildScenarioState] Scenario has no player party members.');
    }
    if (setup.enemies.length === 0) {
        throw new Error('[buildScenarioState] Scenario has no enemies.');
    }

    const enemyMode: EnemyCombatMode = setup.enemyMode ?? 'MOVES';
    const battleSeed = setup.seed;

    // One stream, drawn from in a fixed order: player ids -> enemy ids -> player card ids ->
    // player shuffle -> enemy card ids -> enemy shuffle -> draws -> intents. The order is
    // the determinism contract; changing it changes every id in every existing scenario.
    const rng = new SeedStream(battleSeed);

    const playerParty: IBattleEntity[] = setup.player.party.map(member =>
        applyRelics(buildEntity(member, rng), setup.player.relics),
    );

    // Enemies keep the activeOS `initializeBattleEntity` resolved. `createBattleState`
    // strips it (enemies use intents, not OS) but that strip is unrepresentable in
    // canonical form: the normalizer's fill class puts `availableOS[0]` straight back.
    const enemyParty: IBattleEntity[] = setup.enemies.map(enemy => buildEntity(enemy, rng));

    // v1 keeps the player deck shared across the party (ticket 02, "shared-deck watch
    // item"). Enemy decks are per-enemy in the file but flattened into one side deck here,
    // exactly as the real creation path does.
    const enemyDeckIds: string[] = setup.enemies.flatMap(enemy => enemy.deck ?? []);

    const pDeckCards: ProgramEntity[] = rng.shuffle(instantiateDeck([...setup.player.deck], rng));
    const eDeckCards: ProgramEntity[] = rng.shuffle(instantiateDeck(enemyDeckIds, rng));

    const playerCardDraw =
        playerParty.reduce((sum, e) => sum + e.cardDraw, 0) - playerParty.length + 1;
    const enemyCardDraw =
        enemyParty.reduce((sum, e) => sum + e.cardDraw, 0) - enemyParty.length + 1;

    const pInitialDeck: IDeckState = {
        ownerId: 'PLAYER',
        deck: [],
        drawpile: pDeckCards,
        hand: [],
        discard: [],
        exhaust: [],
    };
    const { state: pDeckState, nextSeed: seedAfterPlayerDraw } = drawCards(
        pInitialDeck,
        playerCardDraw,
        rng.seed,
    );
    rng.adopt(seedAfterPlayerDraw);

    // Move users get no drawpile or hand at all; card users get a dealt hand.
    const eInitialDeck: IDeckState = {
        ownerId: 'ENEMY',
        deck: [],
        drawpile: enemyMode === 'CARDS' ? eDeckCards : [],
        hand: [],
        discard: [],
        exhaust: [],
    };
    const { state: eDeckState, nextSeed: seedAfterEnemyDraw } =
        enemyMode === 'CARDS'
            ? drawCards(eInitialDeck, enemyCardDraw, rng.seed)
            : { state: eInitialDeck, nextSeed: rng.seed };
    rng.adopt(seedAfterEnemyDraw);

    // Intents are only telegraphed for move users.
    const finalEnemyParty =
        enemyMode === 'MOVES' ? generateIntents(enemyParty, rng.seed, 1) : enemyParty;

    return normalizeBattleState({
        // Derived from the seed, never wall-clock: sessionId is a compared field, so a
        // timestamp here would break every replay diff on its own (ticket 02, section 3).
        sessionId: 'battle_' + battleSeed,
        seed: rng.seed,
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: setup.player.relics,

        playerParty,
        enemyParty: finalEnemyParty,

        playerDeck: pDeckState,
        enemyDeck: eDeckState,

        logs: [],
        osLogs: [],
        procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        nonNaturalCardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        enemyMode,
    });
}
