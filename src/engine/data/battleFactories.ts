import type { IBattleEntity, ProgramEntity, IBattleState, IMingmingState, IDeckState } from '../types';
import { initializeBattleEntity } from '../types';
import { GetProgramData } from './programRegistry';
import { GetMingmingData } from './mingmingRegistry';
import { GetRelic } from './relicRegistry';
import { drawCards } from '../deckLogic';
import { generateIntents } from '../core/IntentUtils';
import { SeedStream, rollSeed } from '../core/SeedStream';

/**
 * Ticket 21: the `level` and `experience` parameters are gone. Every entity is built at
 * `CALIBRATION_LEVEL`, so there was nothing left for a caller to vary and leaving the parameters
 * in place would have been an invitation to re-introduce stat scaling.
 */
export function createMockEntity(
    name: string,
    mingmingId: string = 'fenrir',
    rng: SeedStream = new SeedStream(rollSeed())
): IBattleEntity {
    const definition = GetMingmingData(mingmingId);

    const instance: IMingmingState = {
        id: rng.nextId('mm'),
        definitionId: mingmingId,
        nickname: name,
        blueprintsCollected: 0,
        hpIV: rng.nextInt(0, 31),
        attackIV: rng.nextInt(0, 31),
        defenseIV: rng.nextInt(0, 31),
    };

    return initializeBattleEntity(instance, definition);
}

export function instantiateDeck(deckIds: string[], rng: SeedStream = new SeedStream(rollSeed())): ProgramEntity[] {
    return deckIds.map((id, index) => {
        if (!id) console.error(`instantiateDeck got undefined at index ${index} in deckIds:`, deckIds);
        return {
            id: rng.nextId('card'),
            dataId: id,
            // X-cost cards carry 0 here; their real price is resolved per play by
            // getEffectiveCardCost from the source's current Energy.
            currentCost: typeof GetProgramData(id).baseCost === 'number' ? (GetProgramData(id).baseCost as number) : 0,
            isPlayable: true
        };
    });
}

import { generateEncounter } from './EncounterGenerator';
import type { Element, EnemyCombatMode } from '../types';

export interface BattleOptions {
    /**
     * Seed for every random decision made while *creating* the battle: party
     * size, IVs, deck shuffles, opening draws, entity and card-instance ids.
     * Omit it and one is rolled here, then threaded the same way - so the
     * resulting battle is always reproducible from the seed it records.
     */
    readonly seed?: string;

    /**
     * How the enemy side fights, locked in at battle creation.
     * Defaults to 'MOVES' (telegraphed intents, no cards). Passing
     * 'CARDS' explicitly is the ONLY way to create card-playing enemies.
     */
    readonly enemyMode?: EnemyCombatMode;
}

/**
 * Everything a battle needs from outside itself — ticket 11.
 *
 * This replaces the `save: IPlayerSave` parameter `createBattleState` used to take, and the change
 * is not cosmetic. The old signature meant the battle factory read the *whole* save shape and
 * picked its branch out of it (`activeParty`, `roster`, `relics`, `gauntlet`, `activeDeck.cards`,
 * `cardInventory`) — six fields of a twelve-field blob, chosen by rules only this function knew.
 * With the ranch/run split there is no single object that holds all six any more, and inventing one
 * would have re-created `IPlayerSave` under a new name. So the caller resolves the questions
 * instead, and what arrives here is answers: a party, a deck, some drivers, some carried HP.
 *
 * `engine/run/battleSetup.ts` builds one of these from `(IRanchState, IRunState)`. The debug
 * scenario path bypasses this function entirely (`debug/scenarios/buildScenarioState.ts`).
 */
export interface IBattleSetup {
    /** The party, already resolved and ordered. */
    readonly party: ReadonlyArray<IMingmingState>;
    /** The deck as dataIds. The instance-id indirection is gone — a run deck holds dataIds. */
    readonly deck: ReadonlyArray<string>;
    /** Was `relics`. Applied to the player side and copied to `IBattleState.activeRelics`. */
    readonly drivers: ReadonlyArray<string>;
    /**
     * HP carried between gauntlet fights, by member id. Empty outside a gauntlet.
     *
     * **A 0 in here is not the same as an absent key**, and ticket 18 depends on the difference: an
     * absent key means "this member was not carrying anything, build it at full HP", while a 0 means
     * "this member is DOWN and stays down into this fight" (`IGauntletProgress.downedMemberIds`
     * names the same members). The carry below therefore tests `!== undefined` rather than
     * truthiness — `if (carriedHp)` would silently full-heal every fainted member at the start of
     * every gauntlet fight, which is the exact bug the three-fight chain exists to avoid.
     */
    readonly persistedHp: Readonly<Record<string, number>>;
    /**
     * A pre-rolled enemy side — ticket 11, part 2. Set for every fight started from a region node;
     * absent everywhere else.
     *
     * **Why the enemies arrive built rather than being generated here.** A run encounter is decided
     * by the node's kind, the biome's element, the biome's *depth* and the node's visit count
     * (`engine/run/encounter.ts`), and only the second of those four is anything this function could
     * be handed as a parameter. Threading the other three in would have meant teaching the battle
     * factory what a region graph is, which is the same mistake `IBattleSetup` exists to undo. So
     * the run rolls its own encounter and passes the answer, exactly as it passes its party and its
     * deck.
     *
     * Structurally typed rather than importing `IRunEncounter`, so the engine's lowest layer keeps
     * no import edge to the run loop.
     */
    readonly encounter?: {
        readonly enemyParty: ReadonlyArray<IBattleEntity>;
        readonly enemyDeckIds: ReadonlyArray<string>;
    } | null;
}

export function createBattleState(
    setup: IBattleSetup,
    enemyIds: string[],
    sectorElement?: Element,
    options?: BattleOptions
): IBattleState {
    const enemyMode: EnemyCombatMode = options?.enemyMode ?? 'MOVES';

    // One seed, threaded through every random decision below. When no seed is
    // supplied we roll exactly once - the only non-deterministic call left on
    // the creation path.
    const battleSeed: string = options?.seed ?? rollSeed();
    const rng = new SeedStream(battleSeed);
    const playerPartyMembers = setup.party;

    if (playerPartyMembers.length === 0) throw new Error("No party members in the battle setup!");

    const playerParty = playerPartyMembers.map(mm => {
        let entity = initializeBattleEntity(mm, GetMingmingData(mm.definitionId));

        // Gauntlet persistence (ticket 18, and Milestone 8.3 before it). `persistedHp` is empty
        // outside a gauntlet (`IGauntletProgress.persistedHp` is the only HP store in `IRunState`),
        // so this needs no gauntlet check of its own — which is also why a full heal between
        // ordinary nodes is true by construction rather than by a rule someone has to remember.
        //
        // `!== undefined`, never a truthiness test: 0 is a downed member and must build at 0. See
        // `IBattleSetup.persistedHp`.
        const carriedHp = setup.persistedHp[mm.id];
        if (carriedHp !== undefined) {
            entity = {
                ...entity,
                currentHp: carriedHp
            };
        }

        // Milestone 8.4: Driver (was: relic) application
        setup.drivers.forEach(relicId => {
            const relic = GetRelic(relicId);
            if (relic.effect === 'ENERGY_CAP_BONUS') {
                entity = {
                    ...entity,
                    maxEnergy: entity.maxEnergy + 1,
                    currentEnergy: entity.currentEnergy + 1
                };
            }
            if (relic.effect === 'DRAW_BONUS') {
                entity = {
                    ...entity,
                    cardDraw: entity.cardDraw + 1
                };
            }
            if (relic.effect === 'ATTACK_MULTIPLIER') {
                entity = {
                    ...entity,
                    relicBonuses: {
                        ...entity.relicBonuses!,
                        attackMod: entity.relicBonuses!.attackMod * 1.1
                    }
                };
            }
        });

        return entity;
    });

    let enemyParty: IBattleEntity[] = [];
    let enemyDeckIds: string[] = [];

    // Ticket 11: a region node brings its own enemies. This branch is first because it is the only
    // one with the full picture — the node's kind, depth and visit count all went into the roll —
    // so anything below it would be second-guessing an answer that has already been given.
    if (setup.encounter) {
        enemyParty = [...setup.encounter.enemyParty];
        enemyDeckIds = [...setup.encounter.enemyDeckIds];
    /*
     * TICKET 18 DELETED THE GYM-TIER BRANCH THAT USED TO SIT HERE.
     *
     * It was pre-run-loop, and every one of its parts contradicted a ruling that has landed since:
     *
     *   - a hardcoded `synergyMap` paired each gym element with a second one (Fire+Earth,
     *     Water+Nature), which ticket 05's mono-element biomes and pure counter cycle replaced;
     *   - tier 1 rolled ONE OR TWO enemies, where ticket 18 rules the gauntlet "always full 3v3
     *     curated";
     *   - tier 3 built a "Sector Warden" at `maxHp * 1.5` with three hardcoded moves, i.e. difficulty
     *     as a bigger number and as bespoke content in the battle factory — ticket 21 froze stat
     *     scaling and `vision.md` rules difficulty as team design ("never bigger numbers");
     *   - and it drew its species from `getSectorSpecies(gymElement)`, so the boss had nothing to do
     *     with the three biomes the player had just walked, which is precisely the connection ticket
     *     18 exists to make.
     *
     * Its replacement is `engine/run/gauntlet.rollGauntletFight`, which arrives through
     * `setup.encounter` above like any other pre-rolled fight. The battle factory therefore has no
     * gauntlet branch at all any more, and `IBattleSetup` no longer carries a `gauntlet` field: what
     * a gauntlet still needs from this function is `persistedHp`, and that is one lookup, not a mode.
     */
    } else if (sectorElement) {
        // Epic 8: Logic transition to Encounter Generator
        const encounter = generateEncounter({
            sectorElement,
            playerParty,
            seed: rng.fork('encounter_sector')
        });
        enemyParty = encounter.enemyParty;
        enemyDeckIds = encounter.enemyDeckIds;
    } else {
        // Fallback or fixed encounters (e.g. initial dev test)
        enemyParty = enemyIds.map(enemyId => createMockEntity('Wild ' + GetMingmingData(enemyId).name, enemyId, rng));

        // Use the old archetype logic for fixed encounters if needed, or simple direct IDs
        enemyDeckIds = enemyIds.map(enemyId => {
            const def = GetMingmingData(enemyId);
            let archetype: 'FENRIR' | 'KRAKEN' | 'RATATOSKR' = 'FENRIR';
            if (def.primaryElement === 'Water') archetype = 'KRAKEN';
            if (def.primaryElement === 'Nature') archetype = 'RATATOSKR';

            const lists = {
                FENRIR: { daemon: 'core_overclock_daemon', cards: ['fire_poke', 'fire_punch_v2', 'cinder_slash', 'brute_force', 'fury_strike', 'scorch'] },
                KRAKEN: { daemon: 'feedback_loop_daemon', cards: ['water_slap', 'whirlpool_v2', 'surge_protection', 'poison_injection', 'acid_splash', 'toxic_surge', 'corrosive_bolt', 'contagion'] },
                RATATOSKR: { daemon: 'fertile_ground_daemon', cards: ['water_slap', 'nettle_sting', 'thistle_barrage', 'seed_bomb_v2', 'soothe', 'pollen_cloud', 'crippling_vine'] }
            };
            const list = lists[archetype];
            return [list.daemon, ...list.cards.slice(0, 9)];
        }).flat();
    }

    // Epic 2/22/2026: Disable OS on enemies as they use intents now.
    //
    // Ticket 11: a pre-rolled run encounter is exempt, because for it the OS is not an oversight to
    // be cleaned up but half of ticket 08's ruled kit fraction — a biome-0 enemy runs no firmware
    // and a biome-1 enemy runs its own, and `engine/run/encounter.ts` has already said which. A
    // blanket strip here would silently delete that rule and make every depth field the same enemy.
    //
    // Ticket 18: the `boss_relic_*` exemption below is now the ONLY thing left of the old gym
    // branch, and it is kept for the paths that still build enemies here (the debug/legacy ones).
    // A run's boss arrives through `setup.encounter` with its signature firmware already on it, so
    // it never reaches this line at all.
    if (!setup.encounter) {
        enemyParty = enemyParty.map(e => ({
            ...e,
            activeOS: e.activeOS?.startsWith('boss_relic_') ? e.activeOS : undefined
        }));
    }

    // --- SHARED DECK INITIALIZATION ---

    // The archetype fallback below is a pre-run-loop leftover: it invents a deck for a party that
    // arrived without one. **Ticket 12 should delete it.** A run always has a deck now — `createRun`
    // mints 8 cards per starting member from ticket 08's `startKit` tags and the run builds from
    // there — so the only callers that can still hit this branch are tests and debug paths that
    // hand over an empty `setup.deck`. Removing it today would turn those into throws in the same
    // commit that moves the shape, which is one change too many.
    const FALLBACK_ARCHETYPES = ['FENRIR', 'KRAKEN', 'RATATOSKR'] as const;
    type FallbackArchetype = typeof FALLBACK_ARCHETYPES[number];
    const isFallbackArchetype = (id: string): id is FallbackArchetype =>
        (FALLBACK_ARCHETYPES as readonly string[]).includes(id);

    const getArchetypeDeck = (archetype: FallbackArchetype): string[] => {
        const lists = {
            FENRIR: {
                daemon: 'core_overclock_daemon',
                cards: ['fire_poke', 'fire_punch_v2', 'fire_punch_v2', 'cinder_slash', 'cinder_slash', 'brute_force', 'fury_strike', 'scorch', 'ignite', 'ignite', 'strength_burst']
            },
            KRAKEN: {
                daemon: 'feedback_loop_daemon',
                cards: ['water_slap', 'water_slap', 'whirlpool_v2', 'whirlpool_v2', 'surge_protection', 'surge_protection', 'poison_injection', 'acid_splash', 'toxic_surge', 'corrosive_bolt', 'contagion']
            },
            RATATOSKR: {
                daemon: 'fertile_ground_daemon',
                cards: ['water_slap', 'water_slap', 'nettle_sting', 'nettle_sting', 'thistle_barrage', 'thistle_barrage', 'seed_bomb_v2', 'soothe', 'pollen_cloud', 'pollen_cloud', 'crippling_vine']
            }
        };

        const list = lists[archetype];
        const shuffled = rng.shuffle(list.cards);
        return [list.daemon, ...shuffled.slice(0, 9)];
    };

    const playerArchetype = playerParty[0].definitionId.toUpperCase();

    let playerDeckIds: string[] = [];
    if (setup.deck.length > 0) {
        // Already dataIds — the run deck holds them directly, so the instance-id lookup that used
        // to resolve `activeDeck.cards` against `cardInventory` has nothing left to do.
        playerDeckIds = [...setup.deck];
    } else {
        playerDeckIds = getArchetypeDeck(isFallbackArchetype(playerArchetype) ? playerArchetype : 'FENRIR');
    }

    const pDeckCardsRaw = instantiateDeck(playerDeckIds, rng);
    const pDeckCards = rng.shuffle(pDeckCardsRaw);

    const eDeckCardsRaw = instantiateDeck(enemyDeckIds, rng);
    const eDeckCards = rng.shuffle(eDeckCardsRaw);

    const playerCardDraw = playerParty.reduce((sum, e) => sum + e.cardDraw, 0) - playerParty.length + 1;
    const enemyCardDraw = enemyParty.reduce((sum, e) => sum + e.cardDraw, 0) - enemyParty.length + 1;

    const pInitialDeck: IDeckState = {
        ownerId: 'PLAYER',
        deck: [],
        drawpile: pDeckCards,
        hand: [],
        discard: [],
        exhaust: []
    };
    const { state: pDeckState, nextSeed: seedAfterPlayerDraw } = drawCards(pInitialDeck, playerCardDraw, rng.seed);
    rng.adopt(seedAfterPlayerDraw);

    // A battle with no enemies is unwinnable-by-definition and renders a ghost
    // arena (empty enemy column, instant hollow victory). Fail loudly instead.
    if (enemyParty.length === 0) {
        throw new Error(`[createBattleState] No enemies generated (encounter: ${setup.encounter ? setup.encounter.enemyParty.length : 'none'}, sector: ${sectorElement}, enemyIds: ${JSON.stringify(enemyIds)})`);
    }

    // Move users get no drawpile/hand at all; card users get a dealt hand.
    const eInitialDeck: IDeckState = {
        ownerId: 'ENEMY',
        deck: [],
        drawpile: enemyMode === 'CARDS' ? eDeckCards : [],
        hand: [],
        discard: [],
        exhaust: []
    };
    const { state: eDeckState, nextSeed: seedAfterEnemyDraw } = enemyMode === 'CARDS'
        ? drawCards(eInitialDeck, enemyCardDraw, rng.seed)
        : { state: eInitialDeck, nextSeed: rng.seed };
    rng.adopt(seedAfterEnemyDraw);

    // Intents are only telegraphed for move users.
    const finalEnemyParty = enemyMode === 'MOVES'
        ? generateIntents(enemyParty, rng.seed, 1)
        : enemyParty;

    return {
        // sessionId lives inside IBattleState, so a wall-clock value would
        // break every replay diff on its own. Derive it from the seed instead.
        sessionId: 'battle_' + battleSeed,
        seed: rng.seed,
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        osLogs: [],
        procs: [],
        playerParty: playerParty,
        enemyParty: finalEnemyParty,
        playerDeck: pDeckState,
        enemyDeck: eDeckState,
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        nonNaturalCardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        elementPlays: {
            'Fire': 0, 'Water': 0, 'Earth': 0, 'Air': 0, 'Nature': 0,
            'Ice': 0, 'Light': 0, 'Dark': 0, 'None': 0
        },
        counters: {},
        activeRelics: [...setup.drivers],
        enemyMode
    };
}
